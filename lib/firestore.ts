import { db as clientDb } from "./firebase"
import { config } from "./config"
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  type Firestore,
} from "firebase/firestore"

// Base interface for profile data
interface BaseProfile {
  username: string
  name: string
  createdAt: Timestamp
}

export interface StudentProfile extends BaseProfile {
  studentId: string
  assignedBusId?: string
}

export interface AdminProfile extends BaseProfile {
  // Admin-specific fields can be added here
}

export interface Route {
  id?: string
  name: string
  // driverId removed
  stops: {
    name: string
    latitude: number
    longitude: number
    order: number
  }[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface BusAssignment {
  id?: string
  // driverId removed
  busId: string
  routeId: string
  plateNumber: string
  isActive: boolean
  createdAt: Timestamp
}

/**
 * FirestoreService for client-side operations.
 * Relies on the user's authentication context for security rules.
 */
export class FirestoreService {

  // Add a new bus to the database
  async addBus(bus: { busId: string; plateNumber: string; capacity: number; model?: string; year?: number; notes?: string; createdAt: string }) {
    const busesCol = this.getPublicCollection('buses');
    await addDoc(busesCol, bus);
  }

  // Update an existing bus in the database
  async updateBus(busId: string, updates: { plateNumber?: string; capacity?: number; model?: string; year?: number; notes?: string }) {
    const busesCol = this.getPublicCollection('buses');
    const q = query(busesCol, where('busId', '==', busId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      throw new Error(`Bus with ID ${busId} not found`);
    }

    const busDoc = snapshot.docs[0];
    await updateDoc(doc(this.db, busDoc.ref.path), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  }

  private userId: string
  private db: Firestore

  constructor(userId: string, dbInstance?: Firestore) {
    if (!userId) {
      throw new Error("User ID is required for FirestoreService.")
    }
    this.userId = userId
    this.db = dbInstance || clientDb
  }

  // Private data collections (user-specific)
  private getUserCollection(collectionName: string) {
    return collection(this.db, `artifacts/${config.app.id}/users/${this.userId}/${collectionName}`)
  }

  public async getAllBuses(): Promise<any[]> {
    const busesCol = this.getPublicCollection('buses');
    const snapshot = await getDocs(busesCol);
    return snapshot.docs.map((doc) => doc.data());
  }
  // Public data collections (shared)
  private getPublicCollection(collectionName: string) {
    return collection(this.db, `artifacts/${config.app.id}/public/data/${collectionName}`)
  }

  // Profile creation (generic)
  private async createProfile(profile: BaseProfile, type: "student" | "admin") {
    const docRef = doc(this.getUserCollection("profile"), type)
    await setDoc(docRef, { ...profile, type })
  }

  // Profile retrieval (generic)
  private async getProfile<T extends BaseProfile>(type: "student" | "admin"): Promise<T | null> {
    const docRef = doc(this.getUserCollection("profile"), type)
    const docSnap = await getDoc(docRef)
    return docSnap.exists() ? (docSnap.data() as T) : null
  }

  // Student operations
  async createStudentProfile(profile: StudentProfile) {
    await this.createProfile(profile, "student")
  }

  async getStudentProfile(): Promise<StudentProfile | null> {
    return this.getProfile<StudentProfile>("student")
  }

  // Admin operations
  async createAdminProfile(profile: AdminProfile) {
    await this.createProfile(profile, "admin")
  }

  async getAdminProfile(): Promise<AdminProfile | null> {
    return this.getProfile<AdminProfile>("admin")
  }

  // Route operations
  async createRoute(route: Omit<Route, "id" | "createdAt" | "updatedAt">) {
    const fullRoute = { ...route, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
    const docRef = await addDoc(this.getPublicCollection("routes"), fullRoute)
    return docRef.id
  }

  async updateRoute(routeId: string, updates: Partial<Omit<Route, "id" | "createdAt">>) {
    const docRef = doc(this.getPublicCollection("routes"), routeId)
    await updateDoc(docRef, { ...updates, updatedAt: Timestamp.now() })
  }

  async deleteRoute(routeId: string) {
    const docRef = doc(this.getPublicCollection("routes"), routeId)
    await deleteDoc(docRef)
  }

  // Bus Assignment operations
  async createBusAssignment(assignment: Omit<BusAssignment, "id" | "createdAt">) {
    const fullAssignment = { ...assignment, createdAt: Timestamp.now() }
    const docRef = await addDoc(this.getPublicCollection("busAssignments"), fullAssignment)
    return docRef.id
  }

  async getAllBusAssignments(): Promise<BusAssignment[]> {
    const querySnapshot = await getDocs(this.getPublicCollection("busAssignments"))
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BusAssignment)
  }

  // Real-time listeners
  onRoutesChange(callback: (routes: Route[]) => void) {
    const q = this.getPublicCollection("routes")
    return onSnapshot(q, (querySnapshot) => {
      const routes = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Route)
      callback(routes)
    })
  }

  onBusAssignmentsChange(callback: (assignments: BusAssignment[]) => void) {
    return onSnapshot(this.getPublicCollection("busAssignments"), (querySnapshot) => {
      const assignments = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as BusAssignment)
      callback(assignments)
    })
  }
    // Get a route by its ID
    async getRouteById(routeId: string): Promise<Route | null> {
      const docRef = doc(this.getPublicCollection("routes"), routeId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Route;
    }

    // Update a bus assignment by its ID
    async updateBusAssignment(assignmentId: string, updates: Partial<Omit<BusAssignment, "id" | "createdAt">>) {
      const docRef = doc(this.getPublicCollection("busAssignments"), assignmentId);
      await updateDoc(docRef, updates);
    }

    // Delete a bus by its ID
    async deleteBus(busId: string) {
      const docRef = doc(this.getPublicCollection("buses"), busId);
      await deleteDoc(docRef);
    }

    // Delete a bus assignment by its ID
    async deleteBusAssignment(assignmentId: string) {
      const docRef = doc(this.getPublicCollection("busAssignments"), assignmentId);
      await deleteDoc(docRef);
    }
}
