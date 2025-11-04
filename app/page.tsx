'use client'

import type React from "react"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { Bus, UserCheck, Shield, MapPin, Clock, Users, Navigation, Activity, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import LoginPage from "./login"

export default function HomePage() {
  const { loading } = useAuth()

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
              Real-time bus tracking system for students, drivers, and administrators
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
                {/* Parent Features */}
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-lg">
                      <UserCheck className="h-5 w-5 text-green-600 mr-2" />
                      For Parents
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
          <LoginPage />
        </div>
      </div>
    </div>
  )
}