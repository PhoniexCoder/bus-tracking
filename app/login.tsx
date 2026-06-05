"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Timestamp } from "firebase/firestore"
import { FirestoreService } from "@/lib/firestore"
import { signInWithEmailAndPassword, type User } from "firebase/auth"
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

  const [formData, setFormData] = useState<LoginFormData>({
    userType: "parent",
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [particles, setParticles] = useState<{ id: number; size: number; left: number; top: number; duration: number; delay: number }[]>([])

  useEffect(() => {
    if (!loading && userRole) {
      router.push(`/${userRole}/dashboard`)
    }
  }, [loading, userRole, router])

  useEffect(() => {
    const message = searchParams.get("message")
    if (message) setSuccessMessage(message)

    const role = searchParams.get("role")
    if (role === "parent" || role === "admin") {
      setFormData((prev) => ({ ...prev, userType: role }))
    }
  }, [searchParams])

  useEffect(() => {
    const list = Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * -10,
    }))
    setParticles(list)
  }, [])

  const handleInputChange = (field: keyof LoginFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
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

      let firebaseUser: User | null = null
      const authDomain = config.firebase.authDomain || "example.com"
      const fakeEmail = `${username.toLowerCase().trim()}@${authDomain}`

      try {
        const userCredential = await signInWithEmailAndPassword(auth, fakeEmail, password)
        firebaseUser = userCredential.user
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          throw new Error(`Account not found for "${username}". Contact an administrator to create your account.`)
        }
        if (err.code === "auth/invalid-credential") {
          throw new Error(`Invalid username or password for ${userType}.`)
        }
        if (err.code === "auth/too-many-requests") {
          throw new Error("Too many login attempts. Please try again later.")
        }
        throw err
      }

      if (!firebaseUser) throw new Error("Authentication session is invalid. Please try again.")

      const firestoreService = new FirestoreService(firebaseUser.uid)

      switch (userType) {
        case "parent": {
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
        }
        case "admin": {
          const adminProfile = await firestoreService.getAdminProfile()
          if (!adminProfile) {
            await firestoreService.createAdminProfile({
              username,
              name: `Admin ${username}`,
              createdAt: Timestamp.now(),
            })
          }
          break
        }
      }

      const fbIdToken = await firebaseUser.getIdToken()
      const sessionRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: fbIdToken, role: userType }),
      })
      if (!sessionRes.ok) {
        throw new Error("Failed to establish session. Please try again.")
      }

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
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5e5ce6]"></div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-[#0A0A0B] text-[#e2e2e7]">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0% { transform: translateY(100px) translateX(0); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: translateY(-100vh) translateX(15px); opacity: 0; }
        }
        .floating-label-input label {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .floating-label-input:focus-within label,
        .floating-label-input input:not(:placeholder-shown) + label {
          transform: translateY(-18px) scale(0.85) !important;
          color: #c2c1ff !important;
          background-color: #0c0e12;
          padding: 0 6px;
        }
      ` }} />

      <div className="fixed inset-0 bg-mesh z-0 pointer-events-none"></div>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#5e5ce6]/10 blur-[120px] rounded-full z-0 pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#5e5ce6]/5 blur-[120px] rounded-full z-0 pointer-events-none"></div>

      <main className="relative z-10 w-full max-w-[440px]">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#5e5ce6] shadow-[0_0_30px_rgba(94,92,230,0.4)] mb-4">
            <span className="material-symbols-outlined text-[#f4f1ff] text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>directions_bus</span>
          </div>
          <h1 className="text-2xl font-bold text-[#c2c1ff] tracking-tight">OmniBus Command</h1>
          <p className="text-sm text-[#c7c4d7] mt-1">Secure Gateway for Student Safety</p>
        </header>

        <div className="glass-card rounded-[32px] p-8 md:p-10">
          <div className="mb-8">
            <div className="role-track relative flex p-1 rounded-2xl h-12 items-center">
              <div 
                className="role-slider absolute top-1 bottom-1 w-[48%] bg-[#5e5ce6] rounded-xl active-role-glow" 
                style={{ left: formData.userType === "admin" ? "51%" : "1%" }}
              />
              <button 
                type="button"
                className={`relative z-10 flex-1 text-center text-sm font-medium transition-colors ${formData.userType === "parent" ? "text-[#f4f1ff]" : "text-[#c7c4d7] hover:text-[#e2e2e7]"}`} 
                onClick={() => handleInputChange("userType", "parent")}
              >
                Parent / Student
              </button>
              <button 
                type="button"
                className={`relative z-10 flex-1 text-center text-sm font-medium transition-colors ${formData.userType === "admin" ? "text-[#f4f1ff]" : "text-[#c7c4d7] hover:text-[#e2e2e7]"}`} 
                onClick={() => handleInputChange("userType", "admin")}
              >
                Admin
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="floating-label-input relative input-glow border border-[#333539]/40 rounded-xl bg-[#0c0e12]/50 transition-all duration-300">
              <input 
                className="block w-full px-4 pt-6 pb-2 bg-transparent border-none focus:ring-0 text-[#e2e2e7] text-base" 
                id="username" 
                placeholder=" " 
                required 
                type="text"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
              />
              <label 
                className="absolute left-4 top-4 text-[#c7c4d7] text-base transition-all pointer-events-none origin-left" 
                htmlFor="username"
              >
                {formData.userType === "parent" ? "Parent ID / Student ID" : "Admin Username"}
              </label>
              <div className="absolute right-4 top-4 text-[#c7c4d7]">
                <span className="material-symbols-outlined text-xl">account_circle</span>
              </div>
            </div>

            <div className="floating-label-input relative input-glow border border-[#333539]/40 rounded-xl bg-[#0c0e12]/50 transition-all duration-300">
              <input 
                className="block w-full px-4 pt-6 pb-2 bg-transparent border-none focus:ring-0 text-[#e2e2e7] text-base" 
                id="password" 
                placeholder=" " 
                required 
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
              />
              <label 
                className="absolute left-4 top-4 text-[#c7c4d7] text-base transition-all pointer-events-none origin-left" 
                htmlFor="password"
              >
                Password
              </label>
              <div 
                className="absolute right-4 top-4 text-[#c7c4d7] cursor-pointer hover:text-[#c2c1ff] transition-colors" 
                onClick={() => setShowPassword(!showPassword)}
              >
                <span className="material-symbols-outlined text-xl" id="pass-icon">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center cursor-pointer group">
                <input 
                  className="w-5 h-5 rounded border-[#333539] bg-[#1e2023] text-[#5e5ce6] focus:ring-[#5e5ce6] focus:ring-offset-[#0A0A0B]" 
                  type="checkbox"
                />
                <span className="ml-2 text-sm text-[#c7c4d7] group-hover:text-[#e2e2e7] transition-colors">Remember me</span>
              </label>
              <a className="text-sm text-[#5e5ce6] hover:text-[#c2c1ff] transition-colors underline-offset-4 hover:underline" href="#">Forgot Password?</a>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-950/40 border-red-500/30 text-red-400 rounded-xl">
                <AlertDescription className="font-semibold text-center text-xs">{error}</AlertDescription>
              </Alert>
            )}
            {successMessage && (
              <Alert variant="default" className="bg-green-950/40 border-green-500/30 text-green-400 rounded-xl">
                <AlertDescription className="font-semibold text-center text-xs">{successMessage}</AlertDescription>
              </Alert>
            )}

            <button 
              className="w-full h-14 bg-[#5e5ce6] text-[#f4f1ff] text-lg font-semibold rounded-2xl shadow-[0_8px_20px_rgba(94,92,230,0.3)] hover:shadow-[0_12px_24px_rgba(94,92,230,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center" 
              type="submit"
              disabled={loginLoading}
            >
              {loginLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-white" />
                  <span>Securing session...</span>
                </div>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>

          <footer className="mt-8 text-center">
            <p className="text-sm text-[#c7c4d7]">
              New to the system?{" "}
              <a className="text-[#c2c1ff] font-semibold hover:underline underline-offset-4" href="#">Request Access</a>
            </p>
          </footer>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 opacity-50">
          <span className="material-symbols-outlined text-sm">lock</span>
          <span className="text-xs uppercase tracking-widest">End-to-End Encrypted Session</span>
        </div>
      </main>

      <div className="fixed inset-0 pointer-events-none z-5">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute bg-[#c2c1ff]/10 rounded-full blur-[1px]"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              top: `${p.top}%`,
              animation: `float ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
