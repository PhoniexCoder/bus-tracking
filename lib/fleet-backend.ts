// Backend-only fleet service (server-side)
import { Agent } from "undici"

const FLEET_API_ERROR_MESSAGES: Record<number, string> = {
  1: "Request parameter error.",
  2: "No permissions to operate.",
  3: "The requested device does not exist.",
  4: "The requested device is not online.",
  5: "The requested vehicle does not exist.",
  6: "The requested user does not exist.",
  7: "Session expired or invalid.",
  8: "No vehicle operation authority!", // Added based on user feedback
}

import { Vehicle } from "@/lib/fleet-api"
import type { DeviceIdentifier, DeviceStatus } from "@/lib/fleet-types"

export type { DeviceIdentifier, DeviceStatus }

const devDispatcher =
  process.env.NODE_ENV === "development"
    ? new Agent({ connect: { rejectUnauthorized: false } })
    : undefined

class FleetBackendService {
  private static instance: FleetBackendService
  private currentSession: any | null = null
  private baseUrl: string
  private username: string
  private password: string

  private constructor() {
    this.baseUrl = process.env.FLEET_API_BASE_URL || "https://fleet.lagaam.in"
    this.username = process.env.FLEET_USERNAME || ""
    this.password = process.env.FLEET_PASSWORD || ""

    if (!this.username || !this.password) {
      console.error("Fleet credentials not configured in environment variables")
    }
  }

  public static getInstance(): FleetBackendService {
    if (!FleetBackendService.instance) {
      FleetBackendService.instance = new FleetBackendService()
    }
    return FleetBackendService.instance
  }

  private getFleetApiErrorMessage(code: number, context: string): string {
    const message = FLEET_API_ERROR_MESSAGES[code] || `An unknown error occurred`
    return `Fleet API Error (${context}): ${message} (Result Code: ${code})`
  }

