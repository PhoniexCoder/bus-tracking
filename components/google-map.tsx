
import React from "react";

declare global {
  interface Window {
    google?: any;
    initMap?: () => void;
  }
}

export interface GoogleMapProps {
  markers: { lat: number; lng: number; label?: string; status?: string; type?: string; path?: { lat: number; lng: number }[] }[];
  height?: string;
  width?: string;
  showTrafficLayer?: boolean;
  center?: { lat: number; lng: number };
}



// --- Animated Google Map Implementation ---
export const GoogleMap: React.FC<GoogleMapProps> = ({ markers, height = "400px", width = "100%", showTrafficLayer, center }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<any>(null);
  const markerObjs = React.useRef<{ [key: string]: any }>({});
  const trafficLayerRef = React.useRef<any>(null);
  const polylineRef = React.useRef<any>(null);
  // Store animation state for each bus
  const animationFrameRef = React.useRef<{ [key: string]: number }>({});

  // Helper for SVG icons
  const busSvg = (color: string) => ({
    path: "M12 2C7.03 2 3 6.03 3 11v6c0 1.1.9 2 2 2v1c0 .55.45 1 1 1s1-.45 1-1v-1h8v1c0 .55.45 1 1 1s1-.45 1-1v-1c1.1 0 2-.9 2-2v-6c0-4.97-4.03-9-9-9zm0 2c3.87 0 7 3.13 7 7v6H5v-6c0-3.87 3.13-7 7-7zm-4 9c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm8 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z",
    fillColor: color,
    fillOpacity: 1,
    strokeWeight: 1,
    strokeColor: '#222',
    scale: 2,
    anchor: new window.google.maps.Point(12, 12),
  });
  const stopSvg = (color: string) => ({
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    fillColor: color,
    fillOpacity: 1,
    strokeWeight: 1,
    strokeColor: '#b91c1c',
    scale: 1.5,
    anchor: new window.google.maps.Point(12, 22),
  });
  const userSvg = () => ({
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    fillColor: '#dc2626',
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: '#991b1b',
    scale: 1.8,
    anchor: new window.google.maps.Point(12, 22),
  });

  // Load Google Maps script and create map ONCE
  React.useEffect(() => {
    const loadScript = () => {
      if (document.getElementById('google-maps-script')) return;
      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`;
      script.async = true;
      script.onload = () => initMap();
      document.body.appendChild(script);
    };

    const initMap = () => {
      if (!window.google || !window.google.maps || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(ref.current, {
          center: markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 0, lng: 0 },
          zoom: 18,
          mapTypeId: 'terrain',
        });
      }
      updateMarkers(true);
    };

    if (!window.google || !window.google.maps) {
      loadScript();
      window.initMap = initMap;
    } else {
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(ref.current, {
          center: markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 0, lng: 0 },
          zoom: 18,
          mapTypeId: 'terrain',
        });
      }
      updateMarkers(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate marker position
  const animateMarker = (markerObj: any, from: { lat: number; lng: number }, to: { lat: number; lng: number }, duration = 1000, key: string) => {
    if (!markerObj) return;
    let start: number | null = null;
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const lat = from.lat + (to.lat - from.lat) * progress;
      const lng = from.lng + (to.lng - from.lng) * progress;
      markerObj.setPosition({ lat, lng });
      if (progress < 1) {
        animationFrameRef.current[key] = requestAnimationFrame(animate);
      }
    };
    if (animationFrameRef.current[key]) {
      cancelAnimationFrame(animationFrameRef.current[key]);
    }
    animationFrameRef.current[key] = requestAnimationFrame(animate);
  };

  // Update markers when markers prop changes
  const updateMarkers = (initial = false) => {
    if (!window.google || !window.google.maps || !mapRef.current) return;
    // Remove old non-bus markers
    Object.entries(markerObjs.current).forEach(([key, m]) => {
      if (!markers.find((mk) => (mk.type === 'bus' || mk.type === 'user') && mk.label === key)) {
        m.setMap(null);
        delete markerObjs.current[key];
      }
    });
    // Add traffic layer if requested
    if (showTrafficLayer && window.google && window.google.maps && mapRef.current) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new window.google.maps.TrafficLayer();
        trafficLayerRef.current.setMap(mapRef.current);
      }
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
      trafficLayerRef.current = null;
    }
    // Add/update markers
    markers.forEach((marker) => {
      if (marker.type === 'bus') {
        let color = marker.status === 'online' ? '#22c55e' : '#9ca3af';
        const key = marker.label || marker.lat + ',' + marker.lng;
        if (!markerObjs.current[key]) {
          // Create marker if not exists
          markerObjs.current[key] = new window.google.maps.Marker({
            position: { lat: marker.lat, lng: marker.lng },
            map: mapRef.current,
            label: marker.label,
            icon: busSvg(color),
          });
        } else {
          // Animate marker to new position
          const prevPos = markerObjs.current[key].getPosition();
          const from = { lat: prevPos.lat(), lng: prevPos.lng() };
          const to = { lat: marker.lat, lng: marker.lng };
          if (from.lat !== to.lat || from.lng !== to.lng) {
            animateMarker(markerObjs.current[key], from, to, 1000, key);
          }
        }
      } else if (marker.type === 'user') {
        const key = marker.label || 'user-' + marker.lat + ',' + marker.lng;
        if (!markerObjs.current[key]) {
          markerObjs.current[key] = new window.google.maps.Marker({
            position: { lat: marker.lat, lng: marker.lng },
            map: mapRef.current,
            label: marker.label,
            icon: userSvg(),
          });
        } else {
          // Update user position
          markerObjs.current[key].setPosition({ lat: marker.lat, lng: marker.lng });
        }
      } else if (marker.type === 'stop') {
        let color = marker.status === 'passed' ? '#22c55e' : '#ef4444';
        const key = marker.label || marker.lat + ',' + marker.lng;
        if (!markerObjs.current[key]) {
          markerObjs.current[key] = new window.google.maps.Marker({
            position: { lat: marker.lat, lng: marker.lng },
            map: mapRef.current,
            label: marker.label,
            icon: stopSvg(color),
          });
        }
      } else if (marker.type === 'polyline' && marker.path && marker.path.length > 1) {
        // Remove old polyline if exists
        if (polylineRef.current) {
          polylineRef.current.setMap(null);
        }
        // Draw new polyline for route
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

  // Update markers when markers prop changes
  React.useEffect(() => {
    updateMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  // Pan to center when center prop changes
  React.useEffect(() => {
    if (center && mapRef.current && window.google && window.google.maps) {
      mapRef.current.panTo(new window.google.maps.LatLng(center.lat, center.lng));
      mapRef.current.setZoom(16);
    }
  }, [center]);

  return <div ref={ref} style={{ height, width }} />;
};
