"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Video, 
  VideoOff, 
  RefreshCw, 
  LogOut, 
  Maximize2,
  Grid3x3,
  Monitor,
  AlertCircle,
  ArrowLeft
} from "lucide-react"
import { config } from "@/lib/config"
import { fetchBackendAPI } from "@/lib/backend-auth"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface BusCamera {
  deviceId: string
  busLabel: string
  online: boolean
}

interface VideoStreamInfo {
  device_id: string
  channel: number
  stream: number
  rtsp_url: string
  note: string
}

export default function CameraFeedPage() {
  const { user, userRole, logout } = useAuth()
  const router = useRouter()
  const [buses, setBuses] = useState<BusCamera[]>([])
  const [selectedBus, setSelectedBus] = useState<string>("")
  const [selectedChannel, setSelectedChannel] = useState<number>(1)
  const [selectedStream, setSelectedStream] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewMode, setViewMode] = useState<"single" | "grid">("single")
  const [streamInfo, setStreamInfo] = useState<VideoStreamInfo | null>(null)
  const [fetchingStream, setFetchingStream] = useState(false)

  // Fetch bus list from FastAPI
  useEffect(() => {
    if (!user || userRole !== "admin") {
      router.push("/")
      return
    }

    const fetchBuses = async () => {
      try {
        const response = await fetchBackendAPI('/api/liveplate_all')
        if (!response.ok) throw new Error("Failed to fetch bus list")
        
        const data = await response.json()
        const busData: BusCamera[] = data.map((bus: any) => ({
          deviceId: bus.device_id,
          busLabel: bus.plate_number || bus.device_name || bus.device_id,
          online: bus.gps?.online || false
        }))
        
        setBuses(busData)
        if (busData.length > 0) {
          setSelectedBus(busData[0].deviceId)
        }
      } catch (err) {
        console.error("Error fetching buses:", err)
        setError("Failed to load bus list")
      } finally {
        setLoading(false)
      }
    }

    fetchBuses()
  }, [user, userRole, router])

  // Fetch stream info whenever bus/channel/stream changes
  useEffect(() => {
    if (!selectedBus) return

    const fetchStreamInfo = async () => {
      setFetchingStream(true)
      setError("")
      try {
        const response = await fetchBackendAPI(
          `/api/video/${selectedBus}/${selectedChannel}/${selectedStream}`
        )
        if (!response.ok) {
          throw new Error("Failed to fetch stream information")
        }
        const data = await response.json()
        setStreamInfo(data)
      } catch (err) {
        console.error("Error fetching stream info:", err)
        setError("Failed to load stream information")
        setStreamInfo(null)
      } finally {
        setFetchingStream(false)
      }
    }

    fetchStreamInfo()
  }, [selectedBus, selectedChannel, selectedStream])

  const handleLogout = async () => {
    await logout()
    router.push("/")
  }

  const getVideoUrl = (deviceId: string, channel: number, stream: number) => {
    return `${config.backend.baseUrl}/api/video/${deviceId}/${channel}/${stream}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  const channels = [1, 2, 3, 4]
  const streams = [
    { value: 0, label: "Main" },
    { value: 1, label: "Sub" }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-black/50 border-b border-white/10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-lg">
                <Video className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Camera Feeds
                </h1>
                <p className="text-sm text-gray-300">Live CCTV Monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin/dashboard')}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === "single" ? "grid" : "single")}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                {viewMode === "single" ? (
                  <>
                    <Grid3x3 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Grid View</span>
                  </>
                ) : (
                  <>
                    <Monitor className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Single View</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {buses.length === 0 ? (
          <Card className="border-0 bg-white/10 backdrop-blur text-white">
            <CardContent className="p-12 text-center">
              <VideoOff className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">No Buses Available</h3>
              <p className="text-gray-300">No buses found in the system.</p>
            </CardContent>
          </Card>
        ) : viewMode === "single" ? (
          // Single Camera View
          <div className="space-y-6">
            {/* Controls */}
            <Card className="border-0 bg-white/10 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Camera Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Bus Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Select Bus</label>
                    <Select value={selectedBus} onValueChange={setSelectedBus}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {buses.map((bus) => (
                          <SelectItem key={bus.deviceId} value={bus.deviceId}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${bus.online ? 'bg-green-500' : 'bg-red-500'}`}></div>
                              {bus.busLabel}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Channel Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Camera Channel</label>
                    <Select value={selectedChannel.toString()} onValueChange={(val) => setSelectedChannel(Number(val))}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {channels.map((ch) => (
                          <SelectItem key={ch} value={ch.toString()}>
                            Channel {ch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Stream Quality */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Stream Quality</label>
                    <Select value={selectedStream.toString()} onValueChange={(val) => setSelectedStream(Number(val))}>
                      <SelectTrigger className="bg-white/10 border-white/20 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {streams.map((stream) => (
                          <SelectItem key={stream.value} value={stream.value.toString()}>
                            {stream.label} Stream
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Video Player */}
            <Card className="border-0 bg-white/10 backdrop-blur">
              <CardContent className="p-6">
                {fetchingStream ? (
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                    <div className="text-center text-white">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Loading stream information...</p>
                    </div>
                  </div>
                ) : streamInfo ? (
                  <div className="space-y-4">
                    {/* Stream Info */}
                    <div className="bg-black/50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Video className="h-5 w-5" />
                          Stream Information
                        </h3>
                        <div className="flex gap-2">
                          <Badge className="bg-green-600">
                            {buses.find(b => b.deviceId === selectedBus)?.busLabel}
                          </Badge>
                          <Badge variant="secondary">
                            Channel {selectedChannel}
                          </Badge>
                          <Badge variant="secondary">
                            {selectedStream === 0 ? "Main" : "Sub"} Stream
                          </Badge>
                        </div>
                      </div>

                      {/* RTSP URL Display */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-300">RTSP URL:</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={streamInfo.rtsp_url}
                            readOnly
                            className="flex-1 bg-black/70 border border-white/20 rounded px-3 py-2 text-white font-mono text-sm"
                          />
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(streamInfo.rtsp_url)
                              alert("RTSP URL copied to clipboard!")
                            }}
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            Copy URL
                          </Button>
                        </div>
                      </div>

                      {/* Instructions */}
                      <Alert className="bg-yellow-500/20 border-yellow-500/50">
                        <AlertCircle className="h-4 w-4 text-yellow-400" />
                        <AlertDescription className="text-yellow-100">
                          <strong>Note:</strong> Browsers cannot play RTSP streams directly. Please use one of these methods:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li><strong>VLC Media Player:</strong> Open Network Stream and paste the RTSP URL above</li>
                            <li><strong>FFplay:</strong> Run <code className="bg-black/30 px-1 rounded">ffplay "{streamInfo.rtsp_url}"</code></li>
                            <li><strong>OBS Studio:</strong> Add Media Source with the RTSP URL</li>
                          </ul>
                        </AlertDescription>
                      </Alert>

                      {/* Quick Actions */}
                      <div className="flex gap-2">
                        <Button
                          onClick={() => window.open(`vlc://${streamInfo.rtsp_url}`, '_blank')}
                          variant="outline"
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Open in VLC
                        </Button>
                        <Button
                          onClick={() => {
                            const blob = new Blob([streamInfo.rtsp_url], { type: 'text/plain' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `${buses.find(b => b.deviceId === selectedBus)?.busLabel}_CH${selectedChannel}_stream.txt`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          variant="outline"
                          className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                        >
                          Download URL
                        </Button>
                      </div>
                    </div>

                    {/* Placeholder Video Element (for future HLS support) */}
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                        <VideoOff className="h-16 w-16 mb-4 text-gray-500" />
                        <p className="text-lg font-semibold mb-2">Browser Playback Not Available</p>
                        <p className="text-sm text-gray-400">Use VLC or another RTSP-compatible player</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <VideoOff className="h-12 w-12 mx-auto mb-2" />
                      <p>Select a bus to view camera feed</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          // Grid View - All Cameras
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {buses.map((bus) =>
              channels.map((channel) => (
                <Card key={`${bus.deviceId}-${channel}`} className="border-0 bg-white/10 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${bus.online ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        {bus.busLabel}
                      </span>
                      <Badge variant="secondary" className="text-xs">Ch {channel}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="relative aspect-video bg-black rounded overflow-hidden">
                      <video
                        key={`grid-${bus.deviceId}-${channel}-0`}
                        className="w-full h-full object-contain"
                        controls
                        muted
                        playsInline
                      >
                        <source src={getVideoUrl(bus.deviceId, channel, 0)} type="application/x-mpegURL" />
                        <source src={getVideoUrl(bus.deviceId, channel, 0)} type="video/mp4" />
                      </video>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
