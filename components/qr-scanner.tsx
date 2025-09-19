"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, CameraOff, QrCode, MapPin, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/components/ui/notification-system"

interface ScanResult {
  success: boolean
  message: string
  eventName?: string
  location?: string
  timestamp?: string
}

interface AttendanceRecord {
  id: string
  event_name: string
  location_name: string
  check_in_time: string
  status: string
}

export function QRScanner() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [recentAttendance, setRecentAttendance] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const { showSuccess, showError, showWarning } = useNotifications()
  const supabase = createClient()

  useEffect(() => {
    loadRecentAttendance()
    getCurrentLocation()

    return () => {
      stopScanning()
    }
  }, [])

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
        },
        (error) => {
          console.warn("Location access denied:", error)
          showWarning("Location access is recommended for accurate attendance tracking")
        },
      )
    }
  }

  const loadRecentAttendance = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          check_in_time,
          status,
          check_in_location_name,
          qr_events!inner(name)
        `)
        .eq("user_id", user.id)
        .order("check_in_time", { ascending: false })
        .limit(5)

      if (error) throw error

      const formattedData = data.map((record) => ({
        id: record.id,
        event_name: record.qr_events?.name || "Unknown Event",
        location_name: record.check_in_location_name || "Unknown Location",
        check_in_time: record.check_in_time,
        status: record.status,
      }))

      setRecentAttendance(formattedData)
    } catch (error) {
      console.error("Error loading recent attendance:", error)
    }
  }

  const startScanning = async () => {
    try {
      setIsLoading(true)
      setScanResult(null)

      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      setHasPermission(true)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsScanning(true)

        // Start scanning for QR codes
        scanIntervalRef.current = setInterval(scanForQRCode, 500)
      }
    } catch (error) {
      console.error("Camera access error:", error)
      setHasPermission(false)
      showError("Camera access is required for QR code scanning")
    } finally {
      setIsLoading(false)
    }
  }

  const stopScanning = () => {
    setIsScanning(false)

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
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
      // Use a QR code detection library (you'd need to install qr-scanner or similar)
      // For now, we'll simulate QR detection with a manual input fallback
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      // This is where you'd integrate with a QR code detection library
      // For demonstration, we'll use a different approach
    } catch (error) {
      console.error("QR scanning error:", error)
    }
  }

  const processQRCode = async (qrData: string) => {
    try {
      setIsLoading(true)
      stopScanning()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setScanResult({
          success: false,
          message: "Authentication required",
        })
        return
      }

      // Parse QR code data
      let eventData
      try {
        eventData = JSON.parse(qrData)
      } catch {
        setScanResult({
          success: false,
          message: "Invalid QR code format",
        })
        return
      }

      // Verify event exists and is active
      const { data: event, error: eventError } = await supabase
        .from("qr_events")
        .select(`
          *,
          geofence_locations!inner(name, latitude, longitude, radius_meters)
        `)
        .eq("qr_code_data", qrData)
        .eq("is_active", true)
        .single()

      if (eventError || !event) {
        setScanResult({
          success: false,
          message: "Event not found or inactive",
        })
        return
      }

      // Check if event is currently active (time-based)
      const now = new Date()
      const eventDate = new Date(event.event_date)
      const startTime = new Date(`${event.event_date}T${event.start_time}`)
      const endTime = new Date(`${event.event_date}T${event.end_time}`)

      if (now < startTime || now > endTime) {
        setScanResult({
          success: false,
          message: "Event is not currently active",
        })
        return
      }

      // Check location if available
      if (currentLocation && event.geofence_locations) {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          Number.parseFloat(event.geofence_locations.latitude),
          Number.parseFloat(event.geofence_locations.longitude),
        )

        if (distance > event.geofence_locations.radius_meters) {
          setScanResult({
            success: false,
            message: "You are not within the event location",
          })
          return
        }
      }

      // Check if already checked in
      const { data: existingRecord } = await supabase
        .from("qr_event_scans")
        .select("id")
        .eq("user_id", user.id)
        .eq("qr_event_id", event.id)
        .single()

      if (existingRecord) {
        setScanResult({
          success: false,
          message: "You have already checked in to this event",
        })
        return
      }

      // Record attendance
      const { error: scanError } = await supabase.from("qr_event_scans").insert({
        user_id: user.id,
        qr_event_id: event.id,
        latitude: currentLocation?.lat,
        longitude: currentLocation?.lng,
        scanned_at: new Date().toISOString(),
      })

      if (scanError) throw scanError

      setScanResult({
        success: true,
        message: "Attendance recorded successfully!",
        eventName: event.name,
        location: event.geofence_locations?.name,
        timestamp: new Date().toLocaleString(),
      })

      showSuccess(`Checked in to ${event.name}`)
      loadRecentAttendance()
    } catch (error) {
      console.error("QR processing error:", error)
      setScanResult({
        success: false,
        message: "Failed to process attendance",
      })
      showError("Failed to record attendance")
    } finally {
      setIsLoading(false)
    }
  }

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  // Manual QR input for testing/fallback
  const handleManualInput = () => {
    const qrData = prompt("Enter QR code data for testing:")
    if (qrData) {
      processQRCode(qrData)
    }
  }

  return (
    <div className="space-y-6">
      {/* QR Scanner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code Scanner
          </CardTitle>
          <CardDescription>Scan QR codes to record your attendance at events and classes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera View */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {isScanning ? (
              <>
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-primary rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                  </div>
                </div>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                  <p className="text-white text-sm bg-black/50 px-3 py-1 rounded">Position QR code within the frame</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Camera not active</p>
                  <p className="text-sm">Tap "Start Scanning" to begin</p>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {!isScanning ? (
              <Button onClick={startScanning} disabled={isLoading} className="flex-1">
                <Camera className="h-4 w-4 mr-2" />
                {isLoading ? "Starting..." : "Start Scanning"}
              </Button>
            ) : (
              <Button onClick={stopScanning} variant="destructive" className="flex-1">
                <CameraOff className="h-4 w-4 mr-2" />
                Stop Scanning
              </Button>
            )}
            <Button onClick={handleManualInput} variant="outline" className="flex-1 bg-transparent">
              Manual Input
            </Button>
          </div>

          {/* Permission Status */}
          {hasPermission === false && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Camera permission is required for QR code scanning. Please allow camera access and try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Scan Result */}
          {scanResult && (
            <Alert className={scanResult.success ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50"}>
              {scanResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={scanResult.success ? "text-green-800" : "text-red-800"}>
                <div className="space-y-1">
                  <p className="font-medium">{scanResult.message}</p>
                  {scanResult.success && scanResult.eventName && (
                    <div className="text-sm space-y-1">
                      <p>Event: {scanResult.eventName}</p>
                      {scanResult.location && <p>Location: {scanResult.location}</p>}
                      {scanResult.timestamp && <p>Time: {scanResult.timestamp}</p>}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Attendance */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Attendance</CardTitle>
          <CardDescription>Your recent check-ins and attendance records</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAttendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No recent attendance records found</div>
          ) : (
            <div className="space-y-3">
              {recentAttendance.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{record.event_name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {record.location_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(record.check_in_time).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant={record.status === "present" ? "default" : "secondary"}>{record.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
