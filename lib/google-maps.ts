import { config } from "./config"

export interface LatLng {
  lat: number
  lng: number
}

export interface DirectionsResult {
  distance: string
  duration: string
  steps: any[]
  polyline: LatLng[]
}

export class GoogleMapsService {
  private apiKey: string

  constructor() {
    this.apiKey = config.googleMaps.apiKey || "YOUR_GOOGLE_MAPS_API_KEY"

    if (!config.googleMaps.apiKey) {
      console.warn("Google Maps API key (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) not found in environment variables.")
    }
  }

  async calculateDistanceAndETA(origin: LatLng, destination: LatLng): Promise<DirectionsResult> {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${this.apiKey}`

    // Use proxy to avoid CORS issues
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`)
    const data = await response.json()

    if (data.status !== "OK" || !data.routes.length) {
      throw new Error("Unable to calculate route")
    }

    const route = data.routes[0]
    const leg = route.legs[0]

    // Decode polyline to get route path
    const polyline = this.decodePolyline(route.overview_polyline.points)

    return {
      distance: leg.distance.text,
      duration: leg.duration.text,
      steps: leg.steps,
      polyline: polyline,
    }
  }

  // Decode Google Maps polyline encoding
  private decodePolyline(encoded: string): LatLng[] {
    const poly: LatLng[] = []
    let index = 0
    const len = encoded.length
    let lat = 0
    let lng = 0

    while (index < len) {
      let b
      let shift = 0
      let result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlat = result & 1 ? ~(result >> 1) : result >> 1
      lat += dlat

      shift = 0
      result = 0
      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)
      const dlng = result & 1 ? ~(result >> 1) : result >> 1
      lng += dlng

      poly.push({ lat: lat / 1e5, lng: lng / 1e5 })
    }

    return poly
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`

    // Use proxy to avoid CORS issues
    const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`)
    const data = await response.json()

    if (data.status !== "OK") {
      throw new Error(`Google Maps Geocoding API error: ${data.status} - ${data.error_message || "No details provided."}`)
    }

    if (data.results.length > 0) {
      return data.results[0].formatted_address
    }

    // This case handles ZERO_RESULTS status gracefully by returning a fallback string.
    return `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}
