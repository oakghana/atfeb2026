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
import { useToast } from "@/hooks/use-toast"

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
  const [isMobile, setIsMobile] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const checkMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    setIsMobile(checkMobile)
    console.log("[v0] Mobile device detected:", checkMobile)
  }, [])

  const startScanning = async () => {
    try {
      setError(null)
      setIsScanning(true)

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920, max: 1920, min: 640 },
          height: { ideal: 1080, max: 1080, min: 480 },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: false,
      }

      console.log("[v0] Requesting camera access for mobile device")
      console.log("[v0] Camera constraints:", constraints)

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported on this device")
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      console.log("[v0] Camera stream obtained successfully")

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream

        videoRef.current.setAttribute("playsinline", "true")
        videoRef.current.setAttribute("webkit-playsinline", "true")
        videoRef.current.setAttribute("muted", "true")
        videoRef.current.setAttribute("autoplay", "true")
        videoRef.current.muted = true

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Video load timeout")), 10000)

          videoRef.current!.onloadedmetadata = () => {
            clearTimeout(timeout)
            console.log("[v0] Video metadata loaded")
            resolve()
          }

          videoRef.current!.onerror = (e) => {
            clearTimeout(timeout)
            console.error("[v0] Video error:", e)
            reject(new Error("Video load error"))
          }
        })

        await videoRef.current.play()
        console.log("[v0] Camera stream started successfully, starting QR scan interval")

        setTimeout(() => {
          scanIntervalRef.current = setInterval(scanForQRCode, 300)
        }, 500)
      }
    } catch (err) {
      console.error("[v0] Camera access error:", err)

      let errorMessage = "Unable to access camera. "

      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          errorMessage += "Please allow camera permissions in your browser settings and reload the page."
        } else if (err.name === "NotFoundError") {
          errorMessage += "No camera found on your device. Try using the 'Enter Location Code' option instead."
        } else if (err.name === "NotReadableError") {
          errorMessage += "Camera is already in use by another app. Please close other apps and try again."
        } else {
          errorMessage += err.message || "Please enable camera permissions and try again."
        }
      }

      setError(errorMessage)
      toast({
        title: "Camera Error",
        description: errorMessage,
        variant: "destructive",
        duration: 8000,
      })

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
      console.log("[v0] Processing manual code:", qrDataString)

      const qrData = parseQRCode(qrDataString)
      if (qrData) {
        const validation = validateQRCode(qrData)
        if (validation.isValid) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000, // Increased timeout for mobile
                maximumAge: 0,
              })
            })

            const userLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }

            console.log("[v0] User GPS location obtained for QR check-in:", userLocation)
            console.log("[v0] Distance to location:", qrData.location_id)

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
              let errorMsg = result.error || "Failed to process QR code check-in"

              if (response.status === 403 && result.distance) {
                errorMsg = `You are too far from ${result.locationName} (${result.distance}m away). You must be within 40 meters to check in.`
              }

              console.error("[v0] QR check-in failed:", errorMsg)
              setError(errorMsg)

              toast({
                title: "Check-In Failed",
                description: errorMsg,
                variant: "destructive",
                duration: 8000,
              })
              return
            }

            const successMsg = "QR code scanned successfully!"
            setSuccess(successMsg)

            toast({
              title: "Success",
              description: successMsg,
              duration: 3000,
            })

            console.log("[v0] Valid QR code with GPS validation, calling onScanSuccess")
            onScanSuccess(result.data || qrData)
          } catch (gpsError) {
            console.error("[v0] Failed to get GPS location:", gpsError)
            const errorMsg =
              "Location access required for QR code check-in. Please enable location services. You must be within 40 meters of the location to check in."
            setError(errorMsg)

            toast({
              title: "Location Required",
              description: errorMsg,
              variant: "destructive",
              duration: 8000,
            })
          }
        } else {
          const errorMsg = validation.reason || "Invalid QR code"
          setError(errorMsg)

          toast({
            title: "Invalid QR Code",
            description: errorMsg,
            variant: "destructive",
            duration: 5000,
          })
        }
      } else {
        const errorMsg = "Invalid QR code format"
        setError(errorMsg)

        toast({
          title: "Invalid QR Code",
          description: errorMsg,
          variant: "destructive",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error("[v0] QR processing error:", error)
      const errorMsg = "Failed to process QR code"
      setError(errorMsg)

      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
        duration: 5000,
      })
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log("[v0] Processing uploaded QR image:", file.name)
    setError(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const result = e.target?.result as string

      const img = new Image()
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext("2d")

          if (!ctx) {
            setError("Failed to process image")
            return
          }

          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

          const jsQR = (await import("jsqr")).default
          const code = jsQR(imageData.data, imageData.width, imageData.height)

          if (code) {
            console.log("[v0] QR code found in uploaded image:", code.data)
            await processQRCode(code.data)
          } else {
            setError("No QR code found in image. Please try again with a clearer image.")
            toast({
              title: "No QR Code Found",
              description: "Please ensure the QR code is visible and try again.",
              variant: "destructive",
              duration: 5000,
            })
          }
        } catch (error) {
          console.error("[v0] Image processing error:", error)
          setError("Failed to process image")
        }
      }
      img.src = result
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
              <Label htmlFor="location-code" className="text-base font-semibold">
                Location Code
              </Label>
              <Input
                id="location-code"
                placeholder="e.g., HO-SWZ-001"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                className="h-16 text-lg font-mono touch-manipulation"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleManualCodeSubmit()
                  }
                }}
              />
              <p className="text-sm text-muted-foreground">Enter the location code found on the QCC location sign</p>
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
              className="w-full touch-manipulation h-14"
            >
              Back to Camera Scan
            </Button>
          </div>
        ) : !isScanning ? (
          <div className="space-y-4 p-4">
            <Button
              onClick={startScanning}
              className="w-full touch-manipulation h-20 text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Camera className="h-8 w-8 mr-3" />
              Start Camera Scanner
            </Button>

            {isMobile && (
              <div>
                <label htmlFor="qr-capture" className="block">
                  <Button
                    variant="outline"
                    className="w-full touch-manipulation h-20 text-xl font-bold bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-2 border-green-500"
                    asChild
                  >
                    <span>
                      <Camera className="h-8 w-8 mr-3" />
                      Take Photo of QR Code
                    </span>
                  </Button>
                </label>
                <input
                  id="qr-capture"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            )}

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
              className="w-full touch-manipulation h-16 text-lg font-semibold bg-blue-50 dark:bg-blue-950 border-2 border-blue-300 dark:border-blue-700"
            >
              <KeyRound className="h-5 w-5 mr-2" />
              Enter Location Code
            </Button>

            {!isMobile && (
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
                <input id="qr-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </div>
            )}

            <p className="text-sm text-center text-muted-foreground mt-4 leading-relaxed">
              {isMobile
                ? "Use your camera to scan or take a photo of the QCC location QR code. You must be within 40 meters of the location."
                : "Point your camera at the QCC location QR code, or enter the location code manually."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-64 border-4 border-white rounded-2xl relative">
                  <div className="absolute -top-2 -left-2 w-12 h-12 border-t-8 border-l-8 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute -top-2 -right-2 w-12 h-12 border-t-8 border-r-8 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute -bottom-2 -left-2 w-12 h-12 border-b-8 border-l-8 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute -bottom-2 -right-2 w-12 h-12 border-b-8 border-r-8 border-blue-500 rounded-br-lg"></div>

                  <div className="absolute inset-0 overflow-hidden">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-scan"></div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-11/12">
                <p className="text-white text-base sm:text-lg bg-black/80 px-6 py-3 rounded-full text-center font-semibold backdrop-blur-sm">
                  📷 Align QR code within frame
                </p>
              </div>
            </div>

            <Button
              onClick={stopScanning}
              variant="destructive"
              className="w-full touch-manipulation h-16 text-lg font-bold"
            >
              <X className="h-6 w-6 mr-2" />
              Stop Camera
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
