export interface DeviceIdentifier {
    vid: string // Plate Number
    did: string // Device No.
    type: number // 0 for GPS, 1 for video
}

export interface DeviceStatus {
    id: string // Device No.
    vid: string | null // Plate Number
    lng: number // Raw Lng (needs division by 1,000,000 to get degrees)
    lat: number // Raw Lat (needs division by 1,000,000 to get degrees)
    mlng: string // Map Lng (already converted)
    mlat: string // Map Lat (already converted)
    gt: string // GPS Upload Time
    ol: number // Online Status: 1 means online
    ps: string // Geographical Position string
    // dn and jn removed (driver fields)
    pk?: number // Parking Time (sec)
    net?: number // Network Type: 0:3G, 1:WIFI, 2:wired, 3:4G, 4:5G
    sn?: number // Number of satellites
}
