import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { NotificationProvider } from "@/components/ui/notification-system"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata = {
  title: "QCC Electronic Attendance System",
  description: "Qatar Community College Electronic Attendance Tracking System for all 10 locations",
  icons: {
    icon: "/images/qcc-logo.png",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="font-sans">
        <NotificationProvider>{children}</NotificationProvider>
      </body>
    </html>
  )
}
