"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BackendTestPage() {
  const [results, setResults] = useState<any[]>([])
  const [testing, setTesting] = useState(false)

  const addResult = (test: string, status: string, details: any) => {
    setResults(prev => [...prev, { test, status, details, timestamp: new Date().toISOString() }])
  }

  const runTests = async () => {
    setResults([])
    setTesting(true)

    // Test 1: Backend health check (no auth)
    try {
      addResult("Health Check", "RUNNING", "Testing /api/health...")
      const response = await fetch("http://localhost:8000/api/health")
      const data = await response.json()
      addResult("Health Check", response.ok ? "PASS" : "FAIL", { status: response.status, data })
    } catch (err: any) {
      addResult("Health Check", "ERROR", err.message)
    }

    // Test 2: Backend root endpoint
    try {
      addResult("Root Endpoint", "RUNNING", "Testing /...")
      const response = await fetch("http://localhost:8000/")
      const data = await response.json()
      addResult("Root Endpoint", response.ok ? "PASS" : "FAIL", { status: response.status, data })
    } catch (err: any) {
      addResult("Root Endpoint", "ERROR", err.message)
    }

    // Test 3: Login
    try {
      addResult("Login", "RUNNING", "Testing /auth/login with admin/admin123...")
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" })
      })
      const data = await response.json()
      addResult("Login", response.ok ? "PASS" : "FAIL", { status: response.status, data })

      // Test 4: Authenticated request if login succeeded
      if (response.ok && data.access_token) {
        try {
          addResult("Authenticated Request", "RUNNING", "Testing /api/liveplate_all with token...")
          const authResponse = await fetch("http://localhost:8000/api/liveplate_all", {
            headers: { "Authorization": `Bearer ${data.access_token}` }
          })
          const authData = await authResponse.json()
          addResult("Authenticated Request", authResponse.ok ? "PASS" : "FAIL", { 
            status: authResponse.status, 
            busCount: Array.isArray(authData) ? authData.length : 0,
            data: authData 
          })
        } catch (err: any) {
          addResult("Authenticated Request", "ERROR", err.message)
        }
      }
    } catch (err: any) {
      addResult("Login", "ERROR", err.message)
    }

    setTesting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Backend Connection Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={runTests} disabled={testing}>
                {testing ? "Testing..." : "Run Tests"}
              </Button>
              <Button variant="outline" onClick={() => setResults([])}>
                Clear Results
              </Button>
            </div>

            <div className="space-y-2">
              {results.map((result, idx) => (
                <Card key={idx} className={
                  result.status === "PASS" ? "border-green-500" :
                  result.status === "FAIL" ? "border-red-500" :
                  result.status === "ERROR" ? "border-orange-500" :
                  "border-blue-500"
                }>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{result.test}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        result.status === "PASS" ? "bg-green-100 text-green-800" :
                        result.status === "FAIL" ? "bg-red-100 text-red-800" :
                        result.status === "ERROR" ? "bg-orange-100 text-orange-800" :
                        "bg-blue-100 text-blue-800"
                      }`}>
                        {result.status}
                      </span>
                    </div>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                    <div className="text-xs text-gray-500 mt-1">{result.timestamp}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {results.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                Click "Run Tests" to check backend connectivity
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
