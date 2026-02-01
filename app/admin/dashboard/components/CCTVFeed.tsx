// CCTVFeed.tsx
// Component for displaying CCTV feed from bus cameras

import React, { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, VideoOff, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { config } from "@/lib/config";

interface CCTVFeedProps {
  deviceId: string;
  vehicleLabel: string;
}

export function CCTVFeed({ deviceId, vehicleLabel }: CCTVFeedProps) {
  const [selectedChannel, setSelectedChannel] = useState(1);
  const [selectedStream, setSelectedStream] = useState(0); // 0 = main, 1 = sub
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const channels = [1, 2, 3, 4]; // 4 channels per device
  const streams = [
    { value: 1, label: "Sub" }
  ];

  const [rtspUrl, setRtspUrl] = useState<string | null>(null);

  const handleChannelChange = (channel: number) => {
    setSelectedChannel(channel);
  };

  const handleStreamChange = (stream: number) => {
    setSelectedStream(stream);
  };

  const fetchStream = async () => {
    setLoading(true);
    setError(null);
    setRtspUrl(null);
    try {
      const response = await fetch(`${config.backend.baseUrl}/api/video/${deviceId}/${selectedChannel}/${selectedStream}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok && data.rtsp_url) {
        setRtspUrl(data.rtsp_url);
      } else {
        setError(data.error || "Failed to fetch stream");
      }
    } catch (err) {
      setError("Network error fetching stream info");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStream();
  }, [deviceId, selectedChannel, selectedStream]);

  const handleRefresh = fetchStream;
  const copyToClipboard = () => {
    if (rtspUrl) {
      navigator.clipboard.writeText(rtspUrl);
      alert("RTSP URL copied to clipboard!");
    }
  };

  return (
    <Card className="mt-4 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg font-bold text-purple-900">
              CCTV Feed - {vehicleLabel}
            </CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Channel Selection */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Channel:</span>
          <div className="flex gap-1">
            {channels.map((channel) => (
              <Button
                key={channel}
                size="sm"
                variant={selectedChannel === channel ? "default" : "outline"}
                onClick={() => handleChannelChange(channel)}
                className="w-10 h-9"
              >
                {channel}
              </Button>
            ))}
          </div>
        </div>

        {/* Stream Quality Selection */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Quality:</span>
          <div className="flex gap-1">
            {streams.map((stream) => (
              <Button
                key={stream.value}
                size="sm"
                variant={selectedStream === stream.value ? "default" : "outline"}
                onClick={() => handleStreamChange(stream.value)}
              >
                {stream.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Stream URL Display */}
        <div className="bg-slate-900 rounded-lg p-6 border-2 border-purple-200 text-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-300">
              <RefreshCw className="animate-spin h-8 w-8" />
              <span>Fetching stream info...</span>
            </div>
          ) : error ? (
            <div className="text-red-400 flex flex-col items-center gap-2">
              <VideoOff className="h-8 w-8" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-slate-400 text-sm">RTSP Stream URL (Open in VLC Player)</p>
                <code className="block bg-black/50 p-3 rounded text-green-400 text-xs font-mono break-all select-all">
                  {rtspUrl}
                </code>
              </div>
              <Button onClick={copyToClipboard} className="bg-purple-600 hover:bg-purple-700">
                Copy to Clipboard
              </Button>
            </div>
          )}
        </div>

        {/* Help Text */}
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-xs text-blue-800">
            <strong>Note:</strong> RTSP streams may require additional browser plugins or extensions.
            If the video doesn't play, consider using VLC or another RTSP-compatible player with the stream URL.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
