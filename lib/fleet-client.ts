// Frontend service to interact with backend fleet APIs
export interface DeviceStatus {
  id: string // Device No.
  vid: string | null // Plate Number
  lng: number // Raw Lng (needs division by 1,000,000)
  lat: number // Raw Lat (needs division by 1,000,000)
  mlng: string // Map Lng (already converted)
  mlat: string // Map Lat (already converted)
  gt: string // GPS Upload Time
  ol: number // Online Status: 1 means online
  s1: string // Status 1, which we assume is passenger count
  s2: number // Status 2
  s3: number // Status 3
  s4: number // Status 4
  ps: string // Geographical Position string
  sp: number // Speed
  hx: number // Direction
  lc: number // Mileage (meters)
  yl: number // Fuel (needs division by 100)
  // dn and jn removed (driver fields)
}

interface Device {
  id: string
  pid: number
  ic: number
  io: string
  cc: number
  cn: string
  tc: number
  tn: string
  md: number
  sim: string | null
}

export interface DeviceIdentifier {
  vid: string
  did: string
  type: number
}

export interface Vehicle {
  id: number
  nm: string
  dl: Device[]
  ic: number
  pid: number
  pnm: string
  pt: string
  vehicleType: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

export class FleetClientService {
  private baseUrl = "/api/fleet"

  async getVehicles(): Promise<Vehicle[]> {
    try {
      const response = await fetch(`${this.baseUrl}/vehicles`)
      const result: ApiResponse<Vehicle[]> = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch vehicles")
      }

      return result.data || []
    } catch (error) {
      console.error("Error fetching vehicles:", error)
      throw error
    }
  }

  async getDeviceStatus(devIdno?: string, toMap = true): Promise<DeviceStatus[]> {
    try {
      const params = new URLSearchParams()
      if (devIdno) params.append("devIdno", devIdno)
      if (toMap) params.append("toMap", "true")

      const response = await fetch(`${this.baseUrl}/device-status?${params}`)
      const result: ApiResponse<DeviceStatus[]> = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch device status")
      }

      return result.data || []
    } catch (error) {
      console.error("Error fetching device status:", error)
      throw error
    }
  }

  async getDeviceByVehicle(vehiIdno: string): Promise<DeviceIdentifier[]> {
    try {
      const response = await fetch(`${this.baseUrl}/device-by-vehicle?vehiIdno=${vehiIdno}`)
      const result: ApiResponse<DeviceIdentifier[]> = await response.json()

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch devices by vehicle")
      }

      return result.data || []
    } catch (error) {
      console.error("Error fetching devices by vehicle:", error)
      throw error
    }
  }
}

export const fleetClient = new FleetClientService()
