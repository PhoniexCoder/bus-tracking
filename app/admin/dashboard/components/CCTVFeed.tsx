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
    { value: 0, label: "Main" },
    { value: 1, label: "Sub" }
  ];

  const videoUrl = `${config.backend.baseUrl}/api/video/${deviceId}/${selectedChannel}/${selectedStream}`;

  const handleChannelChange = (channel: number) => {
    setSelectedChannel(channel);
    setLoading(true);
    setError(null);
  };

  const handleStreamChange = (stream: number) => {
    setSelectedStream(stream);
    setLoading(true);
    setError(null);
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    // Force iframe reload by changing key
  };

  return (
    <Card className="mt-4 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-lg font-bold text-purple-900">
              Live CCTV - {vehicleLabel}
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
          <Badge variant="secondary" className="ml-auto text-xs">
            Device: {deviceId}
          </Badge>
        </div>

        {/* Video Player */}
        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border-2 border-purple-200">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <VideoOff className="h-12 w-12 text-red-400 mb-2" />
              <Alert variant="destructive" className="max-w-md">
                <AlertDescription className="text-sm text-center">
                  {error}
                </AlertDescription>
              </Alert>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                className="mt-3"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 text-white animate-spin mx-auto mb-2" />
                    <p className="text-white text-sm">Loading video stream...</p>
                  </div>
                </div>
              )}
              <video
                key={`${deviceId}-${selectedChannel}-${selectedStream}`}
                className="w-full h-full object-contain"
                controls
                autoPlay
                muted
                playsInline
                onLoadedData={() => setLoading(false)}
                onError={(e) => {
                  setLoading(false);
                  setError("Failed to load video stream. The camera may be offline or the stream format is not supported in the browser.");
                }}
              >
                <source src={videoUrl} type="application/x-mpegURL" />
                <source src={videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </>
          )}
        </div>

        {/* Stream Info */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Channel {selectedChannel} · {streams.find(s => s.value === selectedStream)?.label} Stream
          </span>
          <span className="text-right">
            RTSP Stream via FastAPI
          </span>
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
