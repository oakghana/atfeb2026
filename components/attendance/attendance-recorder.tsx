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
  type LocationData,
  type ProximitySettings,
} from "@/lib/geolocation"
import { getDeviceInfo } from "@/lib/device-info"
import { validateQRCode, type QRCodeData } from "@/lib/qr-code"
import { MapPin, Clock, Loader2, AlertTriangle, Navigation, QrCode, CheckCircle2 } from "lucide-react"
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
  name: string // Added for convenience
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

// Placeholder for WindowsCapabilities, assuming it's defined elsewhere or inferred
type WindowsCapabilities = ReturnType<typeof detectWindowsLocationCapabilities>

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
  // const [locationWatchId, setLocationWatchId] = useState<number | null>(null) // Kept from existing code, though updates suggest removing it. Will be removed if not needed by the new logic.
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

  // Redundant state, managed by `todayAttendance` prop.
  // const [canCheckIn, setCanCheckIn] = useState(false)
  // const [canCheckOut, setCanCheckOut] = useState(false)
  // const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)

  // Renamed for clarity and to avoid conflict with dialog state.
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Removed `locationWatchId` from useState as per update, will manage it locally if needed.
  // const [locationWatchId, setLocationWatchId] = useState<number | null>(null) // Removed

  // Simplified locationPermissionStatus state
  const [locationPermissionStatusSimplified, setLocationPermissionStatusSimplified] = useState<{
    granted: boolean
    message: string
  }>({
    granted: false,
    message: "Click 'Get Current Location' to enable GPS-based attendance",
  })

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

    // Automatically get location when page loads
    const autoLoadLocation = async () => {
      try {
        console.log("[v0] Auto-loading location on page load...")
        const location = await getCurrentLocation()
        setUserLocation(location)
        setLocationPermissionStatus({ granted: true, message: "Location access granted" })
        console.log("[v0] Location auto-loaded successfully:", location)
      } catch (error) {
        console.log("[v0] Auto-load location failed, user can try manual check-in or QR code:", error)
        // Don't show error - user can still use check-in button or QR code
      }
    }

    autoLoadLocation()
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
          name: assignedLocation.name, // Assign name here
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

  // Simplified location validation logic as per new update.
  // This effect is now primarily for logging and potentially updating `locationValidation` based on fetched `userLocation`.
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

  // Simplified getCurrentLocationData without continuous watch and with updated error handling.
  const getCurrentLocationData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      console.log("[v0] Requesting location with optimized timeout...")
      const location = await getCurrentLocation()
      setUserLocation(location)
      setLocationPermissionStatus({ granted: true, message: "Location access granted" }) // Using the original permission status state here.
      return location
    } catch (error) {
      console.error("[v0] Failed to get location:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Unable to access location. Please enable GPS or use QR code option."
      setError(errorMessage)
      setLocationPermissionStatus({
        // Using the original permission status state here.
        granted: false,
        message: errorMessage,
      })
      setShowLocationHelp(true)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  // Cleaned up unused useEffect for location watch.
  // useEffect(() => {
  //   return () => {
  //     if (locationWatchId && navigator.geolocation) {
  //       navigator.geolocation.clearWatch(locationWatchId)
  //     }
  //   }
  // }, [locationWatchId])

  const handleCheckIn = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("[v0] Getting location for check-in...")
      const location = await getCurrentLocation()
      setUserLocation(location)

      // Assuming validateCheckinLocation is a new function or an adaptation of validateAttendanceLocation
      // For now, using validateAttendanceLocation and adapting its output.
      const validation = validateAttendanceLocation(location, locations, proximitySettings)

      if (!validation.canCheckIn) {
        setError(validation.message)
        // setShowLocationHelp(true) // Removed as it might not be necessary if message is clear.
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
      else if (validation.availableLocations && validation.availableLocations.length > 0) {
        targetLocationId = validation.availableLocations[0].location.id
        console.log(
          "[v0] Automatically using nearest available location for check-in:",
          validation.availableLocations[0].location.name,
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

        // These states were removed in the updates, so commenting out for now.
        // setCanCheckIn(false)
        // setCanCheckOut(true)
        // setTodayAttendance(result.data.attendance)

        if (result.data.missed_checkout_handled) {
          message += "\n\n⚠️ Previous day's checkout was automatically recorded."
        }

        setSuccessMessage(`✓ ${message}`)
        setShowSuccessPopup(true)

        // Auto-hide success popup after 3 seconds
        setTimeout(() => {
          setShowSuccessPopup(false)
        }, 3000)

        setTimeout(() => {
          // Assuming loadTodayAttendance and loadRecentAttendance are defined elsewhere or should be added.
          // For now, replacing with a reload as in the original code.
          window.location.reload()
        }, 500)
      } else {
        setError(result.message || "Failed to check in")
      }
    } catch (error) {
      console.error("[v0] Check-in error:", error)

      if (error instanceof Error && error.message.includes("timeout")) {
        setError(
          "Location request timed out. For instant check-in, use the QR code option below or ensure your device location services are enabled.",
        )
        setShowLocationHelp(true)
      } else {
        setError(error instanceof Error ? error.message : "An error occurred during check-in")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckOut = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("[v0] Getting location for check-out...")
      const location = await getCurrentLocation()
      setUserLocation(location)

      const checkoutValidation = validateCheckoutLocation(location, locations, proximitySettings)

      if (!checkoutValidation.canCheckOut) {
        setError(checkoutValidation.message)
        // setShowLocationHelp(true) // Removed as it might not be necessary if message is clear.
        setIsLoading(false)
        return
      }

      let nearestLocation = null

      if (locations.length > 1) {
        const locationDistances = locations
          .map((loc) => {
            const distance = calculateDistance(location.latitude, location.longitude, loc.latitude, loc.longitude)
            return { location: loc, distance: Math.round(distance) }
          })
          .sort((a, b) => a.distance - b.distance)
          .filter(({ distance }) => distance <= proximitySettings.checkInProximityRange)

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

      const deviceInfo = getDeviceInfo()
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()

      // Check for early checkout only if it's before 5 PM and not already past 5 PM
      if (currentHour < 17 || (currentHour === 17 && currentMinute < 0)) {
        setPendingCheckoutData({ location, nearestLocation })
        setShowEarlyCheckoutDialog(true)
        setIsLoading(false)
        return
      }

      console.log("[v0] Performing checkout at:", nearestLocation?.name)

      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          location_id: nearestLocation?.id,
          device_info: deviceInfo,
          early_checkout_reason: earlyCheckoutReason || undefined, // Use the state for reason
        }),
      })

      const result = await response.json()

      if (result.success) {
        // These states were removed in the updates, so commenting out for now.
        // setCanCheckOut(false)
        // setCanCheckIn(true)
        // setTodayAttendance(result.data.attendance)
        setEarlyCheckoutReason("") // Clear the reason after successful checkout

        setSuccessMessage(`✓ ${result.message}`)
        setShowSuccessPopup(true)

        // Auto-hide success popup after 3 seconds
        setTimeout(() => {
          setShowSuccessPopup(false)
        }, 3000)

        setTimeout(() => {
          // Assuming loadTodayAttendance and loadRecentAttendance are defined elsewhere or should be added.
          // For now, replacing with a reload as in the original code.
          window.location.reload()
        }, 500)
      } else {
        setError(result.message || "Failed to check out")
      }
    } catch (error) {
      console.error("[v0] Check-out error:", error)

      if (error instanceof Error && error.message.includes("timeout")) {
        setError(
          "Location request timed out. For instant check-out, use the QR code option below or ensure your device location services are enabled.",
        )
        setShowLocationHelp(true)
      } else {
        setError(error instanceof Error ? error.message : "An error occurred during check-out")
      }
    } finally {
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
    setLocationPermissionStatus(result) // Using the original permission status state here.

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
    // This function seems to be a placeholder and might need more robust implementation
    // based on actual requirements, but for now, it returns the first location.
    if (!locations || locations.length === 0) return undefined
    return { location: locations[0] }
  }

  // Calculate distance to assigned location for display
  const assignedLocationDistance =
    userLocation && userProfile?.assigned_location_id && locations.length > 0
      ? (() => {
          const assignedLoc = locations.find((loc) => loc.id === userProfile.assigned_location_id)
          if (assignedLoc) {
            return calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              assignedLoc.latitude,
              assignedLoc.longitude,
            )
          }
          return null
        })()
      : null

  return (
    <div className="space-y-6">
      {showSuccessPopup && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200 whitespace-pre-line">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

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
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Information
          </CardTitle>
          <CardDescription>Your current location and proximity to QCC locations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userLocation ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 mt-0.5 text-green-600" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">Location Detected</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Accuracy: {userLocation.accuracy.toFixed(0)}m • Source: {userLocation.source || "GPS"}
                  </div>
                </div>
                <Button
                  onClick={handleRefreshLocations}
                  disabled={isLoading}
                  variant="ghost"
                  size="sm"
                  title="Refresh location"
                >
                  <Navigation className="h-4 w-4" />
                </Button>
              </div>

              {userProfile?.assigned_location_id && locations.length > 0 && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-sm font-medium text-primary mb-1">Your Assigned Location</div>
                  <div className="text-sm">
                    {locations.find((loc) => loc.id === userProfile.assigned_location_id)?.name || "Unknown"}
                  </div>
                  {assignedLocationDistance !== null && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {assignedLocationDistance < 1000
                        ? `${assignedLocationDistance.toFixed(0)}m away`
                        : `${(assignedLocationDistance / 1000).toFixed(1)}km away`}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  {isLoading
                    ? "Getting your location..."
                    : "Location will be detected when you check in, or you can use the QR code option below."}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {locations.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">All QCC Locations</div>
              <div className="space-y-1.5">
                {locations.map((location) => {
                  const distance = userLocation
                    ? calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        location.latitude,
                        location.longitude,
                      )
                    : null
                  return (
                    <div
                      key={location.id}
                      className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm"
                    >
                      <span className="truncate flex-1">{location.name}</span>
                      {distance !== null && (
                        <Badge variant="outline" className="ml-2 shrink-0">
                          {distance < 1000 ? `${distance.toFixed(0)}m` : `${(distance / 1000).toFixed(1)}km`}
                        </Badge>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Actions
          </CardTitle>
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

          <div className="space-y-2">
            {canCheckIn && (
              <Button onClick={handleCheckIn} disabled={isLoading} className="flex-1 w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Location & Checking In...
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Check In Now
                  </>
                )}
              </Button>
            )}

            {canCheckOut && (
              <Button
                onClick={handleCheckOut}
                disabled={isLoading}
                variant="outline"
                className="flex-1 w-full bg-transparent"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Location & Checking Out...
                  </>
                ) : (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Check Out Now
                  </>
                )}
              </Button>
            )}

            {(error || showLocationHelp) && (
              <div className="pt-3 border-t">
                <Button
                  onClick={() => {
                    setShowQRScanner(true)
                    setQrScanMode(canCheckIn ? "checkin" : "checkout")
                  }}
                  variant="outline"
                  className="w-full bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Use QR Code Instead (Instant)
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">QR codes work instantly without GPS</p>
              </div>
            )}
          </div>

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

      {/* NEW CODE START */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Location Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {userProfile && userProfile.assigned_location_id && (
            <>
              {assignedLocationInfo ? (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Your Assigned Location</span>
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
                  <div className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                    {assignedLocationInfo.name}
                  </div>
                  {assignedLocationInfo.distance !== undefined && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Distance: {Math.round(assignedLocationInfo.distance)}m
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-green-700 dark:text-green-300">Assigned Location:</span>
                  <span className="font-medium text-green-900 dark:text-green-100">Loading...</span>
                </div>
              )}
            </>
          )}
          {!userProfile?.assigned_location_id && userProfile && (
            <div className="flex justify-between">
              <span className="text-gray-700 dark:text-gray-300">Assigned Location:</span>
              <span className="text-gray-500 dark:text-gray-400 italic">None assigned</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleRefreshLocations}
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="bg-transparent ml-auto"
              title="Refresh location data"
            >
              <Navigation className="mr-2 h-4 w-4" />
              Refresh Locations
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
        </CardContent>
      </Card>

      {locationValidation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">QCC Locations & Distances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {locationValidation.nearestLocation && locationValidation.distance !== undefined && (
              <div
                className={`p-3 rounded-lg border ${
                  locationValidation.canCheckIn
                    ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50"
                    : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50"
                }`}
              >
                <div
                  className={`font-medium mb-1 ${
                    locationValidation.canCheckIn
                      ? "text-green-900 dark:text-green-100"
                      : "text-orange-900 dark:text-orange-100"
                  }`}
                >
                  Nearest Location: {locationValidation.nearestLocation.name}
                </div>
                <div
                  className={`text-sm ${
                    locationValidation.canCheckIn
                      ? "text-green-700 dark:text-green-300"
                      : "text-orange-700 dark:text-orange-300"
                  }`}
                >
                  Distance: {Math.round(locationValidation.distance)}m
                  {locationValidation.canCheckIn ? " (Within range)" : " (Out of range)"}
                </div>
              </div>
            )}

            {locationValidation.allLocations && locationValidation.allLocations.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">All Locations</div>
                <div className="space-y-1 text-sm">
                  {locationValidation.allLocations.map(({ location, distance }) => (
                    <div
                      key={location.id}
                      className="flex justify-between p-2 rounded border border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-950/30"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate mr-2">{location.name}</span>
                      <span
                        className={`font-medium ${
                          distance <= proximitySettings.checkInProximityRange
                            ? "text-green-600 dark:text-green-400"
                            : "text-gray-600 dark:text-gray-400"
                        }`}
                      >
                        {Math.round(distance)}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* NEW CODE END */}
    </div>
  )
}
