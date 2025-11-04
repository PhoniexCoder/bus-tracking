# Firebase Firestore Database Schema

## Database Structure

The database follows a hierarchical structure with proper security rules for multi-tenant applications.

### Root Structure
\`\`\`
/artifacts/{appId}/
├── users/{userId}/
│   └── profile/
└── public/
    └── data/
        ├── routes/
        ├── busAssignments/
        ├── stops/
        └── notifications/
\`\`\`

## Collections and Documents

### 1. User Profiles (Private Data)
**Path:** `/artifacts/{appId}/users/{userId}/profile`

#### Student Profile
\`\`\`typescript
interface StudentProfile {
  type: "student"
  studentId: string
  passwordHash: string
  name: string
  email?: string
  phone?: string
  assignedBusId?: string
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
  preferences?: {
    notifications: boolean
    language: string
  }
  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt?: Timestamp
}
\`\`\`


#### Admin Profile
\`\`\`typescript
interface AdminProfile {
  type: "admin"
  username: string
  passwordHash: string
  name: string
  email: string
  phone?: string
  role: "super_admin" | "admin" | "moderator"
  permissions: string[]
  department?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt?: Timestamp
}
\`\`\`

### 2. Routes (Public Data)
**Path:** `/artifacts/{appId}/public/data/routes/{routeId}`

\`\`\`typescript
interface Route {
  id: string
  name: string
  description?: string
  // driverId and driverName removed
  stops: {
    id: string
    name: string
    latitude: number
    longitude: number
    address?: string
    order: number
    estimatedArrivalTime?: string // HH:MM format
    isActive: boolean
  }[]
  schedule: {
    days: ("monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday")[]
    startTime: string // HH:MM format
    endTime: string // HH:MM format
    frequency?: number // minutes between trips
  }
  status: "active" | "inactive" | "maintenance"
  totalDistance?: number // in kilometers
  estimatedDuration?: number // in minutes
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
\`\`\`

### 3. Bus Assignments (Public Data)
**Path:** `/artifacts/{appId}/public/data/busAssignments/{assignmentId}`

\`\`\`typescript
interface BusAssignment {
  id: string
  // driverId and driverName removed
  busId: string
  plateNumber: string
  routeId: string
  routeName: string
  isActive: boolean
  assignedAt: Timestamp
  startDate: Timestamp
  endDate?: Timestamp
  notes?: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
\`\`\`

### 4. Bus Stops (Public Data)
**Path:** `/artifacts/{appId}/public/data/stops/{stopId}`

\`\`\`typescript
interface BusStop {
  id: string
  name: string
  description?: string
  latitude: number
  longitude: number
  address: string
  landmark?: string
  facilities: ("shelter" | "seating" | "lighting" | "accessibility")[]
  routes: string[] // Array of route IDs that use this stop
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}
\`\`\`

### 5. Notifications (Public Data)
**Path:** `/artifacts/{appId}/public/data/notifications/{notificationId}`

\`\`\`typescript
interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "warning" | "alert" | "maintenance"
  targetAudience: "all" | "students" | "admins"
  targetUsers?: string[] // Specific user IDs if not targeting all
  routeIds?: string[] // Specific routes affected
  busIds?: string[] // Specific buses affected
  priority: "low" | "medium" | "high" | "urgent"
  isActive: boolean
  expiresAt?: Timestamp
  createdAt: Timestamp
  createdBy: string
  readBy: {
    userId: string
    readAt: Timestamp
  }[]
}
\`\`\`

### 6. System Settings (Public Data)
**Path:** `/artifacts/{appId}/public/data/settings/app_settings`

\`\`\`typescript
interface AppSettings {
  appName: string
  version: string
  maintenanceMode: boolean
  features: {
    realTimeTracking: boolean
    notifications: boolean
    routeOptimization: boolean
    passengerCount: boolean
  }
  updateIntervals: {
    busLocation: number // seconds
    passengerCount: number // seconds
    routeData: number // seconds
  }
  contactInfo: {
    supportEmail: string
    supportPhone: string
    emergencyNumber: string
  }
  updatedAt: Timestamp
  updatedBy: string
}
\`\`\`

## Security Rules

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper function to check if the requesting user is an admin.
    // It takes the appId from the matched path as an argument for reliability.
    function isAdmin(appId) {
      return exists(/databases/$(
    }

    // Private user data - only accessible by the user themselves
    match /artifacts/{appId}/users/{userId}/{path=**} {
      // A user can always read/write their own data
      allow read, write: if request.auth.uid == userId;
      // An admin can create a driver's profile document upon approval.
      allow create: if isAdmin() && path == ["profile", "data"];
    }

    // Unauthenticated access for server-side caching of public fleet data.
    match /artifacts/{appId}/public/data/fleetCache/{document=**} {
      allow read, write: if true;
    }

    // Driver registration requests
    match /artifacts/{appId}/public/data/driverRegistrations/{regId} {
        // Anyone can create a request (for the registration page)
        allow create: if true;
        // Only admins can read or update (approve/reject) requests
        allow read, update: if request.auth != null && isAdmin();
    }

    // Public shared data (routes, assignments, etc.)
    match /artifacts/{appId}/public/data/{collection}/{docId} {
      // Any authenticated user can read public data
      allow read: if request.auth != null;

      //
    }
  }
}
\`\`\`

## Indexes Required

Create these composite indexes in Firebase Console:

1. **Routes Collection:**
  - `status` (Ascending) + `createdAt` (Descending)

2. **Bus Assignments Collection:**
  - `routeId` (Ascending) + `isActive` (Ascending)
  - `isActive` (Ascending) + `assignedAt` (Descending)

3. **Notifications Collection:**
   - `targetAudience` (Ascending) + `isActive` (Ascending) + `createdAt` (Descending)
   - `type` (Ascending) + `isActive` (Ascending)
   - `expiresAt` (Ascending) + `isActive` (Ascending)

## Environment Variables for Firebase

\`\`\`bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# App Configuration
NEXT_PUBLIC_APP_ID=bus_tracker_app
\`\`\`

## Setup Instructions

1. **Create Firebase Project:**
   - Go to Firebase Console
   - Create new project
   - Enable Firestore Database

2. **Configure Authentication:**
   - Enable Anonymous authentication
   - Optionally enable Email/Password for admin users

3. **Set Security Rules:**
   - Copy the security rules above to Firestore Rules

4. **Create Indexes:**
   - Create the composite indexes listed above

5. **Initialize Collections:**
   - The collections will be created automatically when first document is added
   - Consider adding initial admin user and app settings

This schema provides a robust foundation for the bus tracking application with proper security, scalability, and data organization.
\`\`\`

Finally, let's update the home page to remove fleet login dependency:

```typescriptreact file="app/page.tsx"
[v0-no-op-code-block-prefix]"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Bus, UserCheck, Shield, Eye, EyeOff, LogIn, MapPin, Clock, Users, Navigation, Activity, BarChart3 } from 'lucide-react'
import { FirestoreService } from "@/lib/firestore"

