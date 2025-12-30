// const admin = require("firebase-admin");
// const prompt = require("prompt-sync")();

// firebaseApp = getApps().length === 0 ? initializeApp(environment.firebase) : getApps()[0];
//   db = getFirestore(this.firebaseApp);

// const db = admin.firestore();

// async function selectQueueAndUpdateTokens() {
//   try {
//     // 1. Fetch all queues
//     const queueSnap = await db.collection("queue_generation").get();

//     if (queueSnap.empty) {
//       console.log(" No queues found");
//       return;
//     }

//     const queues = queueSnap.docs.map((doc, index) => ({
//       index,
//       id: doc.id,
//       ref: doc.ref,
//       ...doc.data(),
//     }));

//     console.log("\n Available Queues:\n");

//     queues.forEach((q) => {
//       console.log(
//         `[${q.index}] ${q.queuename || q.queuetype || q.id}`
//       );
//     });

//     // 2. Select queue
//     const selectedIndex = prompt("\nSelect queue index: ");
//     const selectedQueue = queues[selectedIndex];

//     if (!selectedQueue) {
//       console.log("Invalid queue selection");
//       return;
//     }

//     console.log(
//       `\n✅ Selected Queue: ${selectedQueue.queuename || selectedQueue.id}`
//     );

//     // 3. Fetch tokens for selected queue
//     const tokenSnap = await db
//       .collection("queue_token")
//       .where("queueref", "==", selectedQueue.ref)
//       .get();

//     if (tokenSnap.empty) {
//       console.log("No tokens found for selected queue");
//       return;
//     }

//     console.log(`Tokens found: ${tokenSnap.size}`);

//     const batch = db.batch();

//     // 4. Process tokens
//     for (const tokenDoc of tokenSnap.docs) {
//       const tokenData = tokenDoc.data();
//       const deliveryRef = tokenData.deliveryref;

//       if (!deliveryRef) continue;

//       const deliverableSnap = await deliveryRef.get();
//       if (!deliverableSnap.exists) continue;

//       const participantProductId =
//         deliverableSnap.data().participantproductid;

//       if (!participantProductId) continue;

//       batch.update(tokenDoc.ref, {
//         participantproductid: participantProductId,
//         updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//       });
//     }

//     // 5. Commit updates
//     await batch.commit();
//     console.log("Tokens updated successfully");
//   } catch (err) {
//     console.error("Error:", err);
//   }
// }

// selectQueueAndUpdateTokens();


const fs = require("fs");

const ENV_PATH =
  "C:/Users/sasho/Desktop/Queue_status/frontend/src/environments/environments.ts";

const file = fs.readFileSync(ENV_PATH, "utf8");

const match = file.match(/projectId:\s*["'](.+?)["']/);

if (!match) {
  throw new Error("projectId not found in environments.ts");
}

const projectId = match[1];

console.log("Using Firebase project:", projectId);

// 2️⃣ Firebase Admin (AUTH + ACCESS)
const admin = require("firebase-admin");

admin.initializeApp({
  projectId,
});

const db = admin.firestore();

async function listQueueTokensAndDeliverables() {
  try {
    // 1. Fetch all queues
    const queueSnap = await db.collection("queue_generation").get();

    if (queueSnap.empty) {
      console.log(" No queues found");
      return;
    }

    const queues = queueSnap.docs.map((doc, index) => ({
      index,
      id: doc.id,
      ref: doc.ref,
      ...doc.data(),
    }));

    console.log("\n Available Queues:\n");

    queues.forEach((q) => {
      console.log(
        `[${q.index}] ${q.queuename || q.queuetype || q.id}`
      );
    });

    // 2. Select queue
    const selectedIndex = prompt("\nSelect queue index: ");
    const selectedQueue = queues[selectedIndex];

    if (!selectedQueue) {
      console.log("Invalid queue selection");
      return;
    }

    console.log(
      `\nSelected Queue: ${selectedQueue.queuename || selectedQueue.id}`
    );

    // 3. Fetch tokens for selected queue
    const tokenSnap = await db
      .collection("queue_token")
      .where("queueref", "==", selectedQueue.ref)
      .get();

    if (tokenSnap.empty) {
      console.log("No tokens found for selected queue");
      return;
    }

    console.log(`\n🔹 Tokens found: ${tokenSnap.size}\n`);

    // 4. Process tokens (READ-ONLY)
    for (const tokenDoc of tokenSnap.docs) {
      const tokenData = tokenDoc.data();
      const deliveryRef = tokenData.deliveryref;

      console.log(`Token ID: ${tokenDoc.id}`);

      if (!deliveryRef) {
        console.log(" No deliveryRef\n");
        continue;
      }

      const deliverableSnap = await deliveryRef.get();

      if (!deliverableSnap.exists) {
        console.log(" Deliverable not found\n");
        continue;
      }

      const participantProductId =
        deliverableSnap.data().participantproductid;

      console.log(" deliveryRef:", deliveryRef.path);
      console.log(" participantProductId:",participantProductId || "Not found"
      );
      console.log("");
    }

    console.log("Read-only processing completed");
  } catch (err) {
    console.error("Error:", err);
  }
}

listQueueTokensAndDeliverables();
