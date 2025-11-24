"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, X, CheckCircle, KeyRound } from "lucide-react"
import { parseQRCode, validateQRCode, type QRCodeData } from "@/lib/qr-code"

interface QRScannerProps {
  onScanSuccess: (data: QRCodeData) => void
  onClose: () => void
  autoStart?: boolean
}

export function QRScanner({ onScanSuccess, onClose, autoStart = false }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startScanning = async () => {
    try {
      setError(null)
      setIsScanning(true)

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()

        scanIntervalRef.current = setInterval(scanForQRCode, 200)
      }
    } catch (err) {
      console.error("[v0] Camera access error:", err)
      setError("Camera access denied or not available")
      setIsScanning(false)
    }
  }

  const scanForQRCode = async () => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      const jsQR = (await import("jsqr")).default
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      })

      if (code) {
        console.log("[v0] QR code detected:", code.data)
        await processQRCode(code.data)
      }
    } catch (error) {
      console.error("[v0] QR scanning error:", error)
    }
  }

  const processQRCode = async (qrDataString: string) => {
    try {
      stopScanning()

      const qrData = parseQRCode(qrDataString)
      if (qrData) {
        const validation = validateQRCode(qrData)
        if (validation.isValid) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
              })
            })

            const userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }

            console.log("[v0] User GPS location obtained for QR check-in:", userLocation)

            const response = await fetch("/api/attendance/qr-checkin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                location_id: qrData.location_id,
                qr_timestamp: new Date().toISOString(),
                userLatitude: userLocation.latitude,
                userLongitude: userLocation.longitude,
                device_info: {
                  browser: navigator.userAgent,
                  platform: navigator.platform,
                },
              }),
            })

            const result = await response.json()

            if (!response.ok) {
              if (response.status === 403 && result.distance) {
                setError(
                  result.message ||
                    `You must be within 40 meters to use QR code check-in. You are ${result.distance}m away from ${result.locationName}.`,
                )
              } else {
                setError(result.error || "Failed to process QR code check-in")
              }
              return
            }

            setSuccess("QR code scanned successfully!")
            console.log("[v0] Valid QR code with GPS validation, calling onScanSuccess")
            onScanSuccess(result.data || qrData)
          } catch (gpsError) {
            console.error("[v0] Failed to get GPS location:", gpsError)
            setError(
              "Location access required for QR code check-in. Please enable location services. You must be within 40 meters of the location to check in.",
            )
          }
        } else {
          setError(validation.reason || "Invalid QR code")
        }
      } else {
        setError("Invalid QR code format")
      }
    } catch (error) {
      console.error("[v0] QR processing error:", error)
      setError("Failed to process QR code")
    }
  }

  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

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

  const handleManualCodeSubmit = () => {
    if (!manualCode.trim()) {
      setError("Please enter a location code")
      return
    }

    try {
      const qrData = parseQRCode(manualCode)
      if (qrData) {
        const validation = validateQRCode(qrData)
        if (validation.isValid) {
          setSuccess("Location code validated successfully!")
          console.log("[v0] Valid manual code, calling onScanSuccess")
          onScanSuccess(qrData)
        } else {
          setError(validation.reason || "Invalid location code")
        }
      } else {
        setError("Invalid location code format. Expected format: HO-SWZ-001")
      }
    } catch (error) {
      console.error("[v0] Manual code processing error:", error)
      setError("Failed to process location code")
    }
  }

  useEffect(() => {
    if (autoStart && !isScanning) {
      startScanning()
    }

    return () => {
      stopScanning()
    }
  }, [autoStart])

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg sm:text-xl">
              {showManualInput ? "Enter Location Code" : "Scan QR Code"}
            </CardTitle>
            <CardDescription className="text-sm">
              {showManualInput ? "Enter your location code manually" : "Scan the location QR code to check in"}
            </CardDescription>
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

        {showManualInput ? (
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Label htmlFor="location-code">Location Code</Label>
              <Input
                id="location-code"
                placeholder="e.g., HO-SWZ-001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="h-14 text-lg font-mono"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleManualCodeSubmit()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Enter the location code found on the QCC location sign</p>
            </div>

            <Button
              onClick={handleManualCodeSubmit}
              className="w-full touch-manipulation h-16 text-lg font-semibold"
              disabled={!manualCode.trim()}
            >
              <KeyRound className="h-5 w-5 mr-2" />
              Submit Location Code
            </Button>

            <Button
              onClick={() => {
                setShowManualInput(false)
                setError(null)
                setManualCode("")
              }}
              variant="outline"
              className="w-full touch-manipulation h-12"
            >
              Back to Camera Scan
            </Button>
          </div>
        ) : !isScanning ? (
          <div className="space-y-4 p-4">
            <Button onClick={startScanning} className="w-full touch-manipulation h-16 text-lg font-semibold">
              <Camera className="h-6 w-6 mr-2" />
              Start Camera
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              onClick={() => setShowManualInput(true)}
              variant="outline"
              className="w-full touch-manipulation h-16 text-lg font-semibold bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700"
            >
              <KeyRound className="h-5 w-5 mr-2" />
              Enter Location Code
            </Button>

            <div>
              <label htmlFor="qr-upload" className="block">
                <Button
                  variant="outline"
                  className="w-full touch-manipulation h-14 text-base font-semibold bg-transparent"
                  asChild
                >
                  <span>Upload QR Image</span>
                </Button>
              </label>
              <input
                id="qr-upload"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Point your camera at the QCC location QR code, or enter the location code manually if camera is not
              working
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ WebkitPlaysinline: "true" } as React.CSSProperties}
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 sm:w-56 sm:h-56 border-4 border-primary rounded-lg relative animate-pulse">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary"></div>
                </div>
              </div>
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-4/5">
                <p className="text-white text-sm sm:text-base bg-black/70 px-4 py-2 rounded-full text-center font-medium">
                  📷 Align QR code in frame
                </p>
              </div>
            </div>

            <Button
              onClick={stopScanning}
              variant="outline"
              className="w-full touch-manipulation h-16 text-lg font-semibold bg-transparent"
            >
              <X className="h-5 w-5 mr-2" />
              Cancel Scanning
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
