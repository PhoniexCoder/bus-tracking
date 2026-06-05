import React from "react";

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleMapProps {
  markers: { lat: number; lng: number; label?: string; status?: string; type?: string; path?: { lat: number; lng: number }[] }[];
  height?: string;
  width?: string;
  showTrafficLayer?: boolean;
  center?: { lat: number; lng: number };
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
];

function createBusContent(color: string, label?: string): HTMLElement {
  const d = document.createElement("div")
  d.style.cssText = "display:flex;flex-direction:column;align-items:center"
  d.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="${color}" stroke="#222" stroke-width="1" d="M12 2C7.03 2 3 6.03 3 11v6c0 1.1.9 2 2 2v1c0 .55.45 1 1 1s1-.45 1-1v-1h8v1c0 .55.45 1 1 1s1-.45 1-1v-1c1.1 0 2-.9 2-2v-6c0-4.97-4.03-9-9-9zm0 2c3.87 0 7 3.13 7 7v6H5v-6c0-3.87 3.13-7 7-7zm-4 9c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/></svg>`
  if (label) {
    const lbl = document.createElement("span")
    lbl.textContent = label
    lbl.style.cssText = "font-size:9px;font-weight:700;color:#fff;text-align:center;line-height:1;margin-top:-2px"
    d.appendChild(lbl)
  }
  return d
}

function createStopContent(color: string): HTMLElement {
  const d = document.createElement("div")
  d.innerHTML = `<svg width="28" height="40" viewBox="0 0 28 40"><path d="M14 2C7.37 2 2 7.37 2 14c0 7 12 24 12 24s12-17 12-24c0-6.63-5.37-12-12-12zm0 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="${color}" stroke="#991b1b" stroke-width="1.5"/></svg>`
  return d
}

function createUserContent(): HTMLElement {
  const d = document.createElement("div")
  d.innerHTML = `<svg width="28" height="40" viewBox="0 0 28 40"><path d="M14 2C7.37 2 2 7.37 2 14c0 7 12 24 12 24s12-17 12-24c0-6.63-5.37-12-12-12zm0 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#dc2626" stroke="#991b1b" stroke-width="2"/></svg>`
  return d
}

export const GoogleMap: React.FC<GoogleMapProps> = ({ markers, height = "400px", width = "100%", showTrafficLayer, center }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const markerObjs = React.useRef<{ [key: string]: any }>({});
  const trafficLayerRef = React.useRef<any>(null);
  const polylineRef = React.useRef<any>(null);
  const animationFrameRef = React.useRef<{ [key: string]: number }>({});

  const animateMarker = (markerObj: any, from: { lat: number; lng: number }, to: { lat: number; lng: number }, duration = 1000, key: string) => {
    if (!markerObj) return;
    let start: number | null = null;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const lat = from.lat + (to.lat - from.lat) * progress;
      const lng = from.lng + (to.lng - from.lng) * progress;
      markerObj.position = { lat, lng };
      if (progress < 1) {
        animationFrameRef.current[key] = requestAnimationFrame(animate);
      }
    };
    if (animationFrameRef.current[key]) {
      cancelAnimationFrame(animationFrameRef.current[key]);
    }
    animationFrameRef.current[key] = requestAnimationFrame(animate);
  };

  const updateMarkers = (initial = false) => {
    if (!window.google || !window.google.maps || !mapRef.current) return;

    Object.entries(markerObjs.current).forEach(([key, m]) => {
      if (!markers.find((mk) => (mk.type === 'bus' || mk.type === 'user') && mk.label === key)) {
        m.map = null;
        delete markerObjs.current[key];
      }
    });

    if (showTrafficLayer && window.google && window.google.maps && mapRef.current) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
        trafficLayerRef.current.setMap(mapRef.current);
      }
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
      trafficLayerRef.current = null;
    }

    markers.forEach((marker) => {
      if (marker.type === 'bus') {
        let color = marker.status === 'online' ? '#22c55e' : '#9ca3af';
        const key = marker.label || marker.lat + ',' + marker.lng;
        if (!markerObjs.current[key]) {
          markerObjs.current[key] = new window.google.maps.marker.AdvancedMarkerElement({
            position: { lat: marker.lat, lng: marker.lng },
            map: mapRef.current,
            content: createBusContent(color, marker.label),
          });
        } else {
          const prevPos = markerObjs.current[key].position;
          const from = { lat: prevPos.lat, lng: prevPos.lng };
          const to = { lat: marker.lat, lng: marker.lng };
          if (from.lat !== to.lat || from.lng !== to.lng) {
            animateMarker(markerObjs.current[key], from, to, 1000, key);
          }
        }
      } else if (marker.type === 'user') {
        const key = marker.label || 'user-' + marker.lat + ',' + marker.lng;
        if (!markerObjs.current[key]) {
          markerObjs.current[key] = new window.google.maps.marker.AdvancedMarkerElement({
            position: { lat: marker.lat, lng: marker.lng },
            map: mapRef.current,
            content: createUserContent(),
          });
        } else {
          markerObjs.current[key].position = { lat: marker.lat, lng: marker.lng };
        }
      } else if (marker.type === 'stop') {
        let color = marker.status === 'passed' ? '#22c55e' : '#ef4444';
        const key = marker.label || marker.lat + ',' + marker.lng;
        if (!markerObjs.current[key]) {
          markerObjs.current[key] = new window.google.maps.marker.AdvancedMarkerElement({
            position: { lat: marker.lat, lng: marker.lng },
            map: mapRef.current,
            content: createStopContent(color),
          });
        }
      } else if (marker.type === 'polyline' && marker.path && marker.path.length > 1) {
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
        }
        polylineRef.current = new window.google.maps.Polyline({
          path: marker.path,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 0.8,
          strokeWeight: 4,
          map: mapRef.current,
        });
      }
    });
  };

  React.useEffect(() => {
    const initMap = () => {
      if (!window.google?.maps?.marker || !ref.current) return
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(ref.current, {
          center: markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 0, lng: 0 },
          zoom: 18,
          mapTypeId: 'roadmap',
          styles: darkMapStyle,
          mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
        })
      }
      updateMarkers(true)
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
      return () => clearInterval(interval)
    }
  }, [])

  React.useEffect(() => {
    updateMarkers();
  }, [markers]);

  React.useEffect(() => {
    if (center && mapRef.current && window.google && window.google.maps) {
      mapRef.current.panTo(new window.google.maps.LatLng(center.lat, center.lng));
      mapRef.current.setZoom(16);
    }
  }, [center]);

  return <div ref={ref} style={{ height, width }} />;
};
