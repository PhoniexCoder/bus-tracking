"use client"

import type React from "react"
import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { UserCheck, Shield, Eye, EyeOff, LogIn } from "lucide-react"
import { Timestamp } from "firebase/firestore"
import { FirestoreService } from "@/lib/firestore"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type User } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { config } from "@/lib/config"

interface LoginFormData {
  userType: "parent" | "admin" | ""
  username: string
  password: string
}

export default function LoginPage() {
  const { user, loading, userRole, setUserRole } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Login form state
  const [formData, setFormData] = useState<LoginFormData>({
    userType: "",
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  useEffect(() => {
    if (!loading && userRole) {
      router.push(`/${userRole}/dashboard`)
    }
  }, [loading, userRole, router])

  useEffect(() => {
    const message = searchParams.get("message")
    if (message) setSuccessMessage(message)

    // Preselect role from query string, if provided
    const role = searchParams.get("role")
      if (role === "parent" || role === "admin") {
      setFormData((prev) => ({ ...prev, userType: role }))
    }
  }, [searchParams])

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("") // Clear error when user types
  }

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case "parent":
        return <UserCheck className="h-4 w-4 text-green-600" />
      case "admin":
        return <Shield className="h-4 w-4 text-purple-600" />
      default:
        return <LogIn className="h-4 w-4 text-gray-600" />
    }
  }

  const getButtonColor = (userType: string) => {
    switch (userType) {
      case "parent":
        return "bg-green-600 hover:bg-green-700"
      case "admin":
        return "bg-purple-600 hover:bg-purple-700"
      default:
        return "bg-gray-600 hover:bg-gray-700"
    }
  }

  const getUsernameLabel = (userType: string) => {
    switch (userType) {
      case "parent":
        return "Parent ID"
      case "admin":
        return "Admin Username"
      default:
        return "Username"
    }
  }

  const getUsernamePlaceholder = (userType: string) => {
    switch (userType) {
      case "parent":
        return "Enter your parent ID"
      case "admin":
        return "Enter your admin username"
      default:
        return "Enter your username"
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.userType) return

    setLoginLoading(true)
    setError("")

    try {
      const { username, password, userType } = formData

      if (!username || !password) {
        setError("Please fill in all required fields")
        setLoginLoading(false)
        return
      }

      let firebaseUser: User | null = user

      // 1. Authenticate using Firebase Auth for both parent and admin
      // Build a deterministic email for auth using configured Firebase auth domain
      const authDomain = config.firebase.authDomain || "example.com"
      const fakeEmail = `${username.toLowerCase().trim()}@${authDomain}`

      try {
        const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password)
        firebaseUser = userCredential.user
      } catch (error: any) {
        // Special case: Create the first user if they don't exist
        if (
          (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found")
        ) {
          console.log(`Attempting to create first ${userType} user...`)
          const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password)
          firebaseUser = userCredential.user
          setSuccessMessage(`First ${userType} account created successfully! Logging in...`)
        } else {
          // Re-throw other errors
          if (error.code === "auth/invalid-credential") {
            throw new Error(`Invalid username or password for ${userType}.`)
          }
          throw error
        }
      }

      if (!firebaseUser) throw new Error("Authentication session is invalid. Please try again.")

      // 2. Handle Firestore profile creation for first-time users
      const firestoreService = new FirestoreService(firebaseUser.uid)

      switch (userType) {
        case "parent":
          const studentProfile = await firestoreService.getStudentProfile()
          if (!studentProfile) {
            await firestoreService.createStudentProfile({
              studentId: username,
              username: username,
              name: `Student ${username}`,
              assignedBusId: "demo-bus-001",
              createdAt: Timestamp.now(),
            })
          }
          break
        case "admin":
          const adminProfile = await firestoreService.getAdminProfile()
          // If the profile doesn't exist (which happens right after the first admin is created), create it.
          if (!adminProfile) {
            await firestoreService.createAdminProfile({
              username,
              name: `Admin ${username}`,
              createdAt: Timestamp.now(),
            })
          }
          break
      }

      // 3. Set auth context and redirect on successful login
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
                  <SelectItem value="parent">
                    <div className="flex items-center">
                      <UserCheck className="h-4 w-4 text-green-600 mr-2" />
                      <div>
                        <div className="font-medium">Parent</div>
                        <div className="text-xs text-gray-500">Track bus for your child</div>
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

          {successMessage && (
            <Alert variant="default" className="mt-4 bg-green-50 border-green-200 text-green-800">
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          <div className="mt-4 text-center text-xs text-gray-500 space-y-1">
            <p>User ID: {user?.uid || "Not authenticated"}</p>
            <p>Environment: {process.env.NODE_ENV}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
