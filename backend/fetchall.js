// const admin = require('firebase-admin');
// const readline = require('readline');

// // Firebase Admin init
// admin.initializeApp({
//   credential: admin.credential.cert(require('./serviceAccountKey.json'))
// });

// const db = admin.firestore();

// // CLI setup
// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout
// });

// function ask(question) {
//   return new Promise(resolve => rl.question(question, resolve));
// }

// async function runFlow() {
//   console.log('\nFetching all queues...\n');

//   // 1️⃣ Get queues
//   const queueSnap = await db.collection('queue generation').get();
//   if (queueSnap.empty) {
//     console.log('No queues found');
//     rl.close();
//     return;
//   }

//   const queues = queueSnap.docs.map((doc, index) => {
//     const data = doc.data();
//     return {
//       index: index + 1,
//       id: doc.id,
//       ref: doc.ref,
//       queuename: data.queuename ?? data.name ?? null
//     };
//   });

//   queues.forEach(q => {
//     console.log(`${q.index}. ${q.id} (${q.queuename})`);
//   });

//   const answer = await ask('\nSelect a queue number: ');
//   const selectedQueue = queues.find(q => q.index === Number(answer));

//   if (!selectedQueue) {
//     console.log('Invalid selection');
//     rl.close();
//     return;
//   }

//   console.log(`\nQueue selected: ${selectedQueue.queuename}\n`);

//   // 2️⃣ Fetch tokens
//   const tokenSnap = await db
//     .collection('queue_token')
//     .where('queueref', '==', selectedQueue.ref)
//     .get();

//   if (tokenSnap.empty) {
//     console.log('No tokens found');
//     rl.close();
//     return;
//   }

//   let recordsReported = 0;
//   let validationFailures = 0;

//   console.log('Report:\n');

//   // 3️⃣ Token → Product → ParticipantProduct
//   for (const tokenDoc of tokenSnap.docs) {
//     const token = tokenDoc.data();
//     const tokenStage = token.currentstage ?? null;

//     const productRef = token.productref;
//     if (!productRef) continue;

//     // products (bridge)
//     const productSnap = await productRef.get();
//     if (!productSnap.exists) continue;

//     // participantsproduct (source of truth)
//     const ppSnap = await db
//       .collection('participantsproduct')
//       .where('productref', '==', productRef)
//       .limit(1)
//       .get();

//     if (ppSnap.empty) continue;

//     const ppDoc = ppSnap.docs[0];
//     const pp = ppDoc.data();

//     const status = pp.status ?? null;
//     const integrationMode = pp.integrationMode ?? pp.mode ?? null;

//     // 🔹 RULE 2 — VALIDATION (FIRST)
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
//     }

//     // 🔹 RULE 1 — DATA RETRIEVAL CONDITION (SECOND)
//     let includeInReport;
//     if (status === 'completed') {
//       includeInReport = integrationMode === 'completed';
//     } else {
//       includeInReport = status === 'ongoing';
//     }

//     if (!includeInReport) continue; // ⛔ filtered out

//     recordsReported++;

//     console.log({
//       queuename: selectedQueue.queuename,
//       tokenId: tokenDoc.id,
//       productId: productSnap.id,
//       participantProductId: ppDoc.id,

//       productStatus: status,
//       integrationMode,

//       tokenStage,
//       validationPassed,
//     });
//   }

//   // 4️⃣ Summary
//   console.log({
//     queuename: selectedQueue.queuename,
//     recordsReported,
//     validationFailures
//   });

//   rl.close();
// }

// // Run
// runFlow().catch(err => {
//   console.error(err);
//   rl.close();
// });

const admin = require('firebase-admin');
const readline = require('readline');

// Firebase Admin init
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

const db = admin.firestore();

// CLI setup
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function runFlow() {
  console.log('\nFetching all queues...\n');

  // 1️⃣ Get queues
  const queueSnap = await db.collection('queue generation').get();
  if (queueSnap.empty) {
    console.log('No queues found');
    rl.close();
    return;
  }

  const queues = queueSnap.docs.map((doc, index) => {
    const data = doc.data();
    return {
      index: index + 1,
      id: doc.id,
      ref: doc.ref,
      queuename: data.queuename ?? data.name ?? null
    };
  });

  queues.forEach(q => {
    console.log(`${q.index}. ${q.id} (${q.queuename})`);
  });

  const answer = await ask('\nSelect a queue number: ');
  const selectedQueue = queues.find(q => q.index === Number(answer));

  if (!selectedQueue) {
    console.log('Invalid selection');
    rl.close();
    return;
  }

  console.log(`\nQueue selected: ${selectedQueue.queuename}\n`);

  // 2️⃣ Fetch tokens
  const tokenSnap = await db
    .collection('queue_token')
    .where('queueref', '==', selectedQueue.ref)
    .get();

  if (tokenSnap.empty) {
    console.log('No tokens found');
    rl.close();
    return;
  }

  let recordsReported = 0;
  let validationFailures = 0;

  const validationFailedRecords = [];

  console.log('Report:\n');

  // 3️⃣ Token → Product → ParticipantProduct
  for (const tokenDoc of tokenSnap.docs) {
    const token = tokenDoc.data();
    const tokenStage = token.currentstage ?? null;

    const productRef = token.productref;
    if (!productRef) continue;

    // products (bridge)
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

    // 🔹 RULE 2 — VALIDATION (FIRST)
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
        queuename: selectedQueue.queuename,
        tokenId: tokenDoc.id,
        productId: productSnap.id,
        participantProductId: ppDoc.id,
        productStatus: status,
        integrationMode,
        tokenStage,
        validationFailureReason
      });
    }

    // 🔹 RULE 1 — DATA RETRIEVAL CONDITION (SECOND)
    let includeInReport;
    if (status === 'completed') {
      includeInReport = integrationMode === 'completed';
    } else {
      includeInReport = status === 'ongoing';
    }

    if (!includeInReport) continue; // filtered out

    recordsReported++;

    console.log({
      queuename: selectedQueue.queuename,
      tokenId: tokenDoc.id,
      productId: productSnap.id,
      participantProductId: ppDoc.id,
      productStatus: status,
      integrationMode:pp.mode ?? null,
      tokenStage,
      validationPassed
    });
  }

  // 4️⃣ Summary
  console.log('\n===== SUMMARY =====');
  console.log({
    queuename: selectedQueue.queuename,
    recordsReported,
    validationFailures
  });

  // 5️⃣ Validation failures (separate section)
  if (validationFailedRecords.length > 0) {
    console.log('\n===== VALIDATION FAILURES (Rule 2) =====\n');
    validationFailedRecords.forEach(record => {
      console.log(record);
    });
  }

  rl.close();
}

// Run
runFlow().catch(err => {
  console.error(err);
  rl.close();
});
