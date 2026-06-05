import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Outfit } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context"

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] })
const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Bus Tracker - Real-time Bus Tracking",
  description: "Real-time bus tracking for students, drivers, and administrators",
  manifest: "/manifest.json",
  icons: {
    apple: "/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bus Tracker",
  },
  generator: "devlopment",
}

export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
        <script
          async
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=geometry,marker&loading=async`}
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className={outfit.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
