import { Agent } from "undici"

export interface DeviceStatus {
  id: string
  vid: string | null // Plate Number
  lng: number // Raw Lng (needs division by 1,000,000)
  lat: number // Raw Lat (needs division by 1,000,000)
  mlng: string // Map Lng (already converted)
  mlat: string // Map Lat (already converted)
  gt: string // GPS Upload Time
  ol: number
  s1: string
  s2: number
  s3: number
  s4: number
  ps: string
  sp: number
  hx: number
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

export interface DeviceIdentifier {
  vid: string // Plate Number
  type: number // 1 for video, 0 for gps
  did: string // Device No.
}

// In development, we might face issues with self-signed or corporate proxy certificates.
// This agent will bypass SSL certificate verification.
// IMPORTANT: This should ONLY be used for local development and NOT in production.
const devDispatcher =
  process.env.NODE_ENV === "development"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined

export class FleetAPI {
  private static readonly baseUrl = process.env.NEXT_PUBLIC_FLEET_API_BASE_URL || "https://fleet.lagaam.in";
  private jsessionToken: string

  constructor(jsessionToken: string) {
    this.jsessionToken = jsessionToken
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    const url = new URL(`${FleetAPI.baseUrl}/${endpoint}`)
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
      headers: {
        Cookie: `JSESSIONID=${this.jsessionToken}`,
      },
      ...(devDispatcher && { dispatcher: devDispatcher }),
    })

    if (!response.ok) {
      throw new Error(`Fleet API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getDeviceStatus(devIdno: string = "000088832714", toMap = true): Promise<DeviceStatus[]> {
    const params: Record<string, string> = {}
    params.devIdno = devIdno
    if (toMap) params.toMap = "1"

    const response = await this.makeRequest("StandardApiAction_getDeviceStatus.action", params)
    if (response.result !== 0) {
      throw new Error(`Fleet API returned an error for getDeviceStatus. Result code: ${response.result}`)
    }
    return response.status || []
  }

  async getDeviceByVehicle(vehiIdno: string): Promise<DeviceIdentifier[]> {
    const params = { vehiIdno }
    const response = await this.makeRequest("StandardApiAction_getDeviceByVehicle.action", params)
    if (response.result !== 0) {
      throw new Error(`Fleet API returned an error for getDeviceByVehicle. Result code: ${response.result}`)
    }
    return response.devices || []
  }

  async queryTrackDetail(devIdno: string, begintime: string, endtime: string): Promise<DeviceStatus[]> {
    const params = {
      devIdno,
      begintime,
      endtime,
      toMap: "1", // Convert to Google Maps coordinates
    }
    const response = await this.makeRequest("StandardApiAction_queryTrackDetail.action", params)
    if (response.result !== 0) {
      throw new Error(`Fleet API returned an error for queryTrackDetail. Result code: ${response.result}`)
    }
    return response.tracks || []
  }

  async getUserVehicles(): Promise<Vehicle[]> {
    const response = await this.makeRequest("StandardApiAction_queryUserVehicle.action")
    if (response.result !== 0) {
      throw new Error(`Fleet API returned an error for getUserVehicles. Result code: ${response.result}`)
    }

    // Defensive check to ensure the 'vehicles' property is an array.
    if (response.vehicles && !Array.isArray(response.vehicles)) {
      // This handles cases where the API returns a single object for a single vehicle.
      console.warn("Fleet API returned a single vehicle object instead of an array. Wrapping it.")
      return [response.vehicles]
    }
    return response.vehicles || []
  }

  static async login(username: string, password: string): Promise<string> {
    const response = await fetch(`${FleetAPI.baseUrl}/StandardApiAction_login.action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username,
        password,
      }),
      ...(devDispatcher && { dispatcher: devDispatcher }),
    })

    if (!response.ok) {
      // Provide more specific feedback based on the status code
      if (response.status === 401 || response.status === 403) {
        throw new Error("Invalid username or password.")
      }
      throw new Error(`Login failed with status: ${response.status}`)
    }

    // Extract JSESSIONID from response cookies
    const cookies = response.headers.get("set-cookie")
    const jsessionMatch = cookies?.match(/JSESSIONID=([^;]+)/)

    if (!jsessionMatch) {
      throw new Error("Login successful, but no session token was received from the server.")
    }

    return jsessionMatch[1]
  }
}
