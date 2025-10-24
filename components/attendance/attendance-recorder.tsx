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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  getCurrentLocation,
  validateAttendanceLocation,
  validateCheckoutLocation,
  requestLocationPermission,
  calculateDistance,
  detectWindowsLocationCapabilities,
  watchLocation,
  type LocationData,
  type ProximitySettings,
} from "@/lib/geolocation"
import { getDeviceInfo } from "@/lib/device-info"
import { validateQRCode, type QRCodeData } from "@/lib/qr-code"
import { MapPin, Clock, Loader2, AlertTriangle, Navigation, Wifi, WifiOff, Building, QrCode } from "lucide-react"
import { useRealTimeLocations } from "@/hooks/use-real-time-locations"
import { createClient } from "@/lib/supabase/client"
import QrScanner from "qr-scanner" // Import QrScanner
import { useRef } from "react" // Import React and useRef

interface GeofenceLocation {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
}

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  employee_id: string
  position: string
  assigned_location_id?: string
  departments?: {
    name: string
    code: string
  }
}

interface AssignedLocationInfo {
  location: GeofenceLocation
  distance?: number
  isAtAssignedLocation: boolean
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [assignedLocationInfo, setAssignedLocationInfo] = useState<AssignedLocationInfo | null>(null)
  const { locations, loading: locationsLoading, error: locationsError, isConnected } = useRealTimeLocations()
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings>({
    checkInProximityRange: 50,
    defaultRadius: 20,
    requireHighAccuracy: true,
    allowManualOverride: false,
  })
  const [locationValidation, setLocationValidation] = useState<{
    canCheckIn: boolean
    canCheckOut?: boolean
    nearestLocation?: GeofenceLocation
    distance?: number
    message: string
    accuracyWarning?: string
    allLocations?: { location: GeofenceLocation; distance: number }[]
    availableLocations?: { location: GeofenceLocation; distance: number }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [successDialogMessage, setSuccessDialogMessage] = useState("")
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [qrScanMode, setQrScanMode] = useState<"checkin" | "checkout">("checkin")
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<{
    granted: boolean | null
    message: string
  }>({ granted: null, message: "" })
  const [showLocationHelp, setShowLocationHelp] = useState(false)
  const [windowsCapabilities, setWindowsCapabilities] = useState<ReturnType<
    typeof detectWindowsLocationCapabilities
  > | null>(null)
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split("T")[0])
  const [showEarlyCheckoutDialog, setShowEarlyCheckoutDialog] = useState(false)
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState("")
  const [pendingCheckoutData, setPendingCheckoutData] = useState<{
    location: LocationData | null
    nearestLocation: any
  } | null>(null)

  // QR Scanner state and refs
  const qrScannerRef = useRef<QrScanner | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrResultRef = useRef<string | null>(null)

  const handleUseQRCode = (mode: "checkin" | "checkout") => {
    // Redirect to QR Events page with mode parameter
    window.location.href = `/dashboard/qr-events?mode=${mode}`
  }

  useEffect(() => {
    fetchUserProfile()
    loadProximitySettings()
    const capabilities = detectWindowsLocationCapabilities()
    setWindowsCapabilities(capabilities)
    console.log("[v0] Windows location capabilities detected:", capabilities)
  }, [])

  useEffect(() => {
    loadProximitySettings()
  }, [])

  useEffect(() => {
    const checkDateChange = () => {
      const newDate = new Date().toISOString().split("T")[0]
      if (newDate !== currentDate) {
        console.log("[v0] Date changed from", currentDate, "to", newDate)
        setCurrentDate(newDate)
        // Force re-render to update button state
        window.location.reload()
      }
    }

    // Check every minute for date changes
    const interval = setInterval(checkDateChange, 60000)

    return () => clearInterval(interval)
  }, [currentDate])

