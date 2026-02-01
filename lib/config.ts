// Environment configuration utility
export const config = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  googleMaps: {
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },
  fleet: {
    baseUrl: process.env.NEXT_PUBLIC_FLEET_API_BASE_URL || "https://fleet.lagaam.in",
  },
  backend: {
    // FastAPI or other backend base URL
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_BASE_URL || "http://localhost:8000",
  },
  auth: {
    externalEnabled: String(process.env.NEXT_PUBLIC_EXTERNAL_AUTH_ENABLED || "false").toLowerCase() === "true",
    // Optional header names if ERP forwards identity via reverse proxy
    erpUserIdHeader: process.env.NEXT_PUBLIC_ERP_USER_ID_HEADER || "x-erp-user-id",
    erpUserRoleHeader: process.env.NEXT_PUBLIC_ERP_USER_ROLE_HEADER || "x-erp-user-role",
  },
  app: {
    id: process.env.NEXT_PUBLIC_APP_ID || "bus_tracker_app",
    name: process.env.NEXT_PUBLIC_APP_NAME || "Bus Tracker",
    initialAuthToken: process.env.NEXT_PUBLIC_INITIAL_AUTH_TOKEN,
  // driverAuthDomain removed
  },
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
}

// Validation function
export const validateConfig = () => {
  const requiredVars = [
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
  ]

  const missing = requiredVars.filter((varName) => !process.env[varName])

  if (missing.length > 0 && config.isProduction) {
    console.error("Missing required environment variables:", missing)
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }

  if (missing.length > 0 && config.isDevelopment) {
    console.warn("Missing environment variables (using defaults):", missing)
  }
}

// Initialize validation
if (typeof window === "undefined") {
  // Only validate on server side
  validateConfig()
}
