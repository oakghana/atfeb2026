"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, X, CheckCircle } from "lucide-react"
import { parseQRCode, validateQRCode, type QRCodeData } from "@/lib/qr-code"
import { isBrowserAPIAvailable, safeAsyncOperation } from "@/lib/safe-utils"

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

      if (!isBrowserAPIAvailable("mediaDevices")) {
        throw new Error("Camera access is not supported by this browser")
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Camera access denied or not available"
      setError(message)
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

    if (!isBrowserAPIAvailable("fileReader")) {
      setError("File reading is not supported by this browser")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (!result) {
        setError("Failed to read file")
        return
      }

      safeAsyncOperation(
        async () => {
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
        },
        undefined,
        (error) => setError("Failed to read QR code"),
      )
    }

    reader.onerror = () => {
      setError("Failed to read file")
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
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>Scan the location QR code to check in</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {!isScanning ? (
          <div className="space-y-4">
            <Button onClick={startScanning} className="w-full">
              <Camera className="h-4 w-4 mr-2" />
              Start Camera
            </Button>

            <div className="text-center text-sm text-muted-foreground">or</div>

            <div>
              <label htmlFor="qr-upload" className="block">
                <Button variant="outline" className="w-full bg-transparent" asChild>
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
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary rounded-lg"></div>
              </div>
            </div>

            <Button onClick={stopScanning} variant="outline" className="w-full bg-transparent">
              Stop Scanning
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