  const loadProximitySettings = async () => {
    try {
      const response = await fetch("/api/settings")
      if (response.ok) {
        const data = await response.json()
        if (data.systemSettings?.geo_settings) {
          const geoSettings = data.systemSettings.geo_settings
          setProximitySettings({
            checkInProximityRange: Number.parseInt(geoSettings.checkInProximityRange) || 50,
            defaultRadius: Number.parseInt(geoSettings.defaultRadius) || 20,
            requireHighAccuracy: geoSettings.requireHighAccuracy ?? true,
            allowManualOverride: geoSettings.allowManualOverride ?? false,
          })
          console.log("[v0] Loaded proximity settings:", {
            checkInProximityRange: Number.parseInt(geoSettings.checkInProximityRange) || 50,
            defaultRadius: Number.parseInt(geoSettings.defaultRadius) || 20,
          })
        }
      }
    } catch (error) {
      console.error("[v0] Failed to load proximity settings:", error)
      // Keep default settings if loading fails
    }
  }

  useEffect(() => {
    if (userLocation && locations.length > 0 && userProfile?.assigned_location_id) {
      const assignedLocation = locations.find((loc) => loc.id === userProfile.assigned_location_id)
      if (assignedLocation) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          assignedLocation.latitude,
          assignedLocation.longitude,
        )
        const isAtAssignedLocation = distance <= assignedLocation.radius_meters

        setAssignedLocationInfo({
          location: assignedLocation,
          distance: Math.round(distance),
          isAtAssignedLocation,
        })

        console.log("[v0] Assigned location info:", {
          name: assignedLocation.name,
          distance: Math.round(distance),
          isAtAssignedLocation,
          radius: assignedLocation.radius_meters,
        })
      }
    }
  }, [userLocation, locations, userProfile])

  useEffect(() => {
    if (userLocation && locations.length > 0) {
      console.log(
        "[v0] All available locations:",
        locations.map((l) => ({
          name: l.name,
          address: l.address,
          lat: l.latitude,
          lng: l.longitude,
          radius: l.radius_meters,
        })),
      )

      console.log("[v0] User location:", {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        accuracy: userLocation.accuracy,
      })

      const locationDistances = locations
        .map((location) => {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            location.latitude,
            location.longitude,
          )
          return {
            location,
            distance: Math.round(distance),
          }
        })
        .sort((a, b) => a.distance - b.distance)

      console.log("[v0] Distance to each location:", locationDistances)

      const validation = validateAttendanceLocation(userLocation, locations, proximitySettings)
      const checkoutValidation = validateCheckoutLocation(userLocation, locations, proximitySettings)

      console.log("[v0] Location validation result:", validation)
      console.log("[v0] Check-out validation result:", checkoutValidation)
      console.log(
        "[v0] Locations data:",
        locations.map((l) => ({ name: l.name, radius: l.radius_meters })),
      )
      console.log("[v0] Validation message:", validation.message)
      console.log("[v0] Can check in:", validation.canCheckIn)
      console.log("[v0] Can check out:", checkoutValidation.canCheckOut)
      console.log("[v0] Distance:", validation.distance)
      console.log("[v0] Nearest location being checked:", validation.nearestLocation?.name)
      console.log("[v0] Using proximity range:", proximitySettings.checkInProximityRange)

      setLocationValidation({
        ...validation,
        canCheckOut: checkoutValidation.canCheckOut,
        allLocations: locationDistances,
      })
    }
  }, [userLocation, locations, proximitySettings])

  const fetchUserProfile = async () => {
    try {
      console.log("[v0] Fetching user profile...")
      const supabase = createClient()

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          console.log("[v0] No authenticated user found")
          return
        }

        const { data: profileData, error } = await supabase
          .from("user_profiles")
          .select(`
            id,
            first_name,
            last_name,
            employee_id,
            position,
            assigned_location_id,
            departments (
              name,
              code
            )
          `)
          .eq("id", user.id)
          .single()

        if (error) {
          console.error("[v0] Failed to fetch user profile:", error)
          return
        }

        setUserProfile(profileData)
        console.log("[v0] User profile loaded:", {
          name: `${profileData.first_name} ${profileData.last_name}`,
          employee_id: profileData.employee_id,
          position: profileData.position,
          assigned_location_id: profileData.assigned_location_id,
          department: profileData.departments?.name,
        })
      } catch (authError) {
        console.error("[v0] Supabase auth error:", authError)
        // Don't set error state for auth issues in preview environment
        if (!window.location.hostname.includes("vusercontent.net")) {
          setError("Authentication error. Please refresh the page.")
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching user profile:", error)
      // Only show error in production environment
      if (!window.location.hostname.includes("vusercontent.net")) {
        setError("Failed to load user profile. Please refresh the page.")
      }
    }
  }

  const getCurrentLocationData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log("[v0] Requesting location with Windows optimization...")
      const location = await getCurrentLocation()
      setUserLocation(location)
      setLocationPermissionStatus({ granted: true, message: "Location access granted" })

      if (windowsCapabilities?.isWindows && !locationWatchId) {
        const watchId = watchLocation(
          (updatedLocation) => {
            console.log("[v0] Location updated via Windows Location Services:", updatedLocation)
            setUserLocation(updatedLocation)
          },
          (error) => {
            console.log("[v0] Location watch error:", error.message)
            // Don't show errors for watch failures, just log them
          },
        )
        if (watchId) {
          setLocationWatchId(watchId)
        }
      }

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

  useEffect(() => {
    return () => {
      if (locationWatchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(locationWatchId)
      }
    }
  }, [locationWatchId])

  const handleCheckIn = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const location = await getCurrentLocation()
      setUserLocation(location)

      if (!locationValidation?.canCheckIn) {
        setError(`You must be within ${proximitySettings.checkInProximityRange}m of a QCC location to check in`)
        setIsLoading(false)
        return
      }

      let targetLocationId = null

      // First priority: Use user's assigned location if they're within range
      if (userProfile?.assigned_location_id && assignedLocationInfo?.isAtAssignedLocation) {
        targetLocationId = userProfile.assigned_location_id
        console.log("[v0] Automatically using assigned location for check-in:", assignedLocationInfo.location.name)
      }
      // Second priority: Use the nearest available location automatically
      else if (locationValidation.availableLocations && locationValidation.availableLocations.length > 0) {
        targetLocationId = locationValidation.availableLocations[0].location.id
        console.log(
          "[v0] Automatically using nearest available location for check-in:",
          locationValidation.availableLocations[0].location.name,
        )
      }

      const targetLocation = locations.find((loc) => loc.id === targetLocationId)

      if (!targetLocation) {
        setError(`No location available for check-in within ${proximitySettings.checkInProximityRange}m range`)
        setIsLoading(false)
        return
      }

      const deviceInfo = getDeviceInfo()

      console.log("[v0] Performing automatic check-in at:", targetLocation.name)

      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          location_id: targetLocation.id,
          device_info: deviceInfo,
        }),
      })

      const result = await response.json()

      if (result.success) {
        const locationInfo = result.data.location_tracking
        let message = result.message

        if (result.missedCheckoutWarning) {
          setError(
            `⚠️ IMPORTANT: ${result.missedCheckoutWarning.message}\n\nYour previous day's attendance has been automatically closed at 11:59 PM. This will be visible to your department head.`,
          )
          setTimeout(() => {
            setError(null)
            if (locationInfo?.is_remote_location) {
              message += " (Note: This is different from your assigned location)"
            }
            setSuccessDialogMessage(message)
            setShowSuccessDialog(true)
            setTimeout(() => {
              window.location.reload()
            }, 70000)
          }, 70000)
          return
        }

        if (locationInfo?.is_remote_location) {
          message += " (Note: This is different from your assigned location)"
        }

        setSuccessDialogMessage(message)
        setShowSuccessDialog(true)
        setTimeout(() => {
          window.location.reload()
        }, 70000)
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

        const checkoutValidation = validateCheckoutLocation(location, locations, proximitySettings)

        if (!checkoutValidation.canCheckOut) {
          setError(
            `Check-out requires being within ${proximitySettings.checkInProximityRange}m of any QCC location. ${checkoutValidation.message}`,
          )
          setIsLoading(false)
          return
        }

        if (locations.length > 1) {
          const locationDistances = locations
            .map((loc) => {
              const distance = calculateDistance(location.latitude, location.longitude, loc.latitude, loc.longitude)
              return { location: loc, distance: Math.round(distance) }
            })
            .sort((a, b) => a.distance - b.distance)
            .filter(({ distance }) => distance <= proximitySettings.checkInProximityRange)

          setLocationValidation((prev) => ({
            ...prev,
            availableLocations: locationDistances,
          }))

          if (locationDistances.length === 0) {
            setError(`No QCC locations within ${proximitySettings.checkInProximityRange}m range for check-out`)
            setIsLoading(false)
            return
          }

          // Automatically select the best location for check-out
          if (userProfile?.assigned_location_id && assignedLocationInfo?.isAtAssignedLocation) {
            nearestLocation = locations.find((loc) => loc.id === userProfile.assigned_location_id)
            console.log("[v0] Automatically using assigned location for check-out:", nearestLocation?.name)
          } else {
            nearestLocation = locationDistances[0]?.location
            console.log("[v0] Automatically using nearest location for check-out:", nearestLocation?.name)
          }
        } else {
          const nearest = findNearestLocation(location, locations)
          nearestLocation = nearest?.location || locations[0]
        }
      } catch (locationError) {
        console.log("[v0] Location unavailable for check-out:", locationError)
        setError("Location is required for check-out. Please enable GPS or use a QR code.")
        setIsLoading(false)
        return
      }

      const currentHour = new Date().getHours()
      if (currentHour < 17) {
        // Before 5:00 PM
        setPendingCheckoutData({ location, nearestLocation })
        setShowEarlyCheckoutDialog(true)
        setIsLoading(false)
        return
      }

      await performCheckout(location, nearestLocation, null)
    } catch (error) {
      console.error("[v0] Check-out error:", error)
      const message = error instanceof Error ? error.message : "Failed to check out"
      setError(message)
      setIsLoading(false)
    }
  }

  const performCheckout = async (location: LocationData | null, nearestLocation: any, reason: string | null) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("[v0] Attempting automatic check-out with location:", nearestLocation?.name)

      const requestBody = {
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        location_id: nearestLocation?.id || null,
        early_checkout_reason: reason || null,
      }

      console.log("[v0] Check-out request body:", requestBody)

      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      let result
      const responseText = await response.text()

      try {
        result = JSON.parse(responseText)
      } catch {
        // If not JSON, treat as error message
        result = { error: responseText || `Server error (${response.status})` }
      }

      if (!response.ok) {
        setError(result.error || result.message || "Failed to check out")
        setIsLoading(false)
        return
      }

      console.log("[v0] Check-out response:", result)

      if (result.success) {
        if (result.earlyCheckoutWarning) {
          setError(
            `⚠️ EARLY CHECKOUT WARNING: ${result.earlyCheckoutWarning.message}\n\nYou are checking out before the standard 5:00 PM end time. This will be recorded and visible to your department head.`,
          )
          setTimeout(() => {
            setError(null)
            setSuccessDialogMessage(result.message)
            setShowSuccessDialog(true)
            setTimeout(() => {
              window.location.reload()
            }, 70000)
          }, 70000)
          return
        }

        setSuccessDialogMessage(result.message)
        setShowSuccessDialog(true)
        setTimeout(() => {
          window.location.reload()
        }, 70000)
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

  const handleEarlyCheckoutConfirm = async () => {
    if (!earlyCheckoutReason.trim()) {
      setError("Please provide a reason for early checkout")
      return
    }

    setShowEarlyCheckoutDialog(false)

    if (pendingCheckoutData) {
      await performCheckout(
        pendingCheckoutData.location,
        pendingCheckoutData.nearestLocation,
        earlyCheckoutReason.trim(),
      )
    }

    // Reset state
    setEarlyCheckoutReason("")
    setPendingCheckoutData(null)
  }

  const handleEarlyCheckoutCancel = () => {
    setShowEarlyCheckoutDialog(false)
    setEarlyCheckoutReason("")
    setPendingCheckoutData(null)
    setIsLoading(false)
  }

  // QR Scanner functions
  const startScanner = async () => {
    if (!videoRef.current) return

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      videoRef.current.srcObject = stream

      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          qrResultRef.current = result.data // Store result in ref
          if (qrScanMode === "checkin") {
            handleQRCheckIn(JSON.parse(result.data))
          } else {
            handleQRCheckOut(JSON.parse(result.data))
          }
          setShowQRScanner(false) // Close scanner after successful scan
          qrScannerRef.current?.stop() // Stop the scanner
        },
        {
          // options: https://qr-scanner.github.io/api/#/ScannerOptions
          highlightScanRegion: true,
          highlightCodeOutline: true,
        },
      )

      await qrScannerRef.current.start()
    } catch (error) {
      console.error("Failed to start QR scanner:", error)
      setError("Could not start camera. Please check permissions or try again.")
      setShowQRScanner(false) // Close scanner if camera fails
    }
  }

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop()
      qrScannerRef.current = null
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    if (showQRScanner) {
      startScanner()
    } else {
      stopScanner()
    }
    return () => stopScanner() // Cleanup on unmount
  }, [showQRScanner, qrScanMode])

  const handleQRCheckIn = async (qrData: QRCodeData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setShowQRScanner(false) // Ensure scanner is closed

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
        const message = result.message

        if (result.missedCheckoutWarning) {
          setError(
            `⚠️ IMPORTANT: ${result.missedCheckoutWarning.message}\n\nYour previous day's attendance has been automatically closed at 11:59 PM. This will be visible to your department head.`,
          )
          setTimeout(() => {
            setError(null)
            setSuccessDialogMessage(message)
            setShowSuccessDialog(true)
            setTimeout(() => {
              window.location.reload()
            }, 70000)
          }, 70000)
          return
        }

        setSuccessDialogMessage(message)
        setShowSuccessDialog(true)
        setTimeout(() => {
          window.location.reload()
        }, 70000)
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
    setShowQRScanner(false) // Ensure scanner is closed

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

  const handleRefreshLocations = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const timestamp = Date.now()
      const response = await fetch(`/api/attendance/user-location?refresh=${timestamp}`, {
        cache: "no-store",
      })

      if (response.ok) {
        window.location.reload()
      } else {
        const result = await response.json()
        if (response.status === 403) {
          setError("Location access restricted. Please contact your administrator.")
        } else {
          setError(result.error || "Failed to refresh location data")
        }
      }
    } catch (error) {
      setError("Failed to refresh location data")
    } finally {
      setIsLoading(false)
    }
  }

  const checkInDate = todayAttendance?.check_in_time
    ? new Date(todayAttendance.check_in_time).toISOString().split("T")[0]
    : null

  // If check-in was from a previous day, treat as if no check-in exists (allow new check-in)
  const isFromPreviousDay = checkInDate && checkInDate !== currentDate

  const isCheckedIn = todayAttendance?.check_in_time && !todayAttendance?.check_out_time && !isFromPreviousDay
  const isCheckedOut = todayAttendance?.check_out_time
  const canCheckIn = !todayAttendance?.check_in_time || isFromPreviousDay
  const canCheckOut = isCheckedIn && !isFromPreviousDay

  const defaultMode = canCheckIn ? "checkin" : canCheckOut ? "checkout" : "completed"

  const findNearestLocation = (userLocation: LocationData, locations: GeofenceLocation[]) => {
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
            {windowsCapabilities?.isWindows && (
              <Badge variant="outline" className="text-xs ml-auto">
                Windows Location Services
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Your current attendance status for today
            {windowsCapabilities?.isWindows && (
              <span className="block text-xs mt-1 text-muted-foreground">
                Using Windows Location Services for enhanced accuracy ({windowsCapabilities.supportedSources.join(", ")}
                )
              </span>
            )}
          </CardDescription>
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
            <div className="flex items-center gap-1 ml-auto">
              {isConnected ? (
                <div className="flex items-center gap-1 text-green-600 text-xs">
                  <Wifi className="h-3 w-3" />
                  <span>Live Updates</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-orange-600 text-xs">
                  <WifiOff className="h-3 w-3" />
                  <span>Offline</span>
                </div>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Your current location relative to QCC Stations/Locations ({proximitySettings.checkInProximityRange}m
            proximity required for check-in)
            <br />
            {windowsCapabilities?.isWindows ? (
              <>
                Check-in requires being within {proximitySettings.checkInProximityRange}m of any QCC location. Windows
                Location Services provide enhanced accuracy using GPS, Wi-Fi, and cellular data. Location data updates
                automatically when admins make changes.
              </>
            ) : (
              <>
                Check-in requires being within {proximitySettings.checkInProximityRange}m of any QCC location. Check-out
                can be done from anywhere within 50m of the company. Location data updates automatically when admins
                make changes.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userProfile && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-lg">
              <div className="font-medium text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                <Building className="h-4 w-4" />
                Your Assignment Information
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-300">Employee:</span>
                  <span className="font-medium text-green-900 dark:text-green-100">
                    {userProfile.first_name} {userProfile.last_name} ({userProfile.employee_id})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-300">Position:</span>
                  <span className="font-medium text-green-900 dark:text-green-100">{userProfile.position}</span>
                </div>
                {userProfile.departments && (
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Department:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">
                      {userProfile.departments.name}
                    </span>
                  </div>
                )}
                {assignedLocationInfo ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-green-700 dark:text-green-300">Assigned Location:</span>
                      <span className="font-medium text-green-900 dark:text-green-100">
                        {assignedLocationInfo.location.name}
                      </span>
                    </div>
                    {assignedLocationInfo.distance !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-green-700 dark:text-green-300">Distance to Assignment:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-green-900 dark:text-green-100">
                            {assignedLocationInfo.distance}m
                          </span>
                          {assignedLocationInfo.isAtAssignedLocation ? (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200"
                            >
                              At Assigned Location
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200"
                            >
                              Remote Location
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : userProfile.assigned_location_id ? (
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Assigned Location:</span>
                    <span className="font-medium text-green-900 dark:text-green-100">Loading...</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-green-700 dark:text-green-300">Assigned Location:</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">Not assigned</span>
                  </div>
                )}
                <div className="mt-2 p-2 bg-green-100 dark:bg-green-900/20 rounded text-xs">
                  <span className="text-green-800 dark:text-green-200">
                    ✓ You can check in at any QCC location within 50 meters of your current position
                  </span>
                </div>
              </div>
            </div>
          )}

          {locationsLoading && locations.length === 0 ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading location data...</span>
            </div>
          ) : !userLocation ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  onClick={getCurrentLocationData}
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1 bg-transparent"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {windowsCapabilities?.isWindows ? "Getting Windows Location..." : "Getting Location..."}
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      {windowsCapabilities?.isWindows ? "Get Windows Location" : "Get Current Location"}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRefreshLocations}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  title="Refresh location data"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>

              {showLocationHelp && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <div className="font-medium">
                      {windowsCapabilities?.isWindows ? "Windows Location Access Required" : "Location Access Required"}
                    </div>
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
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                <div className="font-medium text-blue-900 dark:text-blue-100 mb-2">Current Location</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Coordinates:</span>
                    <span className="font-mono text-blue-900 dark:text-blue-100">
                      {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700 dark:text-blue-300">Accuracy:</span>
                    <span className="font-medium text-blue-900 dark:text-blue-100">
                      ±{Math.round(userLocation.accuracy)}m
                    </span>
                  </div>
                  {userLocation.timestamp && (
                    <div className="flex justify-between">
                      <span className="text-blue-700 dark:text-blue-300">Updated:</span>
                      <span className="font-medium text-blue-900 dark:text-blue-100">
                        {new Date(userLocation.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {locationValidation && (
                <div className="space-y-2">
                  <div
                    className={`p-3 rounded-lg border ${
                      locationValidation.canCheckIn
                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50"
                        : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50"
                    }`}
                  >
                    <div
                      className={`font-medium mb-2 ${
                        locationValidation.canCheckIn
                          ? "text-green-900 dark:text-green-100"
                          : "text-orange-900 dark:text-orange-100"
                      }`}
                    >
                      Location Validation
                    </div>
                    <div
                      className={`text-sm ${
                        locationValidation.canCheckIn
                          ? "text-green-700 dark:text-green-300"
                          : "text-orange-700 dark:text-orange-300"
                      }`}
                    >
                      {locationValidation.message}
                    </div>
                    {locationValidation.nearestLocation && locationValidation.distance !== undefined && (
                      <div className="mt-2 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span>Nearest Location:</span>
                          <span className="font-medium">{locationValidation.nearestLocation.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Distance:</span>
                          <span className="font-medium">{Math.round(locationValidation.distance)}m</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {locationValidation.allLocations && locationValidation.allLocations.length > 0 && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800/50 rounded-lg">
                      <div className="font-medium text-gray-900 dark:text-gray-100 mb-2 text-sm">
                        All QCC Locations (Distance)
                      </div>
                      <div className="space-y-1 text-xs">
                        {locationValidation.allLocations.slice(0, 5).map(({ location, distance }) => (
                          <div key={location.id} className="flex justify-between">
                            <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{location.name}</span>
                            <span
                              className={`font-medium ${
                                distance <= proximitySettings.checkInProximityRange
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {distance}m
                            </span>
                          </div>
                        ))}
                        {locationValidation.allLocations.length > 5 && (
                          <div className="text-gray-500 dark:text-gray-400 text-center">
                            ... and {locationValidation.allLocations.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={getCurrentLocationData}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                >
                  <Navigation className="mr-2 h-4 w-4" />
                  Refresh Location
                </Button>
                <Button
                  onClick={handleRefreshLocations}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                  className="bg-transparent"
                  title="Refresh location data"
                >
                  <Loader2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Check in or out of your work location</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {canCheckIn && (
              <Button
                onClick={handleCheckIn}
                disabled={isLoading || !locationValidation?.canCheckIn}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Check In
                  </>
                )}
              </Button>
            )}

            {canCheckOut && (
              <Button onClick={handleCheckOut} disabled={isLoading} variant="outline" className="flex-1 bg-transparent">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking Out...
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Check Out
                  </>
                )}
              </Button>
            )}
          </div>

          {!locationValidation?.canCheckIn && canCheckIn && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground text-center">
                You must be within {proximitySettings.checkInProximityRange}m of a QCC location to check in
              </div>
              <Button
                onClick={() => handleUseQRCode("checkin")}
                variant="outline"
                className="w-full bg-transparent"
                disabled={isLoading}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Use QR Code Instead
              </Button>
            </div>
          )}

          {!locationValidation?.canCheckOut && canCheckOut && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground text-center">
                You must be within {proximitySettings.checkInProximityRange}m of a QCC location to check out
              </div>
              <Button
                onClick={() => handleUseQRCode("checkout")}
                variant="outline"
                className="w-full bg-transparent"
                disabled={isLoading}
              >
                <QrCode className="mr-2 h-4 w-4" />
                Use QR Code Instead
              </Button>
            </div>
          )}

          <div className="pt-2 border-t">
            <Button
              onClick={() => window.location.reload()}
              disabled={isLoading}
              variant="secondary"
              className="w-full"
              size="sm"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Refresh Attendance Status
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Click to manually update your attendance status if the buttons don't change after check-in/check-out
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEarlyCheckoutDialog} onOpenChange={setShowEarlyCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Early Checkout Confirmation</DialogTitle>
            <DialogDescription>
              You are checking out before the standard 5:00 PM end time. Please provide a reason for this early
              checkout. This will be recorded and visible to your department head.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Early Checkout *</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why you are checking out early..."
                value={earlyCheckoutReason}
                onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleEarlyCheckoutCancel} className="bg-transparent">
              Cancel
            </Button>
            <Button onClick={handleEarlyCheckoutConfirm} disabled={!earlyCheckoutReason.trim()}>
              Confirm Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Clock className="h-5 w-5" />
              Success!
            </DialogTitle>
            <DialogDescription className="text-base pt-4">{successDialogMessage}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50">
              <AlertDescription className="text-green-700 dark:text-green-300 text-sm">
                Your attendance status will automatically update in a moment. The page will refresh in 70 seconds to
                show your updated status.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Refresh Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
