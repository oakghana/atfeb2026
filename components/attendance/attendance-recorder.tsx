"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getCurrentLocation,
  validateAttendanceLocation,
  requestLocationPermission,
  type LocationData,
} from "@/lib/geolocation"
import { getDeviceInfo } from "@/lib/device-info"
import { QRScanner } from "@/components/qr/qr-scanner"
import { validateQRCode, type QRCodeData } from "@/lib/qr-code"
import { MapPin, Clock, CheckCircle, XCircle, Loader2, AlertTriangle, QrCode, Navigation } from "lucide-react"

interface GeofenceLocation {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
}

interface AttendanceRecorderProps {
  todayAttendance?: {
    id: string
    check_in_time: string
    check_out_time?: string
    work_hours?: number
    check_in_location_name?: string
    check_out_location_name?: string
    is_remote_location?: boolean
    different_checkout_location?: boolean
  } | null
}

export function AttendanceRecorder({ todayAttendance }: AttendanceRecorderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [locations, setLocations] = useState<GeofenceLocation[]>([])
  const [locationValidation, setLocationValidation] = useState<{
    canCheckIn: boolean
    nearestLocation?: GeofenceLocation
    distance?: number
    message: string
    accuracyWarning?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [qrScanMode, setQrScanMode] = useState<"checkin" | "checkout">("checkin")
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<{
    granted: boolean | null
    message: string
  }>({ granted: null, message: "" })
  const [showLocationHelp, setShowLocationHelp] = useState(false)

  useEffect(() => {
    fetchLocations()
  }, [])

  useEffect(() => {
    if (userLocation && locations.length > 0) {
      const validation = validateAttendanceLocation(userLocation, locations)
      setLocationValidation(validation)
    }
  }, [userLocation, locations])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/attendance/locations")
      const result = await response.json()
      if (result.success) {
        setLocations(result.data)
      }
    } catch (error) {
      console.error("Failed to fetch locations:", error)
    }
  }

  const getCurrentLocationData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const location = await getCurrentLocation()
      setUserLocation(location)
      setLocationPermissionStatus({ granted: true, message: "Location access granted" })
      return location
    } catch (error) {
      if (error instanceof Error && error.message.includes("Location access denied")) {
        setLocationPermissionStatus({
          granted: false,
          message: error.message,
        })
        setShowLocationHelp(true)
      }
      const message = error instanceof Error ? error.message : "Failed to get location"
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckIn = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const location = await getCurrentLocation()
      setUserLocation(location)

      const validation = validateAttendanceLocation(location, locations)

      if (!validation.canCheckIn) {
        setError(validation.message)
        return
      }

      const deviceInfo = getDeviceInfo()

      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          location_id: validation.nearestLocation!.id,
          device_info: deviceInfo,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const locationInfo = result.data.location_tracking
        let message = result.message

        if (locationInfo?.is_remote_location) {
          message += " (Note: This is different from your assigned location)"
        }

        setSuccess(message)
        window.location.reload()
      } else {
        setError(result.error || "Failed to check in")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check in"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckOut = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      let location = null
      let nearestLocation = null

      try {
        location = await getCurrentLocation()
        setUserLocation(location)
        console.log("[v0] Location acquired for check-out:", location)

        const nearest = findNearestLocation(location, locations)
        nearestLocation = nearest?.location || locations[0]
      } catch (locationError) {
        console.log("[v0] Location unavailable for check-out, proceeding without GPS:", locationError)
        nearestLocation = locations[0] // Use first available location as fallback
      }

      console.log("[v0] Attempting check-out with location:", nearestLocation?.name)

      const requestBody = {
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        location_id: nearestLocation?.id || null,
      }

      console.log("[v0] Check-out request body:", requestBody)

      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()
      console.log("[v0] Check-out response:", result)

      if (result.success) {
        setSuccess(result.message)
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        setError(result.error || "Failed to check out")
      }
    } catch (error) {
      console.error("[v0] Check-out error:", error)
      const message = error instanceof Error ? error.message : "Failed to check out"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQRCheckIn = async (qrData: QRCodeData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setShowQRScanner(false)

    try {
      const validation = validateQRCode(qrData)
      if (!validation.isValid) {
        setError(validation.reason || "Invalid QR code")
        return
      }

      const location = locations.find((loc) => loc.id === qrData.locationId)
      if (!location) {
        setError("Location not found")
        return
      }

      const deviceInfo = getDeviceInfo()

      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location_id: location.id,
          device_info: deviceInfo,
          qr_code_used: true,
          qr_timestamp: qrData.timestamp,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(result.message)
        window.location.reload()
      } else {
        setError(result.error || "Failed to check in with QR code")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check in with QR code"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleQRCheckOut = async (qrData: QRCodeData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setShowQRScanner(false)

    try {
      const validation = validateQRCode(qrData)
      if (!validation.isValid) {
        setError(validation.reason || "Invalid QR code")
        return
      }

      const location = locations.find((loc) => loc.id === qrData.locationId)
      if (!location) {
        setError("Location not found")
        return
      }

      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location_id: location.id,
          qr_code_used: true,
          qr_timestamp: qrData.timestamp,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setSuccess(result.message)
        window.location.reload()
      } else {
        setError(result.error || "Failed to check out")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check out"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRequestLocationPermission = async () => {
    setIsLoading(true)
    setError(null)

    const result = await requestLocationPermission()
    setLocationPermissionStatus(result)

    if (result.granted) {
      setShowLocationHelp(false)
      await getCurrentLocationData()
    } else {
      setError(result.message)
      setShowLocationHelp(true)
    }

    setIsLoading(false)
  }

  const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time
  const isCheckedOut = todayAttendance?.check_out_time
  const canCheckIn = !todayAttendance?.check_in_time
  const canCheckOut = isCheckedIn

  const findNearestLocation = (userLocation: LocationData, locations: GeofenceLocation[]) => {
    // Placeholder for finding nearest location logic
    return { location: locations[0] }
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Status
          </CardTitle>
          <CardDescription>Your current attendance status for today</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Status:</span>
            <Badge variant={isCheckedOut ? "default" : isCheckedIn ? "secondary" : "outline"}>
              {isCheckedOut ? "Completed" : isCheckedIn ? "Checked In" : "Not Checked In"}
            </Badge>
          </div>

          {todayAttendance?.check_in_time && (
            <div className="flex items-center justify-between">
              <span>Check-in Time:</span>
              <span className="font-medium">{new Date(todayAttendance.check_in_time).toLocaleTimeString()}</span>
            </div>
          )}

          {todayAttendance?.check_in_location_name && (
            <div className="flex items-center justify-between">
              <span>Check-in Location:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{todayAttendance.check_in_location_name}</span>
                {todayAttendance.is_remote_location && (
                  <Badge variant="outline" className="text-xs">
                    <Navigation className="h-3 w-3 mr-1" />
                    Remote
                  </Badge>
                )}
              </div>
            </div>
          )}

          {todayAttendance?.check_out_time && (
            <div className="flex items-center justify-between">
              <span>Check-out Time:</span>
              <span className="font-medium">{new Date(todayAttendance.check_out_time).toLocaleTimeString()}</span>
            </div>
          )}

          {todayAttendance?.check_out_location_name && (
            <div className="flex items-center justify-between">
              <span>Check-out Location:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{todayAttendance.check_out_location_name}</span>
                {todayAttendance.different_checkout_location && (
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    Different
                  </Badge>
                )}
              </div>
            </div>
          )}

          {todayAttendance?.work_hours && (
            <div className="flex items-center justify-between">
              <span>Work Hours:</span>
              <span className="font-medium">{todayAttendance.work_hours.toFixed(2)} hours</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Status
          </CardTitle>
          <CardDescription>
            Your current location relative to QCC Stations/Locations (20m precision required for check-in)
            <br />
            <span className="text-sm text-muted-foreground">
              Check-in requires being within 20m of a QCC location. Check-out can be done from anywhere within the
              company.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!userLocation ? (
            <div className="space-y-3">
              <Button
                onClick={getCurrentLocationData}
                disabled={isLoading}
                variant="outline"
                className="w-full bg-transparent"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Get Current Location
                  </>
                )}
              </Button>

              {showLocationHelp && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <div className="font-medium">Location Access Required</div>
                    <div className="text-sm whitespace-pre-line">{locationPermissionStatus.message}</div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={handleRequestLocationPermission} disabled={isLoading}>
                        Try Again
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowLocationHelp(false)}
                        className="bg-transparent"
                      >
                        Use QR Code Instead
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Location acquired</span>
              </div>

              {locationValidation?.accuracyWarning && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{locationValidation.accuracyWarning}</AlertDescription>
                </Alert>
              )}

              {locationValidation && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="font-medium">{locationValidation.nearestLocation?.name || "Unknown Location"}</div>
                  {locationValidation.nearestLocation?.address && (
                    <div className="text-sm text-muted-foreground">{locationValidation.nearestLocation.address}</div>
                  )}
                  <div className="text-sm mt-1">
                    Distance: <span className="font-medium">{locationValidation.distance}m</span>
                  </div>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-2">
                      {locationValidation.canCheckIn ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-600">Within 20m - Can check in</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-600">Outside 20m range - Cannot check in</span>
                        </>
                      )}
                    </div>
                    {canCheckOut && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600">Check-out allowed from any QCC location</span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm mt-2 text-muted-foreground">
                    {canCheckIn ? "Ready for check-in" : "Move closer to check in, or check out from anywhere"}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Record your attendance using GPS (20m precision) or QR code at any QCC location
            {!userLocation && " - QR code works without location access"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            {/* GPS Check-in/out buttons */}
            <div className="grid gap-3 md:grid-cols-2">
              <Button onClick={handleCheckIn} disabled={!canCheckIn || isLoading} className="h-12" size="lg">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                GPS Check In
              </Button>

              <Button
                onClick={handleCheckOut}
                disabled={!canCheckOut || isLoading}
                variant="outline"
                className="h-12 bg-transparent"
                size="lg"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
                Check Out (Any Location)
              </Button>
            </div>

            {/* QR code check-in/out buttons */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or use QR Code</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Dialog
                open={showQRScanner && qrScanMode === "checkin"}
                onOpenChange={(open) => {
                  setShowQRScanner(open)
                  if (open) setQrScanMode("checkin")
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    disabled={!canCheckIn || isLoading}
                    variant="outline"
                    className="h-12 bg-transparent"
                    size="lg"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    QR Check In
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Check In with QR Code</DialogTitle>
                    <DialogDescription>Scan the location QR code to check in at any QCC location</DialogDescription>
                  </DialogHeader>
                  <QRScanner onScanSuccess={handleQRCheckIn} onClose={() => setShowQRScanner(false)} />
                </DialogContent>
              </Dialog>

              <Dialog
                open={showQRScanner && qrScanMode === "checkout"}
                onOpenChange={(open) => {
                  setShowQRScanner(open)
                  if (open) setQrScanMode("checkout")
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    disabled={!canCheckOut || isLoading}
                    variant="outline"
                    className="h-12 bg-transparent"
                    size="lg"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    QR Check Out
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Check Out with QR Code</DialogTitle>
                    <DialogDescription>Scan the location QR code to check out</DialogDescription>
                  </DialogHeader>
                  <QRScanner onScanSuccess={handleQRCheckOut} onClose={() => setShowQRScanner(false)} />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {!canCheckIn && !canCheckOut && (
            <p className="text-sm text-muted-foreground text-center">You have completed your attendance for today.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
