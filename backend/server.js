const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

const db = admin.firestore();

const app = express();
app.use(cors());
app.use(express.json());

/**
 * GET all queues
 */
app.get('/queues', async (req, res) => {
  const snap = await db.collection('queue generation').get();
  const queues = snap.docs.map(doc => ({
    id: doc.id,
    queuename: doc.data().queuename ?? doc.data().name ?? null
  }));
  res.json(queues);
});

/**
 * GET report for selected queue
 */
app.get('/report/:queueId', async (req, res) => {
  const queueId = req.params.queueId;
  const queueRef = db.doc(`queue generation/${queueId}`);

  const tokenSnap = await db
    .collection('queue_token')
    .where('queueref', '==', queueRef)
    .get();

  let recordsReported = 0;
  let validationFailures = 0;
  const report = [];
  const validationFailedRecords = [];

  for (const tokenDoc of tokenSnap.docs) {
    const token = tokenDoc.data();
    const tokenStage = token.currentstage ?? null;

    if (!token.productref) continue;

    const productSnap = await token.productref.get();
    if (!productSnap.exists) continue;

    const ppSnap = await db
      .collection('participantsproduct')
      .where('productref', '==', token.productref)
      .limit(1)
      .get();

    if (ppSnap.empty) continue;

    const ppDoc = ppSnap.docs[0];
    const pp = ppDoc.data();

    const status = pp.status ?? null;
    const integrationMode = pp.integrationMode ?? pp.mode ?? null;

    // Rule 2 – validation
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
      validationFailures++;

      validationFailedRecords.push({
        tokenId: tokenDoc.id,
        productStatus: status,
        integrationMode,
        tokenStage,
        validationFailureReason
      });
    }

    // Rule 1 – retrieval
    let include;
    if (status === 'completed') include = integrationMode === 'completed';
    else include = status === 'ongoing';

    if (!include) continue;

    recordsReported++;

    report.push({
      tokenId: tokenDoc.id,
      productStatus: status,
      integrationMode,
      tokenStage,
      validationPassed
    });
  }

  res.json({
  records: reportRecords,
  validationFailures: validationFailedRecords,
  summary: {
    recordsReported,
    validationFailures
  }
});

});

app.listen(3000, () => {
  console.log('Backend running on http://localhost:3000');
});
