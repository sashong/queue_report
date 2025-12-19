const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// -------------------- Firebase Init --------------------
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceaccountkey.json'))
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

/* ================== GET QUEUES ================== */
app.get('/queues', async (req, res) => {
  try {
    const snap = await db.collection('queue generation').get();

    if (snap.empty) {
      return res.json([]);
    }

    const queues = snap.docs
      .map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          queuename: d.queuename ?? d.name ?? null,
          queueenddate: d.queueenddate ?? null
        };
      })
      .sort((a, b) => {
        if (!a.queueenddate) return 1;
        if (!b.queueenddate) return -1;
        return b.queueenddate.toMillis() - a.queueenddate.toMillis();
      });

    res.json(queues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch queues' });
  }
});

/* ================== QUEUE REPORT ================== */
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

    const tokenSnap = await db
      .collection('queue_token')
      .where('queueref', '==', queueRef)
      .get();

    const records = [];
    const validationFailures = [];

    for (const tokenDoc of tokenSnap.docs) {
      const tokenId = tokenDoc.id;
      const token = tokenDoc.data();

      const tokenStage = token.currentstage ?? null;
      const participantName = token.profile_name ?? null;
      const productName = token.productname ?? null;
      const productRef = token.productref;

      if (!productRef) continue;

      const ppSnap = await db
        .collection('participantsproduct')
        .where('eventref', '==', queueRef)
        .where('profileid', '==', token.profile_id)
        .where('productref', '==', productRef)
        .limit(1)
        .get();

      if (ppSnap.empty) continue;

      const ppDoc = ppSnap.docs[0];
      const pp = ppDoc.data();

      const productStatus = pp.status ?? null;
      const integrationMode = pp.integrationMode ?? pp.mode ?? NaN;

      // ---------- RULE 2 : VALIDATION ----------
      let validationPassed = true;
      let validationReason = null;

      if (
        typeof tokenStage === 'string' &&
        tokenStage.toLowerCase() === 'completed' &&
        productStatus !== 'completed'
      ) {
        validationPassed = false;
        validationReason =
          'Current stage is completed but participant product status is not completed';

        validationFailures.push({
          queuename,
          tokenId,
          participantName,
          productName,
          productStatus,
          integrationMode,
          tokenStage,
          validationReason
        });
      }

      // ---------- RULE 1 ----------
      const rule1Passed =
        productStatus === 'completed'
          ? integrationMode === 'completed'
          : productStatus === 'ongoing';

      // ---------- FINAL RECORD ----------
      records.push({
        queuename,
        tokenId,
        participantName,
        productName,
        productStatus,
        integrationMode,
        tokenStage,
        validationPassed,
        validationReason,
        rule1Passed
      });
    }

    // ---------- RESPONSE ----------
    res.json({
      records,
      validationFailures,
      summary: {
        recordsReported: records.length,
        validationFailures: validationFailures.length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
