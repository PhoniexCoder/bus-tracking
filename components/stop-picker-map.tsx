"use client"

import { useEffect, useRef, useState } from "react"
import { GoogleMapsService } from "@/lib/google-maps"

interface StopPickerMapProps {
  lat: string
  lng: string
  onLocationSelect: (lat: number, lng: number, address?: string) => void
  height?: string
  busPosition?: { lat: number; lng: number }
  busLabel?: string
}

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#010f1f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#010f1f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#74889b" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#a3b8cc" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#a3b8cc" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0b2034" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#74889b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#0a1f33" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#16314c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#a3b8cc" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#11263d" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f3a57" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#112131" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#a3b8cc" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#010811" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#010811" }] },
]

function createBusElement(color: string, label?: string): HTMLElement {
  const div = document.createElement("div")
  div.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" stroke="#222" stroke-width="1" d="M12 2C7.03 2 3 6.03 3 11v6c0 1.1.9 2 2 2v1c0 .55.45 1 1 1s1-.45 1-1v-1h8v1c0 .55.45 1 1 1s1-.45 1-1v-1c1.1 0 2-.9 2-2v-6c0-4.97-4.03-9-9-9zm0 2c3.87 0 7 3.13 7 7v6H5v-6c0-3.87 3.13-7 7-7zm-4 9c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/></svg>`
  if (label) {
    const lbl = document.createElement("span")
    lbl.textContent = label
    lbl.style.cssText = "font-size:9px;font-weight:700;color:#fff;display:block;text-align:center;line-height:1;margin-top:-2px"
    div.appendChild(lbl)
  }
  div.style.cssText = "display:flex;flex-direction:column;align-items:center"
  return div
}

function createStopElement(): HTMLElement {
  const div = document.createElement("div")
  div.innerHTML = `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 2C7.37 2 2 7.37 2 14c0 7 12 24 12 24s12-17 12-24c0-6.63-5.37-12-12-12zm0 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#ef4444" stroke="#991b1b" stroke-width="1.5"/></svg>`
  div.style.cssText = "display:flex;align-items:center;justify-content:center;transform:translateY(-50%)"
  return div
}

export function StopPickerMap({ lat, lng, onLocationSelect, height = "250px", busPosition, busLabel }: StopPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const busMarkerRef = useRef<any>(null)
  const geocoderRef = useRef<GoogleMapsService | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const selectRef = useRef(onLocationSelect)
  selectRef.current = onLocationSelect

  const placeMarker = (pos: { lat: number; lng: number }) => {
    if (!mapRef.current || !window.google?.maps?.marker) return

    if (markerRef.current) {
      markerRef.current.position = pos
    } else {
      const content = createStopElement()
      markerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        position: pos,
        map: mapRef.current,
        content,
        gmpDraggable: true,
      })

      markerRef.current.addListener("dragend", async (e: any) => {
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() }
        try {
          const addr = await geocoderRef.current?.reverseGeocode(p.lat, p.lng)
          selectRef.current(p.lat, p.lng, addr)
        } catch {
          selectRef.current(p.lat, p.lng)
        }
      })
    }
  }

  useEffect(() => {
    geocoderRef.current = new GoogleMapsService()

    const initMap = () => {
      if (!containerRef.current || mapRef.current) return

      const currentLat = parseFloat(lat)
      const currentLng = parseFloat(lng)
      const hasCoords = !isNaN(currentLat) && !isNaN(currentLng)
      const center = hasCoords
        ? { lat: currentLat, lng: currentLng }
        : busPosition
          ? busPosition
          : { lat: 28.6139, lng: 77.209 }

      const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID"
      mapRef.current = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: hasCoords ? 16 : 14,
        mapId,
        mapTypeId: "roadmap",
        styles: darkMapStyle,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: true,
      })

      if (hasCoords) placeMarker(center)

      if (busPosition && window.google?.maps?.marker) {
        busMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
          position: busPosition,
          map: mapRef.current,
          content: createBusElement("#22c55e", busLabel),
        })
      }

      mapRef.current.addListener("click", async (e: any) => {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() }
        placeMarker(pos)
        try {
          const addr = await geocoderRef.current?.reverseGeocode(pos.lat, pos.lng)
          selectRef.current(pos.lat, pos.lng, addr)
        } catch {
          selectRef.current(pos.lat, pos.lng)
        }
      })

      setMapReady(true)
    }

    const cleanup = () => {
      if (markerRef.current) { markerRef.current.map = null; markerRef.current = null }
      if (busMarkerRef.current) { busMarkerRef.current.map = null; busMarkerRef.current = null }
      if (mapRef.current) { mapRef.current = null }
    }

    if (window.google?.maps?.marker) {
      initMap()
    } else {
      const interval = setInterval(() => {
        if (window.google?.maps?.marker) {
          clearInterval(interval)
          initMap()
        }
      }, 200)
      return () => { clearInterval(interval); cleanup() }
    }

    return cleanup
  }, [])

  useEffect(() => {
    if (!mapRef.current) return
    const currentLat = parseFloat(lat)
    const currentLng = parseFloat(lng)
    if (isNaN(currentLat) || isNaN(currentLng)) return
    const pos = { lat: currentLat, lng: currentLng }
    placeMarker(pos)
    mapRef.current.panTo(pos)
  }, [lat, lng])

  useEffect(() => {
    if (!mapRef.current || !busPosition || !window.google?.maps?.marker) return
    if (busMarkerRef.current) {
      busMarkerRef.current.position = busPosition
    } else {
      busMarkerRef.current = new window.google.maps.marker.AdvancedMarkerElement({
        position: busPosition,
        map: mapRef.current,
        content: createBusElement("#22c55e", busLabel),
      })
    }
    if (!markerRef.current && !parseFloat(lat) && !parseFloat(lng)) {
      mapRef.current.panTo(busPosition)
    }
  }, [busPosition?.lat, busPosition?.lng])

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        style={{ height, width: "100%" }}
        className="rounded-xl overflow-hidden border border-white/10 bg-[#010f1f]"
      />
      {!mapReady && (
        <p className="text-[10px] text-[#a3b8cc]/40 text-center py-1 font-mono">
          Loading map&hellip;
        </p>
      )}
    </div>
  )
}
