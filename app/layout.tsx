import type React from "react"
import { Inter, JetBrains_Mono } from "next/font/google"
import dynamic from "next/dynamic"
import "./globals.css"
import { metadata } from "./metadata"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  preload: true,
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  weight: ["400", "600"],
  preload: true,
})

export { metadata }

const RootLayoutClient = dynamic(() => import("./root-layout-client"), {
  ssr: true,
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
      <body className="font-sans">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  )
}

export const metadata = {
      generator: 'v0.app'
    };
