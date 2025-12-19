// const express = require('express');
// const cors = require('cors');
// const admin = require('firebase-admin');

// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccountKey.json'))
// });

// const db = admin.firestore();

// const app = express();
// app.use(cors());
// app.use(express.json());

// /**
//  * GET all queues
//  */
// app.get('/queues', async (req, res) => {
//   const snap = await db.collection('queue generation').get();
//   const queues = snap.docs.map(doc => ({
//     id: doc.id,
//     queuename: doc.data().queuename ?? doc.data().name ?? null
//   }));
//   res.json(queues);
// });

// /**
//  * GET report for selected queue
//  */
// app.get('/report/:queueId', async (req, res) => {
//   const queueId = req.params.queueId;
//   const queueRef = db.doc(`queue generation/${queueId}`);

//   const tokenSnap = await db
//     .collection('queue_token')
//     .where('queueref', '==', queueRef)
//     .get();

//   let recordsReported = 0;
//   let validationFailures = 0;
//   const reportRecords = [];
//   const validationFailedRecords = [];

//   for (const tokenDoc of tokenSnap.docs) {
//     const token = tokenDoc.data();
//     const tokenStage = token.currentstage ?? null;

//     if (!token.productref) continue;

//     const productSnap = await token.productref.get();
//     if (!productSnap.exists) continue;

//     const ppSnap = await db
//       .collection('participantsproduct')
//       .where('productref', '==', token.productref)
//       .limit(1)
//       .get();

//     if (ppSnap.empty) continue;

//     const ppDoc = ppSnap.docs[0];
//     const pp = ppDoc.data();

//     const status = pp.status ?? null;
//     const integrationMode = pp.integrationMode ?? pp.mode ?? null;

//     // Rule 2 – validation
//     let validationPassed = true;
//     let validationFailureReason = null;

//     if (
//       typeof tokenStage === 'string' &&
//       tokenStage.toLowerCase() === 'completed' &&
//       status !== 'completed'
//     ) {
//       validationPassed = false;
//       validationFailureReason =
//         'Token stage is completed but participant product status is not completed';
//       validationFailures++;

//       validationFailedRecords.push({
//         tokenId: tokenDoc.id,
//         productStatus: status,
//         integrationMode,
//         tokenStage,
//         validationFailureReason
//       });
//     }

//     // Rule 1 – retrieval
//     let include;
//     if (status === 'completed') include = integrationMode === 'completed';
//     else include = status === 'ongoing';

//     if (!include) continue;

//     recordsReported++;

//     report.push({
//       tokenId: tokenDoc.id,
//       productStatus: status,
//       integrationMode,
//       tokenStage,
//       validationPassed
//     });
//   }

//   res.json({
//   records: reportRecords,
//   validationFailures: validationFailedRecords,
//   summary: {
//     recordsReported,
//     validationFailures
//   }
// });

// });

// app.listen(3000, () => {
//   console.log('Backend running on http://localhost:3000');
// });


const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// -------------------- Firebase Init --------------------
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceaccountkey.json'))
});

const db = admin.firestore();

// -------------------- App Init --------------------
const app = express();
app.use(cors());
app.use(express.json());

// -----------------------------------------------------
// GET ALL QUEUES
// -----------------------------------------------------
app.get('/queues', async (req, res) => {
  try {
    const snap = await db.collection('queue generation').get();

    const queues = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        queuename: d.queuename ?? d.name ?? null
      };
    });

    res.json(queues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

// -----------------------------------------------------
// GET REPORT FOR SELECTED QUEUE
// -----------------------------------------------------
app.get('/queue-report/:queueId', async (req, res) => {
  try {
    const { queueId } = req.params;

    const queueRef = db.collection('queue generation').doc(queueId);
    const queueSnap = await queueRef.get();

    if (!queueSnap.exists) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const queuename =
      queueSnap.data().queuename ?? queueSnap.data().name ?? null;

    // -------------------- Fetch Tokens --------------------
    const tokenSnap = await db
      .collection('queue_token')
      .where('queueref', '==', queueRef)
      .get();

    if (tokenSnap.empty) {
      return res.json({
        records: [],
        validationFailures: [],
        summary: {
          recordsReported: 0,
          validationFailures: 0
        }
      });
    }

    // -------------------- Containers --------------------
    const reportRecords = [];
    const validationFailedRecords = [];

    // -------------------- Process Tokens --------------------
    for (const tokenDoc of tokenSnap.docs) {
      const token = tokenDoc.data();
      const tokenStage = token.currentstage ?? null;

      const productRef = token.productref;
      if (!productRef) continue;

      // product bridge
      const productSnap = await productRef.get();
      if (!productSnap.exists) continue;

      // participantsproduct (source of truth)
      const ppSnap = await db
        .collection('participantsproduct')
        .where('productref', '==', productRef)
        .limit(1)
        .get();

      if (ppSnap.empty) continue;

      const ppDoc = ppSnap.docs[0];
      const pp = ppDoc.data();

      const status = pp.status ?? null;
      const integrationMode = pp.integrationMode ?? pp.mode ?? null;

      // -------------------------------------------------
      // RULE 2 — VALIDATION (FIRST)
      // -------------------------------------------------
      let validationPassed = true;
      let validationFailureReason = null;

      if (
        typeof tokenStage === 'string' &&
        tokenStage.toLowerCase() === 'completed' &&
        status !== 'completed'
      ) {
        validationPassed = false;
        validationFailureReason =
          'Token stage is completed but participant product status is not completed';

        validationFailedRecords.push({
          queuename,
          tokenId: tokenDoc.id,
          productId: productSnap.id,
          participantProductId: ppDoc.id,
          productStatus: status,
          integrationMode,
          tokenStage,
          validationFailureReason
        });
      }

      // -------------------------------------------------
      // RULE 1 — DATA RETRIEVAL CONDITION (SECOND)
      // -------------------------------------------------
      let includeInReport;

      if (status === 'completed') {
        includeInReport = integrationMode === 'completed';
      } else {
        includeInReport = status === 'ongoing';
      }

      if (!includeInReport) continue;

      // -------------------------------------------------
      // ADD TO REPORT
      // -------------------------------------------------
      reportRecords.push({
        queuename,
        tokenId: tokenDoc.id,
        productId: productSnap.id,
        participantProductId: ppDoc.id,
        productStatus: status,
        integrationMode,
        tokenStage,
        validationPassed
      });
    }

    // -------------------- Response --------------------
    res.json({
      records: reportRecords,
      validationFailures: validationFailedRecords,
      summary: {
        recordsReported: reportRecords.length,
        validationFailures: validationFailedRecords.length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// -------------------- Server Start --------------------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