interface LoginFormData {
  userType: "student" | "driver" | "admin" | ""
  username: string
  password: string
}

export default function HomePage() {
  const { user, loading, userRole, setUserRole } = useAuth()
  const router = useRouter()

  // Login form state
  const [formData, setFormData] = useState<LoginFormData>({
    userType: "",
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!loading && userRole) {
      router.push(`/${userRole}/dashboard`)
    }
  }, [loading, userRole, router])

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("") // Clear error when user types
  }

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case "student":
        return <UserCheck className="h-4 w-4 text-green-600" />
      case "driver":
        return <Bus className="h-4 w-4 text-blue-600" />
      case "admin":
        return <Shield className="h-4 w-4 text-purple-600" />
      default:
        return <LogIn className="h-4 w-4 text-gray-600" />
    }
  }

  const getButtonColor = (userType: string) => {
    switch (userType) {
      case "student":
        return "bg-green-600 hover:bg-green-700"
      case "driver":
        return "bg-blue-600 hover:bg-blue-700"
      case "admin":
        return "bg-purple-600 hover:bg-purple-700"
      default:
        return "bg-gray-600 hover:bg-gray-700"
    }
  }

  const getUsernameLabel = (userType: string) => {
    switch (userType) {
      case "student":
        return "Student ID"
      case "driver":
        return "Driver Username"
      case "admin":
        return "Admin Username"
      default:
        return "Username"
    }
  }

  const getUsernamePlaceholder = (userType: string) => {
    switch (userType) {
      case "student":
        return "Enter your student ID"
      case "driver":
        return "Enter your driver username"
      case "admin":
        return "Enter your admin username"
      default:
        return "Enter your username"
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.userType) return

    setLoginLoading(true)
    setError("")

    try {
      const { username, password, userType } = formData

      if (!username || !password) {
        setError("Please fill in all required fields")
        setLoginLoading(false)
        return
      }

      // Simple validation for demo credentials
      const validCredentials = {
        student: { username: "student123", password: "demo123" },
        driver: { username: "driver123", password: "demo123" },
        admin: { username: "admin123", password: "demo123" }
      }

      const expectedCreds = validCredentials[userType]
      if (username !== expectedCreds.username || password !== expectedCreds.password) {
        setError("Invalid credentials. Please use the demo credentials provided.")
        setLoginLoading(false)
        return
      }

      // Handle Firestore profile based on role
      const firestoreService = new FirestoreService(user.uid)

      switch (userType) {
        case "student":
          const studentProfile = await firestoreService.getStudentProfile()
          if (!studentProfile) {
            await firestoreService.createStudentProfile({
              studentId: username,
              passwordHash: btoa(password),
              name: `Student ${username}`,
              assignedBusId: "demo-bus-001",
              createdAt: new Date() as any,
            })
          }
          break

        case "driver":
          const driverProfile = await firestoreService.getDriverProfile()
          if (!driverProfile) {
            await firestoreService.createDriverProfile({
              username,
              passwordHash: btoa(password),
              name: `Driver ${username}`,
              busDetails: [
                {
                  plateNumber: "DEMO-001",
                  busId: "demo-bus-001",
                },
              ],
              conductorDetails: {
                name: "Demo Conductor",
                phone: "+1234567890",
              },
              createdAt: new Date() as any,
            })
          }
          break

        case "admin":
          const adminProfile = await firestoreService.getAdminProfile()
          if (!adminProfile) {
            await firestoreService.createAdminProfile({
              username,
              passwordHash: btoa(password),
              name: `Admin ${username}`,
              createdAt: new Date() as any,
            })
          }
          break
      }

      // Set auth context and redirect
      setUserRole(userType)
      router.push(`/${userType}/dashboard`)
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err.message || "Login failed. Please try again.")
    } finally {
      setLoginLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-6">
              <Bus className="h-16 w-16 text-blue-600 mr-4" />
              <h1 className="text-5xl font-bold text-gray-900">Bus Tracker</h1>
            </div>
            <p className="text-xl text-gray-600 mb-4">
              Real-time bus tracking system for students and administrators
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center">
                <Activity className="h-4 w-4 mr-1" />
                <span>Real-time Updates</span>
              </div>
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                <span>GPS Tracking</span>
              </div>
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-1" />
                <span>Multi-user Support</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Features Section */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Features & Benefits</h2>
              <div className="grid gap-6">
                {/* Student Features */}
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-lg">
                      <UserCheck className="h-5 w-5 text-green-600 mr-2" />
                      For Students
                      <Badge variant="secondary" className="ml-2">
                        Track
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-green-600 mr-2" />
                        <span>Real-time bus location</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 text-green-600 mr-2" />
                        <span>Accurate ETA</span>
                      </div>
                      <div className="flex items-center">
                        <Navigation className="h-4 w-4 text-green-600 mr-2" />
                        <span>Distance calculation</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-green-600 mr-2" />
                        <span>Passenger count</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>


                {/* Admin Features */}
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-lg">
                      <Shield className="h-5 w-5 text-purple-600 mr-2" />
                      For Administrators
                      <Badge variant="secondary" className="ml-2">
                        Monitor
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center">
                        <BarChart3 className="h-4 w-4 text-purple-600 mr-2" />
                        <span>Fleet overview</span>
                      </div>
                      <div className="flex items-center">
                        <Activity className="h-4 w-4 text-purple-600 mr-2" />
                        <span>Real-time monitoring</span>
                      </div>
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-purple-600 mr-2" />
                        <span>User management</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 text-purple-600 mr-2" />
                        <span>Analytics dashboard</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          {/* Login Section */}
          <div className="lg:sticky lg:top-8">
            <Card className="shadow-xl border-2">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold flex items-center justify-center">
                  <LogIn className="h-6 w-6 mr-2" />
                  Sign In
                </CardTitle>
                <CardDescription className="text-base">Access your personalized dashboard</CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleLogin} className="space-y-5">
                  {/* User Type Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="userType">Select Your Role</Label>
                    <Select
                      value={formData.userType}
                      onValueChange={(value) => handleInputChange("userType", value)}
                      required
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Choose your role">
                          {formData.userType && (
                            <div className="flex items-center">
                              {getUserTypeIcon(formData.userType)}
                              <span className="ml-2 capitalize">{formData.userType}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">
                          <div className="flex items-center">
                            <UserCheck className="h-4 w-4 text-green-600 mr-2" />
                            <div>
                              <div className="font-medium">Student</div>
                              <div className="text-xs text-gray-500">Track your bus</div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 text-purple-600 mr-2" />
                            <div>
                              <div className="font-medium">Admin</div>
                              <div className="text-xs text-gray-500">Monitor fleet</div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Username/Student ID Field */}
                  {formData.userType && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="username">{getUsernameLabel(formData.userType)}</Label>
                        <Input
                          id="username"
                          type="text"
                          value={formData.username}
                          onChange={(e) => handleInputChange("username", e.target.value)}
                          placeholder={getUsernamePlaceholder(formData.userType)}
                          required
                          className="h-12"
                        />
                      </div>

                      {/* Password Field */}
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => handleInputChange("password", e.target.value)}
                            placeholder="Enter your password"
                            required
                            className="h-12 pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Login Button */}
                      <Button
                        type="submit"
                        className={`w-full h-12 ${getButtonColor(formData.userType)}`}
                        disabled={loginLoading || !formData.userType}
                      >
                        {loginLoading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Signing in...
                          </div>
                        ) : (
                          <div className="flex items-center">
                            {getUserTypeIcon(formData.userType)}
                            <span className="ml-2">Sign In as {formData.userType}</span>
                          </div>
                        )}
                      </Button>
                    </>
                  )}
                </form>

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Demo Credentials */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
                    <LogIn className="h-4 w-4 mr-1" />
                    Demo Credentials
                  </h4>
                  <div className="text-xs text-blue-800 space-y-2">
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center">
                        <UserCheck className="h-3 w-3 text-green-600 mr-1" />
                        <span className="font-medium">Student:</span>
                      </div>
                      <span className="font-mono">student123 / demo123</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border">
                      <div className="flex items-center">
                        <Shield className="h-3 w-3 text-purple-600 mr-1" />
                        <span className="font-medium">Admin:</span>
                      </div>
                      <span className="font-mono">admin123 / demo123</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-center text-xs text-gray-500 space-y-1">
                  <p>User ID: {user?.uid || "Not authenticated"}</p>
                  <p>Environment: {process.env.NODE_ENV}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
