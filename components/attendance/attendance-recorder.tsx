"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
  getAveragedLocation,
  validateLocationWithIP,
  validateAttendanceLocation,
  validateCheckoutLocation,
  calculateDistance,
  detectWindowsLocationCapabilities,
  isWithinBrowserProximity, // Added
  detectBrowser, // Added
  type LocationData,
  type ProximitySettings,
  type GeoSettings, // Added
} from "@/lib/geolocation"
import { getDeviceInfo } from "@/lib/device-info"
import type { QRCodeData } from "@/lib/qr-code"
import { MapPin, Clock, Loader2, AlertTriangle, Navigation, CheckCircle2 } from "lucide-react"
import { useRealTimeLocations } from "@/hooks/use-real-time-locations"
import { createClient } from "@/lib/supabase/client"
import { QRScanner } from "@/components/qr/qr-scanner"
import { toast } from "@/components/ui/use-toast" // Imported toast

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
  geoSettings?: GeoSettings
  locations: GeofenceLocation[]
  canCheckIn?: boolean
  canCheckOut?: boolean
}

// Placeholder for WindowsCapabilities, assuming it's defined elsewhere or inferred
type WindowsCapabilities = ReturnType<typeof detectWindowsLocationCapabilities>

export function AttendanceRecorder({
  todayAttendance: initialTodayAttendance,
  geoSettings,
  locations,
  canCheckIn: initialCanCheckIn,
  canCheckOut: initialCanCheckOut,
}: AttendanceRecorderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [assignedLocationInfo, setAssignedLocationInfo] = useState<AssignedLocationInfo | null>(null)
  const {
    locations: realTimeLocations,
    loading: locationsLoading,
    error: locationsError,
    isConnected,
  } = useRealTimeLocations() // Renamed locations to avoid conflict
  const [proximitySettings, setProximitySettings] = useState<ProximitySettings>({
    checkInProximityRange: 50,
    defaultRadius: 20,
    requireHighAccuracy: true,
    allowManualOverride: false,
  })
  // const [geoSettings, setGeoSettings] = useState<GeoSettings | null>(null) // This is now a prop
  const [locationValidation, setLocationValidation] = useState<{
    canCheckIn: boolean
    canCheckOut?: boolean
    nearestLocation?: GeofenceLocation
    distance?: number
    message: string
    accuracyWarning?: string
    criticalAccuracyIssue?: boolean
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
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split("T")[0])
  const [showEarlyCheckoutDialog, setShowEarlyCheckoutDialog] = useState(false)
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState("")
  const [pendingCheckoutData, setPendingCheckoutData] = useState<{
    location: LocationData | null
    nearestLocation: any
  } | null>(null)

  // Redundant state, managed by `todayAttendance` prop.
  // const [canCheckIn, setCanCheckIn] = useState(false)
  // const [canCheckOut, setCanCheckOut] = useState(false)
  // const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)

  // Renamed for clarity and to avoid conflict with dialog state.
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  // Simplified locationPermissionStatus state
  const [locationPermissionStatusSimplified, setLocationPermissionStatusSimplified] = useState<{
    granted: boolean
    message: string
  }>({
    granted: false,
    message: "Click 'Get Current Location' to enable GPS-based attendance",
  })

  const [recentCheckIn, setRecentCheckIn] = useState(false)
  const [recentCheckOut, setRecentCheckOut] = useState(false)
  const [localTodayAttendance, setLocalTodayAttendance] = useState(initialTodayAttendance)

  const canCheckIn = initialCanCheckIn && !recentCheckIn && !localTodayAttendance?.check_in_time
  const canCheckOut =
    initialCanCheckOut &&
    !recentCheckOut &&
    localTodayAttendance?.check_in_time &&
    !localTodayAttendance?.check_out_time

  const handleQRScanSuccess = async (qrData: QRCodeData) => {
    console.log("[v0] QR scan successful, mode:", qrScanMode)
    setShowQRScanner(false)

    if (qrScanMode === "checkin") {
      await handleQRCheckIn(qrData)
    } else {
      await handleQRCheckOut(qrData)
    }
  }

  const handleQRCheckIn = async (qrData: QRCodeData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("[v0] Processing QR check-in with data:", qrData)

      const response = await fetch("/api/attendance/qr-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: qrData.locationId,
          qr_timestamp: qrData.timestamp,
          userLatitude: qrData.userLatitude,
          userLongitude: qrData.userLongitude,
          device_info: getDeviceInfo(),
        }),
      })

      const result = await response.json()
      console.log("[v0] QR check-in API response:", result)

      if (!response.ok) {
        const errorMsg = result.message || result.error || "Failed to check in with QR code"
        throw new Error(errorMsg)
      }

      setSuccess("✓ Checked in successfully with QR code!")
      console.log("[v0] QR check-in successful")

      // mutate() // Assuming mutate is a function from SWR or similar, not defined here, so commented out.

      // Show success popup
      setTimeout(() => {
        setSuccess(null)
      }, 5000)
    } catch (error: any) {
      console.error("[v0] QR check-in error:", error)
      setError(error.message || "Failed to check in with QR code")

      toast({
        title: "Check-in Failed",
        description: error.message || "Failed to check in with QR code",
        variant: "destructive",
        duration: 8000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleQRCheckOut = async (qrData: QRCodeData) => {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log("[v0] Processing QR check-out with data:", qrData)

      const response = await fetch("/api/attendance/qr-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: qrData.locationId,
          qr_timestamp: qrData.timestamp,
          userLatitude: qrData.userLatitude,
          userLongitude: qrData.userLongitude,
          device_info: getDeviceInfo(),
        }),
      })

      const result = await response.json()
      console.log("[v0] QR check-out API response:", result)

      if (!response.ok) {
        const errorMsg = result.message || result.error || "Failed to check out with QR code"
        throw new Error(errorMsg)
      }

      setSuccess("✓ Checked out successfully with QR code!")
      console.log("[v0] QR check-out successful")

      // mutate() // Assuming mutate is a function from SWR or similar, not defined here, so commented out.

      // Show success popup
      setTimeout(() => {
        setSuccess(null)
      }, 5000)
    } catch (error: any) {
      console.error("[v0] QR check-out error:", error)
      setError(error.message || "Failed to check out with QR code")

      toast({
        title: "Check-out Failed",
        description: error.message || "Failed to check out with QR code",
        variant: "destructive",
        duration: 8000,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseQRCode = (mode: "checkin" | "checkout") => {
    // Redirect to QR Events page with mode parameter
    window.location.href = `/dashboard/qr-events?mode=${mode}`
  }

  useEffect(() => {
    fetchUserProfile()
    loadProximitySettings()
    // loadGeoSettings() // This is now a prop, no need to load it
    const capabilities = detectWindowsLocationCapabilities()
    setWindowsCapabilities(capabilities)
    console.log("[v0] Windows location capabilities detected:", capabilities)

    const autoLoadLocation = async () => {
      try {
        console.log("[v0] Auto-loading location on page load...")
        const location = await getCurrentLocation()
        setUserLocation(location)
        setLocationPermissionStatus({ granted: true, message: "Location access granted" })
        console.log("[v0] Location auto-loaded successfully:", location)

        const capabilities = detectWindowsLocationCapabilities()
        if (capabilities.isWindows && location.accuracy > 200) {
          setError(
            `GPS accuracy is ${Math.round(location.accuracy)}m. Click the refresh button to update your location for better accuracy.`,
          )
        }
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

  // const loadGeoSettings = async () => { // This is now a prop
  //   try {
  //     const response = await fetch("/api/settings")
  //     if (response.ok) {
  //       const data = await response.json()
  //       if (data.systemSettings?.geo_settings) {
  //         setGeoSettings(data.systemSettings.geo_settings)
  //         console.log("[v0] Loaded geo settings with browser tolerances:", data.systemSettings.geo_settings)
  //       }
  //     }
  //   } catch (error) {
  //     console.error("[v0] Failed to load geo settings:", error)
  //   }
  // }

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
    if (userLocation && realTimeLocations.length > 0 && userProfile?.assigned_location_id) {
      // Use realTimeLocations here
      const assignedLocation = realTimeLocations.find((loc) => loc.id === userProfile.assigned_location_id) // Use realTimeLocations here
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
  }, [userLocation, realTimeLocations, userProfile]) // Use realTimeLocations here

  // Simplified location validation logic as per new update.
  // This effect is now primarily for logging and potentially updating `locationValidation` based on fetched `userLocation`.
  useEffect(() => {
    if (userLocation && realTimeLocations.length > 0) {
      // Use realTimeLocations here
      console.log(
        "[v0] All available locations:",
        realTimeLocations.map((l) => ({
          // Use realTimeLocations here
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

      const locationDistances = realTimeLocations // Use realTimeLocations here
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

      const validation = validateAttendanceLocation(userLocation, realTimeLocations, proximitySettings) // Use realTimeLocations here
      const checkoutValidation = validateCheckoutLocation(userLocation, realTimeLocations, proximitySettings) // Use realTimeLocations here

      console.log("[v0] Location validation result:", validation)
      console.log("[v0] Check-out validation result:", checkoutValidation)
      console.log(
        "[v0] Locations data:",
        realTimeLocations.map((l) => ({ name: l.name, radius: l.radius_meters })), // Use realTimeLocations here
      )
      console.log("[v0] Validation message:", validation.message)
      console.log("[v0] Can check in:", validation.canCheckIn)
      console.log("[v0] Can check out:", checkoutValidation.canCheckOut)
      console.log("[v0] Distance:", validation.distance)
      console.log("[v0] Nearest location being checked:", validation.nearestLocation?.name)
      console.log("[v0] Using proximity range:", proximitySettings.checkInProximityRange)

      // Check for critical accuracy issues
      const criticalAccuracyIssue =
        userLocation.accuracy > 1000 || (windowsCapabilities?.isWindows && userLocation.accuracy > 100)
      let accuracyWarning = ""
      if (criticalAccuracyIssue) {
        accuracyWarning = `Your current GPS accuracy (${userLocation.accuracy.toFixed(0)}m) is critically low. For accurate attendance, please use the QR code option or ensure you are in an open area with clear sky view.`
      } else if (userLocation.accuracy > 100) {
        accuracyWarning = `Your current GPS accuracy (${userLocation.accuracy.toFixed(0)}m) is moderate. For best results, ensure you have a clear view of the sky or move closer to your assigned location.`
      }

      setLocationValidation({
        ...validation,
        canCheckOut: checkoutValidation.canCheckOut,
        allLocations: locationDistances,
        criticalAccuracyIssue,
        accuracyWarning,
      })
    }
  }, [userLocation, realTimeLocations, proximitySettings, windowsCapabilities]) // Use realTimeLocations here

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
      const capabilities = detectWindowsLocationCapabilities()
      console.log("[v0] Browser:", capabilities.browserName)

      // For Opera and poor GPS browsers, use averaged readings
      const useSampling = capabilities.browserName === "Opera" || capabilities.hasKnownIssues

      console.log(`[v0] Using ${useSampling ? "multi-sample" : "single"} GPS reading...`)
      const location = useSampling ? await getAveragedLocation(3) : await getCurrentLocation()

      setUserLocation(location)

      // Validate with IP geolocation for extra confidence
      const validation = await validateLocationWithIP(location)

      if (!validation.isValid) {
        setError(validation.message)
        setShowLocationHelp(true)
      } else if (validation.message) {
        console.log("[v0]", validation.message)
      }

      setLocationPermissionStatus({ granted: true, message: "Location access granted" })
      return location
    } catch (error) {
      console.error("[v0] Failed to get location:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Unable to access location. Please enable GPS or use QR code option."
      setError(errorMessage)
      setLocationPermissionStatus({
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
      console.log("[v0] Getting optimized location for check-in...")

      // Use browser-optimized location fetching
      const location = await getCurrentLocationData()
      if (!location) {
        setIsLoading(false)
        return
      }

      const browserInfo = detectBrowser()
      console.log("[v0] Browser detected:", browserInfo.name)

      if (!locations || locations.length === 0) {
        setError("No QCC locations found")
        setIsLoading(false)
        return
      }

      // Find nearest location
      const nearest = locations.reduce(
        (closest, loc) => {
          const dist = calculateDistance(location.latitude, location.longitude, loc.latitude, loc.longitude)
          if (!closest || dist < closest.distance) {
            return { location: loc, distance: dist }
          }
          return closest
        },
        null as { location: GeofenceLocation; distance: number } | null,
      )

      if (!nearest) {
        setError("No QCC locations found")
        setIsLoading(false)
        return
      }

      const proximityCheck = await isWithinBrowserProximity(
        location,
        nearest.location.latitude,
        nearest.location.longitude,
        geoSettings || undefined,
      )

      console.log("[v0] Proximity check:", {
        distance: proximityCheck.distance,
        isWithin: proximityCheck.isWithin,
      })

      if (!proximityCheck.isWithin) {
        setError(
          `You must be within 100 meters of your assigned location to check in. You are currently ${Math.round(proximityCheck.distance)}m away. Please use manual location code entry or move closer.`,
        )
        setIsLoading(false)
        return
      }

      const deviceInfo = getDeviceInfo()

      console.log("[v0] Performing automatic check-in at:", nearest.location.name)

      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          location_id: nearest.location.id,
          location_name: nearest.location.name,
          device_info: navigator.userAgent,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to check in")
      }

      const result = await response.json()

      setLocalTodayAttendance({
        ...result.attendance,
        check_in_time: new Date().toISOString(),
        check_in_location_name: nearest.location.name,
      })
      setRecentCheckIn(true)

      const message = nearest.location.name
        ? `Checked in successfully at ${nearest.location.name}!`
        : "Checked in successfully!"
      setSuccessDialogMessage(message)
      setShowSuccessDialog(true)

      toast({
        title: "Check-in successful!",
        description: message,
      })

      setTimeout(() => {
        setRecentCheckIn(false)
      }, 120000)

      setTimeout(() => {
        window.location.reload()
      }, 3000)

      setIsLoading(false)
    } catch (error) {
      console.error("[v0] Check-in error:", error)

      if (error instanceof Error && error.message.includes("timeout")) {
        setError(
          "Location request timed out. For instant check-in, use the manual location code entry option or ensure your device location services are enabled.",
        )
        setShowLocationHelp(true)
      } else {
        setError(error instanceof Error ? error.message : "An error occurred during check-in")
      }

      toast({
        title: "Check-in Failed",
        description: error instanceof Error ? error.message : "An error occurred during check-in",
        variant: "destructive",
        duration: 8000,
      })
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

      if (!locations || locations.length === 0) {
        setError("No QCC locations found")
        setIsLoading(false)
        return
      }

      const checkoutValidation = validateCheckoutLocation(location, locations, proximitySettings)

      if (!checkoutValidation.canCheckOut) {
        setError(checkoutValidation.message)
        setIsLoading(false)

        toast({
          title: "Check-out Failed",
          description: checkoutValidation.message,
          variant: "destructive",
          duration: 8000,
        })
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
          setError(`You must be within 100 meters of a QCC location to check out`)
          setIsLoading(false)

          toast({
            title: "Check-out Failed",
            description: `You must be within 100 meters of a QCC location to check out`,
            variant: "destructive",
            duration: 8000,
          })
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

      // Check for early checkout only if it's before 5 PM
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
          early_checkout_reason: earlyCheckoutReason || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to check out")
      }

      const result = await response.json()

      setLocalTodayAttendance({
        ...localTodayAttendance!,
        check_out_time: new Date().toISOString(),
        check_out_location_name: nearestLocation?.name,
      })
      setRecentCheckOut(true)

      const message = `Checked out successfully${nearestLocation?.name ? ` at ${nearestLocation.name}` : ""}!`
      setSuccessDialogMessage(message)
      setShowSuccessDialog(true)

      toast({
        title: "Check-out successful!",
        description: message,
      })

      setTimeout(() => {
        setRecentCheckOut(false)
      }, 120000) // 2 minutes

      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error) {
      console.error("[v0] Check-out error:", error)
      setError(error instanceof Error ? error.message : "An error occurred during check-out")

      toast({
        title: "Check-out Failed",
        description: error instanceof Error ? error.message : "An error occurred during check-out",
        variant: "destructive",
        duration: 8000,
      })
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

  const handleRefreshLocations = async () => {
    setIsLoading(true)
    setError(null)
    try {
      console.log("[v0] Manually refreshing location...")
      const location = await getCurrentLocation()
      setUserLocation(location)

      if (location.accuracy > 1000) {
        setError(
          `GPS accuracy is critically poor (${(location.accuracy / 1000).toFixed(1)}km) - Use QR code for reliable attendance.`,
        )
      } else if (location.accuracy > 500) {
        setError(`GPS accuracy is poor (${Math.round(location.accuracy)}m). Consider using QR code for best results.`)
      } else {
        setSuccess(`Location refreshed successfully. Accuracy: ${Math.round(location.accuracy)}m`)
        setTimeout(() => setSuccess(null), 3000)
      }

      setLocationPermissionStatus({ granted: true, message: "Location access granted" })
      console.log("[v0] Location refreshed successfully")
    } catch (error) {
      console.error("[v0] Failed to refresh location:", error)
      const errorMessage =
        error instanceof Error ? error.message : "Unable to access location. Please enable GPS or use QR code option."
      setError(errorMessage)
      setLocationPermissionStatus({ granted: false, message: errorMessage })
      setShowLocationHelp(true)
    } finally {
      setIsLoading(false)
    }
  }

  const checkInDate = localTodayAttendance?.check_in_time // Use localTodayAttendance
    ? new Date(localTodayAttendance.check_in_time).toISOString().split("T")[0]
    : null

  // If check-in was from a previous day, treat as if no check-in exists (allow new check-in)
  const isFromPreviousDay = checkInDate && checkInDate !== currentDate

  const isCheckedIn = localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time && !isFromPreviousDay
  const isCheckedOut = localTodayAttendance?.check_out_time
  // const canCheckIn = !localTodayAttendance?.check_in_time || isFromPreviousDay // Now comes from props and state
  // const canCheckOut = isCheckedIn && !isFromPreviousDay // Now comes from props and state

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

  useEffect(() => {
    if (showQRScanner) {
      console.log("[v0] QR scanner dialog opened")
    }
  }, [showQRScanner])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-1">Location Requirement</h3>
            <p className="text-sm text-blue-800">
              You must be within <strong>100 meters</strong> of your assigned location to check in or out. If GPS is not
              accurate, you can use the QR code scanner option for instant check-in.
            </p>
          </div>
        </div>
      </div>

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

          {localTodayAttendance?.check_in_time && ( // Use localTodayAttendance
            <div className="flex items-center justify-between">
              <span>Check-in Time:</span>
              <span className="font-medium">{new Date(localTodayAttendance.check_in_time).toLocaleTimeString()}</span>
            </div>
          )}

          {localTodayAttendance?.check_in_location_name && ( // Use localTodayAttendance
            <div className="flex items-center justify-between">
              <span>Check-in Location:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{localTodayAttendance.check_in_location_name}</span>
                {localTodayAttendance.is_remote_location && (
                  <Badge variant="outline" className="text-xs">
                    <Navigation className="h-3 w-3 mr-1" />
                    Remote
                  </Badge>
                )}
              </div>
            </div>
          )}

          {localTodayAttendance?.check_out_time && ( // Use localTodayAttendance
            <div className="flex items-center justify-between">
              <span>Check-out Time:</span>
              <span className="font-medium">{new Date(localTodayAttendance.check_out_time).toLocaleTimeString()}</span>
            </div>
          )}

          {localTodayAttendance?.check_out_location_name && ( // Use localTodayAttendance
            <div className="flex items-center justify-between">
              <span>Check-out Location:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{localTodayAttendance.check_out_location_name}</span>
                {localTodayAttendance.different_checkout_location && (
                  <Badge variant="outline" className="text-xs">
                    <MapPin className="h-3 w-3 mr-1" />
                    Different
                  </Badge>
                )}
              </div>
            </div>
          )}

          {localTodayAttendance?.work_hours && ( // Use localTodayAttendance
            <div className="flex items-center justify-between">
              <span>Work Hours:</span>
              <span className="font-medium">{localTodayAttendance.work_hours.toFixed(2)} hours</span>
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
                    {windowsCapabilities?.browserName && ` • Browser: ${windowsCapabilities.browserName}`}
                  </div>
                  {userLocation.accuracy > 1000 && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      ⚠️ Critical: {(userLocation.accuracy / 1000).toFixed(1)}km accuracy - Use QR Code Instead
                    </Badge>
                  )}
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

              {windowsCapabilities?.hasKnownIssues && (
                <Alert variant="destructive" className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Browser Compatibility Issue</AlertTitle>
                  <AlertDescription className="text-xs space-y-2">
                    <p>{windowsCapabilities.issueDescription}</p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={() => {
                          const mode = isCheckedIn && !isCheckedOut ? "checkout" : "checkin"
                          setQrScanMode(mode)
                          setShowQRScanner(true)
                        }}
                        size="sm"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        Enter Location Code Manually
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {locationValidation?.criticalAccuracyIssue && locationValidation?.accuracyWarning && (
                <Alert variant="destructive" className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm font-semibold">Critical GPS Accuracy Issue</AlertTitle>
                  <AlertDescription className="text-xs whitespace-pre-line">
                    {locationValidation.accuracyWarning}
                  </AlertDescription>
                </Alert>
              )}

              {locationValidation?.accuracyWarning &&
                !locationValidation?.criticalAccuracyIssue &&
                userLocation.accuracy > 100 && (
                  <Alert variant="default" className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertTitle className="text-sm text-yellow-900 dark:text-yellow-100">
                      GPS Accuracy Warning
                    </AlertTitle>
                    <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200 whitespace-pre-line">
                      {locationValidation.accuracyWarning}
                    </AlertDescription>
                  </Alert>
                )}

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
              <Button onClick={handleCheckIn} disabled={isLoading || recentCheckIn} className="flex-1 w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Location & Checking In...
                  </>
                ) : recentCheckIn ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Check-in Recorded - Updating...
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
                disabled={isLoading || recentCheckOut}
                variant="outline"
                className="flex-1 w-full bg-transparent"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Location & Checking Out...
                  </>
                ) : recentCheckOut ? (
                  <>
                    <Clock className="mr-2 h-4 w-4" />
                    Check-out Recorded - Updating...
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
                  <MapPin className="mr-2 h-4 w-4" />
                  Enter Location Code Manually (Recommended)
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Tap your location below for instant check-in - no camera needed!
                </p>
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
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowLocationHelp(false)
                      setShowQRScanner(true)
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Enter Location Code Manually
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
            {/* Hide distance information from status display for PC users */}
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
                  {locationValidation.canCheckIn ? "Within range" : "Please use manual location code entry"}
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

      {geoSettings?.enableBrowserSpecificTolerance && userLocation && (
        <Alert>
          <AlertDescription>
            Browser: {detectBrowser().name} - Using{" "}
            {geoSettings.browserTolerances?.[
              detectBrowser().name.toLowerCase() as keyof typeof geoSettings.browserTolerances
            ] ||
              geoSettings.browserTolerances?.default ||
              1500}
            m tolerance for GPS accuracy
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={showQRScanner} onOpenChange={setShowQRScanner}>
        <DialogContent className="max-w-[95vw] sm:max-w-md p-0 max-h-[95vh] overflow-y-auto">
          <QRScanner onScanSuccess={handleQRScanSuccess} onClose={() => setShowQRScanner(false)} autoStart={true} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
