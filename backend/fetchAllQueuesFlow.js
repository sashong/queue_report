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

  // 1️⃣ Get all queues
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

  console.log('');

  // 2️⃣ User selects queue
  const answer = await ask('Select a queue number: ');
  const selectedQueue = queues.find(q => q.index === Number(answer));

  if (!selectedQueue) {
    console.log('Invalid selection');
    rl.close();
    return;
  }

  //console.log(`\nSelected queue: ${selectedQueue.id}`);
  console.log(`Queue name   : ${selectedQueue.queuename}\n`);

  // 3️⃣ Get tokens for selected queue
  const tokenSnap = await db
    .collection('queue_token')
    .where('queueref', '==', selectedQueue.ref)
    .get();

  if (tokenSnap.empty) {
    console.log('No tokens found for this queue');
    rl.close();
    return;
  }

  let totalTokens = 0;
  let completedTokens = 0;
  let nonCompletedTokens = 0;

  // 4️⃣ Token → Product → Report
  for (const tokenDoc of tokenSnap.docs) {
    totalTokens++;

    const token = tokenDoc.data();

    const productRef = token.productref;
    if (!productRef) continue;

    const productSnap = await productRef.get();
    if (!productSnap.exists) continue;

    const product = productSnap.data();

    const tokenStage = token.currentstage ?? null;
    const productStatus = product.status ?? null;
    const integrationMode = product.integrationMode ?? product.mode ?? null;

    const tokenCompleted =
      typeof tokenStage === 'string' &&
      tokenStage.toLowerCase() === 'completed';

    if (tokenCompleted) completedTokens++;
    else nonCompletedTokens++;

     console.log({
  //     queueId: selectedQueue.id,
  //     queuename: selectedQueue.queuename,
       tokenId: tokenDoc.id,
  //     productId: productSnap.id,
       productName: token.productname ?? null,
  //     tokenStage,
  //     tokenCompleted,
  //     productStatus,
  //     integrationMode
     });
   }

  // 5️⃣ Summary
  console.log({
    //queueId: selectedQueue.id,
    queuename: selectedQueue.queuename,
    totalTokens,
    completedTokens,
    nonCompletedTokens
  });

  console.log('\nFlow completed\n');
  rl.close();
}

// Run
runFlow().catch(err => {
  console.error(err);
  rl.close();
});
