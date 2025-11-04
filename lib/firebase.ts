import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase for SSR and SSG, and prevent re-initialization on the client
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()

// Export the Firebase services you'll use
const auth = getAuth(app)
const db = getFirestore(app)
// To use other services like storage, import and export them here
// import { getStorage } from "firebase/storage";
// const storage = getStorage(app);

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn("Firebase environment variables are not fully configured. Please set up your .env.local file.")
}

export { app, auth, db }
