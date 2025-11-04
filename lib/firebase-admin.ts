import * as admin from "firebase-admin";
import { Timestamp } from "firebase/firestore";
import { config } from "./config";
import type { DeviceStatus } from "./fleet-backend";

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!admin.apps.length) {
  if (!serviceAccount) {
    throw new Error("Firebase Admin SDK service account credentials are not set. Please set the FIREBASE_SERVICE_ACCOUNT_JSON environment variable.");
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const adminAuth = admin.auth();
const adminDb = admin.firestore();
// Avoid errors when objects contain undefined fields
try {
  adminDb.settings({ ignoreUndefinedProperties: true } as any);
} catch {}

interface CachedDeviceStatuses {
  statuses: DeviceStatus[]
  updatedAt: Timestamp
}

/**
 * AdminFirestoreService for server-side operations.
 * Uses the Firebase Admin SDK to bypass security rules.
 */
export class AdminFirestoreService {
  private db: admin.firestore.Firestore

  constructor() {
    this.db = adminDb
  }

  private getPublicCollection(collectionName: string) {
    return this.db.collection(`artifacts/${config.app.id}/public/data/${collectionName}`)
  }

  // Vehicle Cache Operations
  async getCachedDeviceStatuses(): Promise<CachedDeviceStatuses | null> {
    const docRef = this.getPublicCollection("fleetCache").doc("statuses")
    const docSnap = await docRef.get()
    if (!docSnap.exists) {
      return null
    }
    // Convert Firestore Timestamp to client-side Timestamp for consistency
    const data = docSnap.data() as any
    return {
      statuses: data.statuses,
      updatedAt: new Timestamp(data.updatedAt._seconds, data.updatedAt._nanoseconds),
    }
  }

  async setCachedDeviceStatuses(statuses: DeviceStatus[]) {
    const docRef = this.getPublicCollection("fleetCache").doc("statuses")
    // Sanitize statuses to avoid undefined/null fields that Firestore rejects
    const safeStatuses = (Array.isArray(statuses) ? statuses : []).map((s: any) => ({
      id: s?.id ?? "",
      vid: s?.vid ?? "",
      lng: typeof s?.lng === "number" ? s.lng : 0,
      lat: typeof s?.lat === "number" ? s.lat : 0,
      mlng: s?.mlng ?? "0",
      mlat: s?.mlat ?? "0",
      gt: s?.gt ?? new Date().toISOString(),
      ol: typeof s?.ol === "number" ? s.ol : 0,
      ps: s?.ps ?? "",
      dn: s?.dn ?? null,
      jn: s?.jn ?? null,
      pk: typeof s?.pk === "number" ? s.pk : undefined,
      net: typeof s?.net === "number" ? s.net : undefined,
      sn: typeof s?.sn === "number" ? s.sn : undefined,
    }))
    const cacheData = {
      statuses: safeStatuses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    await docRef.set(cacheData)
  }
}

export { adminAuth, adminDb };