  private async authenticate(): Promise<string> {
    try {
      // Try GET login with query params (returns JSON with jsession)
      const loginUrl = new URL(`${this.baseUrl}/StandardApiAction_login.action`)
      loginUrl.searchParams.set("account", this.username)
      loginUrl.searchParams.set("password", this.password)
      const respGet = await fetch(loginUrl.toString(), {
        method: "GET",
        ...(devDispatcher && { dispatcher: devDispatcher }),
      })
      if (respGet.ok) {
        try {
          const body = await respGet.json()
          if (body?.jsession) {
            const jsessionId = body.jsession as string
            this.currentSession = {
              jsessionId,
              mode: "query", // use jsession as query param
              expiresAt: new Date(Date.now() + 60 * 60 * 1000),
            }
            console.log("Fleet authentication (GET) successful")
            return jsessionId
          }
        } catch { }
      }

      // Fallback to POST expecting Set-Cookie header (some deployments support this)
      const response = await fetch(`${this.baseUrl}/StandardApiAction_login.action`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: this.username, password: this.password }),
        ...(devDispatcher && { dispatcher: devDispatcher }),
      })
      if (!response.ok) throw new Error(`Fleet authentication failed: ${response.statusText}`)
      const cookies = response.headers.get("set-cookie")
      const jsessionMatch = cookies?.match(/JSESSIONID=([^;]+)/)
      if (!jsessionMatch) throw new Error("No session token received from fleet API")
      const jsessionId = jsessionMatch[1]
      this.currentSession = {
        jsessionId,
        mode: "cookie", // will send Cookie header
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }
      console.log("Fleet authentication (POST) successful")
      return jsessionId
    } catch (error) {
      console.error("Fleet authentication error:", error)
      throw error
    }
  }
  /**
   * Fetches device status for one or more device IDs.
   * @param devIdno Comma-separated device IDs (string) or undefined for all
   * @param toMap Whether to return map coordinates (default: true)
   */
  async getDeviceStatus(devIdno?: string, toMap: boolean = true): Promise<DeviceStatus[]> {
    const params: Record<string, string> = {};
    if (devIdno) params["devIdno"] = devIdno;
    if (toMap) params["toMap"] = "1";

    const response = await this.makeRequest("StandardApiAction_getDeviceStatus.action", params);
    if (response.result !== 0) {
      throw new Error(this.getFleetApiErrorMessage(response.result, "getDeviceStatus"));
    }
    return response.status || [];
  }

  private async getValidSession(): Promise<string> {
    if (!this.currentSession || this.currentSession.expiresAt < new Date()) {
      this.currentSession = null;
      return await this.authenticate();
    }
    return this.currentSession.jsessionId;
  }

  private async makeRequest(endpoint: string, params: Record<string, string> = {}) {
    const doFetch = async (sessionId: string) => {
      try {
        const url = new URL(`${this.baseUrl}/${endpoint}`)
        Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value))
        // If session mode is query, attach jsession param; else send Cookie header
        const useQuery = this.currentSession?.mode === "query"
        if (useQuery) url.searchParams.set("jsession", sessionId)

        const response = await fetch(url.toString(), {
          headers: useQuery
            ? { 'Content-Type': 'application/x-www-form-urlencoded' }
            : { Cookie: `JSESSIONID=${sessionId}; Path=/;`, 'Content-Type': 'application/x-www-form-urlencoded' },
          ...(devDispatcher && { dispatcher: devDispatcher }),
        })

        if (!response.ok) return null;

        const data = await response.json();
        if (data.result === 7) {
          console.log('Session expired detected in response');
          return { needsReauth: true };
        }
        return data;
      } catch (error) {
        console.error('API request failed:', error);
        return null;
      }
    };

    let attempt = 0;
    let response;
    while (attempt < 5) {
      const sessionId = await this.getValidSession();
      response = await doFetch(sessionId);

      console.log(`Attempt ${attempt + 1} session status:`, {
        sessionId: sessionId.slice(0, 8),
        expiresAt: this.currentSession?.expiresAt.toISOString(),
        validFor: Math.round((this.currentSession.expiresAt - Date.now()) / 1000) + 's'
      });

      if (!response?.needsReauth) break;

      console.log(`Session expired - clearing and retrying (${attempt + 1}/5)`);
      this.currentSession = null;
      attempt++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!response || response.result !== 0) {
      throw new Error(`API request failed after ${attempt + 1} attempts`);
    }

    return response;
  }

  /**
   * Fetches the status for vehicles by their plate numbers.
   * This is a two-step process: first get device ID from plate number, then get status from device ID.
   */
  async getVehicleStatusesByPlateNumber(plateNumbers: string[]): Promise<DeviceStatus[]> {
    if (plateNumbers.length === 0) {
      return []
    }

    // 1. Get device IDs from plate numbers
    const deviceIdResponse = await this.makeRequest("StandardApiAction_getDeviceByVehicle.action", {
      vehiIdno: plateNumbers.join(","),
    })

    if (deviceIdResponse.result !== 0) {
      throw new Error(this.getFleetApiErrorMessage(deviceIdResponse.result, "getDeviceByVehicle"))
    }

    const deviceIds = deviceIdResponse.devices?.map((d: any) => d.did).filter(Boolean)
    if (!deviceIds || deviceIds.length === 0) {
      console.log("No device IDs found for the given plate numbers");
      return []
    }

    // 2. Get device statuses from device IDs
    const statusResponse = await this.makeRequest("StandardApiAction_getDeviceStatus.action", {
      devIdno: deviceIds.join(","),
      toMap: "1",
    })

    if (statusResponse.result !== 0) {
      throw new Error(this.getFleetApiErrorMessage(statusResponse.result, "getDeviceStatus"))
    }

    return statusResponse.status || []
  }

  async getDeviceByVehicle(vehiIdno: string): Promise<DeviceIdentifier[]> {
    const response = await this.makeRequest("StandardApiAction_getDeviceByVehicle.action", {
      vehi_idno: vehiIdno,
      query_type: "1",
      show_type: "3",
      page: "1",
      rows: "100"
    });

    if (response.result !== 0 || !response.devices) {
      console.error('Device API Error:', JSON.stringify(response, null, 2));
      throw new Error(this.getFleetApiErrorMessage(response.result, "getDeviceByVehicle"));
    }

    return response.devices.map((device: any) => ({
      vid: device.vehi_idno,
      did: device.dev_idno,
      type: device.device_type
    }));
  }

  async getUserVehicles(): Promise<Vehicle[]> {
    const response = await this.makeRequest("StandardApiAction_queryUserVehicle.action")
    if (response.result !== 0) {
      throw new Error(this.getFleetApiErrorMessage(response.result, "getUserVehicles"))
    }

    // Defensive check to ensure the 'vehicles' property is an array.
    if (response.vehicles && !Array.isArray(response.vehicles)) {
      // This handles cases where the API returns a single object for a single vehicle.
      console.warn("Fleet API returned a single vehicle object instead of an array. Wrapping it.")
      return [response.vehicles]
    }
    return response.vehicles || []
  }
}

export const fleetBackend = FleetBackendService.getInstance()
