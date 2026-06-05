"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"

export interface SsoUser {
  sub: string
  role: "admin" | "parent" | "student"
  email?: string
  name?: string
}

interface AuthContextType {
  user: SsoUser | null
  loading: boolean
  userRole: "student" | "parent" | "admin" | null
  setUserRole: (role: "student" | "parent" | "admin" | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SsoUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, _setUserRole] = useState<"student" | "parent" | "admin" | null>(null)

  const setUserRole = useCallback((role: "student" | "parent" | "admin" | null) => {
    _setUserRole(role)
    if (role) {
      localStorage.setItem("userRole", role)
    } else {
      localStorage.removeItem("userRole")
    }
  }, [])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user)
          const storedRole = localStorage.getItem("userRole") as "student" | "parent" | "admin" | null
          _setUserRole(data.user.role || storedRole)
        } else {
          setUser(null)
          _setUserRole(null)
        }
      })
      .catch(() => {
        setUser(null)
        _setUserRole(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      setUserRole(null)
    } catch (error) {
      console.error("Logout error:", error)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        userRole,
        setUserRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
