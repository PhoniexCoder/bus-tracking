"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { onAuthStateChanged, signInAnonymously, signOut, type Auth, type User } from "firebase/auth"
import type { Firestore } from 'firebase/firestore';
import { auth, db } from "@/lib/firebase" // Import pre-initialized auth and db
import { config } from "@/lib/config" // Import config for app ID

interface AuthContextType {
  user: User | null
  loading: boolean
  userRole: "student" | "parent" | "admin" | null
  setUserRole: (role: "student" | "parent" | "admin" | null) => void
  logout: () => Promise<void>
  db: Firestore;
  appId: string;
  auth: Auth; // Add auth instance to context type for direct use if needed
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, _setUserRole] = useState<"student" | "parent" | "admin" | null>(null)

  // Wrap setUserRole to make it a stable dependency and persist the role to localStorage
  const setUserRole = useCallback((role: "student" | "parent" | "admin" | null) => {
    _setUserRole(role)
    if (role) {
      localStorage.setItem("userRole", role)
    } else {
      localStorage.removeItem("userRole")
    }
  }, [])

  useEffect(() => {
    // When external ERP auth is enabled, try to hydrate role from URL/localStorage early
    if (config.auth.externalEnabled) {
      try {
        const url = typeof window !== "undefined" ? new URL(window.location.href) : null
        const roleParam = url?.searchParams.get("role")
        const initialRole = (roleParam || localStorage.getItem("userRole")) as "student" | "parent" | "admin" | null
        if (initialRole === "student" || initialRole === "parent" || initialRole === "admin") {
          _setUserRole(initialRole)
          localStorage.setItem("userRole", initialRole)
        }
      } catch { }
    }

    // Firebase is now initialized globally, so we just need the listener.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user)
        // On initial load or user change, try to get the role from localStorage
        const storedRole = localStorage.getItem("userRole") as "student" | "parent" | "admin" | null
        if (storedRole) {
          _setUserRole(storedRole)
        }
      } else {
        // Clear any lingering role from state and localStorage
        setUserRole(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUserRole])

  const logout = async () => {
    try {
      // 1. Call the backend to clear the secure httpOnly session cookie (if applicable)
      // This fetch call assumes you have an /api/auth/logout endpoint
      await fetch("/api/auth/logout", { method: "POST" }).catch(e => console.error("Backend logout failed:", e));

      // 2. Sign out the current Firebase user (even if anonymous).
      // This will trigger onAuthStateChanged, which will then create a new anonymous user,
      // effectively cycling the session.
      await signOut(auth)
    } catch (error) {
      console.error("Logout error:", error)
      // You could set an error state here to show in the UI
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
        db,
        appId: config.app.id,
        auth,
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
