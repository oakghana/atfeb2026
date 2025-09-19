"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, X, CheckCircle } from "lucide-react"
import { parseQRCode, validateQRCode, type QRCodeData } from "@/lib/qr-code"

interface QRScannerProps {
  onScanSuccess: (data: QRCodeData) => void
  onClose: () => void
}

export function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startScanning = async () => {
    try {
      setError(null)
      setIsScanning(true)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      setError("Camera access denied or not available")
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setIsScanning(false)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // In a real implementation, you'd use a QR code reading library here
      // For now, we'll simulate QR code reading
      try {
        const qrData = parseQRCode(result)
        if (qrData) {
          const validation = validateQRCode(qrData)
          if (validation.isValid) {
            setSuccess("QR code scanned successfully!")
            onScanSuccess(qrData)
          } else {
            setError(validation.reason || "Invalid QR code")
          }
        } else {
          setError("Invalid QR code format")
        }
      } catch {
        setError("Failed to read QR code")
      }
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">Scan QR Code</CardTitle>
            <CardDescription className="text-sm">Scan the location QR code to check in</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="touch-manipulation h-10 w-10 p-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{success}</AlertDescription>
          </Alert>
        )}

        {!isScanning ? (
          <div className="space-y-4">
            <Button onClick={startScanning} className="w-full touch-manipulation h-14 text-base">
              <Camera className="h-5 w-5 mr-2" />
              Start Camera
            </Button>

            <div className="text-center text-sm text-muted-foreground">or</div>

            <div>
              <label htmlFor="qr-upload" className="block">
                <Button variant="outline" className="w-full bg-transparent touch-manipulation h-14 text-base" asChild>
                  <span>Upload QR Code Image</span>
                </Button>
              </label>
              <input id="qr-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-primary/50 rounded-lg">
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-48 sm:h-48 border-2 border-primary rounded-lg"></div>
              </div>
            </div>

            <Button
              onClick={stopScanning}
              variant="outline"
              className="w-full bg-transparent touch-manipulation h-14 text-base"
            >
              Stop Scanning
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
