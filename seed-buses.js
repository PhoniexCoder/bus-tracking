// Script to seed bus info and locations into Firestore
// Usage: node seed-buses.js

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

const buses = [
  {
    id: "000088832714",
    vid: "UK07PA1693",
    mlat: "30.3165",
    mlng: "78.0322",
    ol: 1,
    gt: "2025-08-25T10:00:00Z",
    ps: "Dehradun ISBT",
    dn: "John Doe",
    jn: "DRV001",
    address: "Dehradun ISBT"
  },
  {
    id: "000088832715",
    vid: "UK07PA1694",
    mlat: "30.3200",
    mlng: "78.0400",
    ol: 1,
    gt: "2025-08-25T10:05:00Z",
    ps: "Clock Tower",
    dn: "Jane Smith",
    jn: "DRV002",
    address: "Clock Tower"
  }
];

async function seed() {
  const batch = db.batch();
  buses.forEach(bus => {
    const ref = db.collection('buses').doc(bus.id);
    batch.set(ref, bus);
  });
  await batch.commit();
  console.log('Seeded buses to Firestore!');
}

seed().catch(console.error);
