'use client'

import React, { useEffect, useState } from 'react'
import { fleetClient, Vehicle } from '@/lib/fleet-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bus, MapPin } from 'lucide-react'

export default function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true)
        const fetchedVehicles = await fleetClient.getVehicles()
        setVehicles(fetchedVehicles)
      } catch (err: any) {
        setError(err.message || 'Failed to fetch vehicles')
      } finally {
        setLoading(false)
      }
    }

    fetchVehicles()
  }, [])

  if (loading) {
    return <div className="text-center text-gray-600">Loading vehicles...</div>
  }

  if (error) {
    return <div className="text-center text-red-600">Error: {error}</div>
  }

  if (vehicles.length === 0) {
    return <div className="text-center text-gray-600">No vehicles found for your account.</div>
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle) => (
        <Card key={vehicle.id} className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              <Bus className="h-5 w-5 text-blue-600 mr-2" />
              {vehicle.nm}
              <Badge variant="secondary" className="ml-2">
                ID: {vehicle.id}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 text-blue-600 mr-2" />
                <span>Company: {vehicle.pnm}</span>
              </div>
              <div className="flex items-center">
                <span>Devices: {vehicle.dl.map(device => device.id).join(', ')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
