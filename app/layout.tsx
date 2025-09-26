import type React from "react"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { NotificationProvider } from "@/components/ui/notification-system"
import { PWAServiceWorker } from "@/components/ui/pwa-service-worker"
import { TimeBasedThemeProvider } from "@/components/theme/time-based-theme-provider"
import { MobileInstallPrompt } from "@/components/ui/install-app-button"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600", "700"],
})

export const metadata = {
  title: "QCC Electronic Attendance | Quality Control Company Limited",
  description: "Quality Control Company Limited Electronic Attendance System - Intranet Portal",
  manifest: "/manifest.json",
  themeColor: "#ea580c",
  applicationName: "QCC Attendance",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QCC Attendance",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/images/qcc-logo.png", sizes: "32x32", type: "image/png" },
      { url: "/images/qcc-logo.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/images/qcc-logo.png",
    shortcut: "/favicon.ico",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-config": "/browserconfig.xml",
    "msapplication-TileColor": "#ea580c",
    "msapplication-tap-highlight": "no",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
      <body className="font-sans">
        <TimeBasedThemeProvider>
          <NotificationProvider>{children}</NotificationProvider>
          <PWAServiceWorker />
          <MobileInstallPrompt />
        </TimeBasedThemeProvider>
      </body>
    </html>
  )
}
