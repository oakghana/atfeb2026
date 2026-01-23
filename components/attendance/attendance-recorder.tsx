"use client"

import { useState, useEffect } from "react"
import {
  getCurrentLocation,
  getAveragedLocation,
  validateAttendanceLocation,
  validateCheckoutLocation,
  calculateDistance,
  detectWindowsLocationCapabilities,
  type LocationData,
  type ProximitySettings,
  type GeoSettings,
  reverseGeocode, // Import reverseGeocode
} from "@/lib/geolocation"
import { getDeviceInfo } from "@/lib/device-info"
import type { QRCodeData } from "@/lib/qr-code"
import { useRealTimeLocations } from "@/hooks/use-real-time-locations"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/hooks/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  LogIn,
  LogOut,
  QrCode,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { LocationCodeDialog } from "@/components/dialogs/location-code-dialog"
import { QRScannerDialog } from "@/components/dialogs/qr-scanner-dialog"
import { FlashMessage } from "@/components/notifications/flash-message"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { clearAttendanceCache, shouldClearCache, setCachedDate } from "@/lib/utils/attendance-cache"
import { cn } from "@/lib/utils" // Import cn

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
  className?: string // Added className prop
}

// Placeholder for WindowsCapabilities, assuming it's defined elsewhere or inferred
type WindowsCapabilities = ReturnType<typeof detectWindowsLocationCapabilities>

const REFRESH_PAUSE_DURATION = 50000 // 50 seconds instead of 120000 (2 minutes)

export function AttendanceRecorder({
  todayAttendance: initialTodayAttendance,
  geoSettings,
  locations: propLocations, // Renamed to avoid conflict with realTimeLocations
  canCheckIn: initialCanCheckIn,
  canCheckOut: initialCanCheckOut,
  className, // Added className prop
}: AttendanceRecorderProps) {
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [checkingMessage, setCheckingMessage] = useState("")

  const [isLoading, setIsLoading] = useState(false)
  const [userLocation, setUserLocation] = useState<LocationData | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [assignedLocationInfo, setAssignedLocationInfo] = useState<AssignedLocationInfo | null>(null)
  const {
    locations: realTimeLocations, // Renamed from `locations` to avoid conflict with propLocations
    loading: locationsLoading,
    error: locationsError,
    isConnected,
  } = useRealTimeLocations()
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
  const [showCodeEntry, setShowCodeEntry] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showLocationCodeDialog, setShowLocationCodeDialog] = useState(false) // Added

  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")

  const [detectedLocationName, setDetectedLocationName] = useState<string | null>(null)

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

  const [checkoutTimeReached, setCheckoutTimeReached] = useState(false)

  const [isCheckInProcessing, setIsCheckInProcessing] = useState(false)
  const [lastCheckInAttempt, setLastCheckInAttempt] = useState<number>(0)

  // Check if cache should be cleared (new day)
  useEffect(() => {
    if (shouldClearCache()) {
      console.log("[v0] New day detected - clearing attendance cache")
      clearAttendanceCache()

      // Reset local state
      setLocalTodayAttendance(null)
      setRecentCheckIn(false)
      setRecentCheckOut(false)

      // Fetch fresh data
      fetchTodayAttendance()
      // fetchLeaveStatus() // Fetch leave status again on new day

      // Update cached date
      const today = new Date().toISOString().split("T")[0]
      setCachedDate(today)
    }
  }, []) // Run once on component mount

  useEffect(() => {
    const checkDateChange = setInterval(() => {
      if (shouldClearCache()) {
        console.log("[v0] Date changed while app is active - clearing cache")
        clearAttendanceCache()

        // Reset local state
        setLocalTodayAttendance(null)
        setRecentCheckIn(false)
        setRecentCheckOut(false)

        // Fetch fresh data
        fetchTodayAttendance()
        // fetchLeaveStatus() // Fetch leave status again on date change

        // Update cached date
        const today = new Date().toISOString().split("T")[0]
        setCachedDate(today)
      }
    }, 60000) // Check every minute

    return () => clearInterval(checkDateChange)
  }, [])

  const [flashMessage, setFlashMessage] = useState<{
    message: string
    type: "success" | "error" | "info" | "warning"
  } | null>(null)

  const [refreshTimer, setRefreshTimer] = useState<number | null>(null)

  const [minutesUntilCheckout, setMinutesUntilCheckout] = useState<number | null>(null)

  const fetchTodayAttendance = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const today = new Date().toISOString().split("T")[0]

      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .gte("check_in_time", `${today}T00:00:00`)
        .lte("check_in_time", `${today}T23:59:59`)
        .order("check_in_time", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error("[v0] Error fetching today's attendance:", error)
        return
      }

      if (data) {
        setLocalTodayAttendance(data)
      }
    } catch (error) {
      console.error("[v0] Error in fetchTodayAttendance:", error)
    }
  }

  // Removed leave status logic
  // const isOnLeave = leaveStatus !== "active"
  const isOnLeave = false // Placeholder: Assume not on leave if leave status is removed
  const canCheckInButton = initialCanCheckIn && !recentCheckIn && !localTodayAttendance?.check_in_time && !isOnLeave
  const canCheckOutButton =
    initialCanCheckOut &&
    !recentCheckOut &&
    localTodayAttendance?.check_in_time &&
    !localTodayAttendance?.check_out_time &&
    !isOnLeave

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
      }
    }

    autoLoadLocation()
  }, [])

  useEffect(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      reverseGeocode(userLocation.latitude, userLocation.longitude)
        .then((name) => {
          console.log("[v0] Detected location name:", name)
          setDetectedLocationName(name)
        })
        .catch((err) => console.error("[v0] Failed to get location name:", err))
    }
  }, [userLocation])

  useEffect(() => {
    loadProximitySettings()
  }, [])

  useEffect(() => {
    const checkDateChange = () => {
      const newDate = new Date().toISOString().split("T")[0]
      if (newDate !== currentDate) {
        console.log("[v0] Date changed from", currentDate, "to", newDate)
        setCurrentDate(newDate)
        window.location.reload()
      }
    }

    const interval = setInterval(checkDateChange, 60000)

    return () => clearInterval(interval)
  }, [currentDate])

  useEffect(() => {
    if (localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time) {
      const checkInTime = new Date(localTodayAttendance.check_in_time)
      const now = new Date()
  const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
  
  if (hoursSinceCheckIn < 2) {
    // Calculate minutes until 2 hours have passed
    const minutesLeft = Math.ceil((2 - hoursSinceCheckIn) * 60)
    setMinutesUntilCheckout(minutesLeft)

        // Update every minute
    const interval = setInterval(() => {
      const currentNow = new Date()
      const currentHoursSinceCheckIn = (currentNow.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
      
      if (currentHoursSinceCheckIn >= 2) {
        setMinutesUntilCheckout(null)
        setCheckoutTimeReached(true)
        clearInterval(interval)
      } else {
        const currentMinutesLeft = Math.ceil((2 - currentHoursSinceCheckIn) * 60)
        setMinutesUntilCheckout(currentMinutesLeft)
      }
    }, 60000) // Update every minute

        return () => clearInterval(interval)
      } else {
        setMinutesUntilCheckout(null)
      }
    } else {
      setMinutesUntilCheckout(null)
    }
  }, [localTodayAttendance?.check_in_time, localTodayAttendance?.check_out_time])

  useEffect(() => {
    const checkCheckoutTime = () => {
      if (localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time) {
        const checkInTime = new Date(localTodayAttendance.check_in_time)
        const now = new Date()
        const hoursSinceCheckIn = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

        setCheckoutTimeReached(hoursSinceCheckIn >= 2)
      } else {
        setCheckoutTimeReached(false)
      }
    }

    checkCheckoutTime()
    const interval = setInterval(checkCheckoutTime, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [localTodayAttendance])

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
    }
  }

  useEffect(() => {
    if (
      userLocation?.latitude &&
      userLocation?.longitude &&
      realTimeLocations &&
      realTimeLocations.length > 0 &&
      userProfile?.assigned_location_id
    ) {
      const assignedLocation = realTimeLocations.find((loc) => loc.id === userProfile.assigned_location_id)
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
          name: assignedLocation.name,
        })

        console.log("[v0] Assigned location info:", {
          name: assignedLocation.name,
          distance: Math.round(distance),
          isAtAssignedLocation,
          radius: assignedLocation.radius_meters,
        })
      }
    }
  }, [userLocation, realTimeLocations, userProfile])

  useEffect(() => {
    if (userLocation && realTimeLocations && realTimeLocations.length > 0) {
      console.log(
        "[v0] All available locations:",
        realTimeLocations.map((l) => ({
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

      const locationDistances = realTimeLocations
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

      const validation = validateAttendanceLocation(userLocation, realTimeLocations, proximitySettings)
      const checkoutValidation = validateCheckoutLocation(userLocation, realTimeLocations, proximitySettings)

      console.log("[v0] Location validation result:", validation)
      console.log("[v0] Check-out validation result:", checkoutValidation)
      console.log(
        "[v0] Locations data:",
        realTimeLocations.map((l) => ({ name: l.name, radius: l.radius_meters })),
      )
      console.log("[v0] Validation message:", validation.message)
      console.log("[v0] Can check in:", validation.canCheckIn)
      console.log("[v0] Can check out:", checkoutValidation.canCheckOut)
      console.log("[v0] Distance:", validation.distance)
      console.log("[v0] Nearest location being checked:", validation.nearestLocation?.name)
      console.log("[v0] Using proximity range:", proximitySettings.checkInProximityRange)

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
  }, [userLocation, realTimeLocations, proximitySettings, windowsCapabilities])

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
        if (!window.location.hostname.includes("vusercontent.net")) {
          setError("Authentication error. Please refresh the page.")
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching user profile:", error)
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

      const useSampling = capabilities.browserName === "Opera" || capabilities.hasKnownIssues

      console.log(`[v0] Using ${useSampling ? "multi-sample" : "single"} GPS reading...`)
      const location = useSampling ? await getAveragedLocation(3) : await getCurrentLocation()

      setUserLocation(location)

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

  const handleCheckIn = async () => {
    console.log("[v0] Check-in initiated")

    if (isCheckInProcessing) {
      console.log("[v0] Check-in already in progress - ignoring duplicate request")
      return
    }

    const now = Date.now()
    if (now - lastCheckInAttempt < 3000) {
      console.log("[v0] Check-in attempted too soon after last attempt - ignoring")
      toast({
        title: "Please Wait",
        description: "Processing your previous check-in request...",
        variant: "default",
      })
      return
    }

    if (localTodayAttendance?.check_in_time) {
      const checkInTime = new Date(localTodayAttendance.check_in_time).toLocaleTimeString()
      toast({
        title: "Already Checked In",
        description: `You checked in today at ${checkInTime}. You cannot check in twice.`,
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    setIsCheckInProcessing(true)
    setLastCheckInAttempt(now)
    setRecentCheckIn(true) // Disable button immediately

    try {
      console.log("[v0] Starting check-in process...")
      setIsCheckingIn(true)
      setCheckingMessage("Processing check-in...")
      setError(null)
      setFlashMessage(null)

      const deviceInfo = getDeviceInfo()
      console.log("[v0] Device info:", deviceInfo)

      let resolvedNearestLocation = null // Declare nearestLocation here

      const checkInData: any = {
        device_info: deviceInfo,
      }

      if (userLocation) {
        checkInData.latitude = userLocation.latitude
        checkInData.longitude = userLocation.longitude
      } else {
        // Attempt to get location if not available
        const currentLocation = await getCurrentLocationData()
        if (!currentLocation) {
          throw new Error("Could not retrieve current location.")
        }
        checkInData.latitude = currentLocation.latitude
        checkInData.longitude = currentLocation.longitude
      }

      // Find nearest location based on the possibly newly acquired userLocation
      if (realTimeLocations && realTimeLocations.length > 0 && userLocation) {
        const distances = realTimeLocations
          .map((loc) => ({
            location: loc,
            distance: calculateDistance(userLocation.latitude, userLocation.longitude, loc.latitude, loc.longitude),
          }))
          .sort((a, b) => a.distance - b.distance)

        if (distances.length > 0 && distances[0].distance <= proximitySettings.checkInProximityRange) {
          resolvedNearestLocation = distances[0].location
          checkInData.location_id = resolvedNearestLocation.id // Update checkInData with resolved nearest location
        } else {
          throw new Error(
            `You must be within ${proximitySettings.checkInProximityRange}m of a valid location to check in.`,
          )
        }
      } else {
        throw new Error("No valid locations found or location data is unavailable.")
      }

      console.log("[v0] Sending check-in request to API...")
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        body: JSON.stringify(checkInData),
      })

      const result = await response.json()
      console.log("[v0] Check-in API response:", result)

      if (!response.ok) {
        if (result.error?.includes("DUPLICATE CHECK-IN BLOCKED") || result.error?.includes("already checked in")) {
          console.log("[v0] Duplicate check-in prevented by server")
          setFlashMessage({
            message: result.error,
            type: "error",
          })

          // Refresh attendance status
          await fetchTodayAttendance()

          toast({
            title: "Duplicate Check-in Prevented",
            description: result.error,
            variant: "destructive",
            duration: 8000,
          })
        } else {
          throw new Error(result.error || "Failed to check in")
        }
        return
      }

      console.log("[v0] ✓ Check-in successful")

      if (result.data) {
        // Add device sharing warning to the attendance data if present
        const attendanceWithWarning = {
          ...result.data,
          device_sharing_warning: result.deviceSharingWarning?.message || null
        }
        setLocalTodayAttendance(attendanceWithWarning)
      }

      setFlashMessage({
        message: result.message || "Successfully checked in!",
        type: result.isLateArrival ? "warning" : "success",
      })

      // Refresh attendance data
      await fetchTodayAttendance()

      // Clear attendance cache
      clearAttendanceCache()

      // Show device sharing warning if applicable (highest priority)
      if (result.deviceSharingWarning) {
        toast({
          title: "⚠️ Shared Device Detected",
          description: result.deviceSharingWarning.message,
          variant: "default",
          className: "bg-yellow-50 border-yellow-400 text-yellow-900 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-200",
          duration: 10000,
        })
      }
      
      // Show late arrival warning if applicable
      if (result.isLateArrival) {
        toast({
          title: "Late Arrival Recorded",
          description: `You checked in at ${result.lateArrivalTime} (after 9:00 AM). Your late arrival has been recorded and will be visible to your department head. Please provide a reason if prompted.`,
          variant: "destructive",
          duration: 8000,
        })
      } else if (!result.deviceSharingWarning) {
        // Only show success toast if no other warnings
        toast({
          title: "Check-in Successful",
          description: result.message || "You have successfully checked in.",
          duration: 5000,
        })
      }

      setTimeout(() => {
        setRecentCheckIn(false)
      }, 5000)
    } catch (error: any) {
      console.error("[v0] Check-in error:", error)
      setFlashMessage({
        message: error.message || "Failed to check in. Please try again.",
        type: "error",
      })

      setTimeout(() => {
        setRecentCheckIn(false)
      }, 3000)
    } finally {
      setIsCheckingIn(false)
      setCheckingMessage("")
      setTimeout(() => {
        setIsCheckInProcessing(false)
      }, 2000)
    }
  }

  const handleCheckOut = async () => {
    console.log("[v0] Check-out initiated")

    if (!localTodayAttendance?.check_in_time || localTodayAttendance?.check_out_time) {
      setFlashMessage({
        message:
          "You need to check in first before you can check out. Please complete your check-in to start your shift.",
        type: "info",
      })
      return
    }

    if (minutesUntilCheckout !== null && minutesUntilCheckout > 0) {
      setFlashMessage({
        message: `You must wait ${minutesUntilCheckout} more minute${minutesUntilCheckout !== 1 ? "s" : ""} before checking out. A minimum of 2 hours is required between check-in and check-out.`,
        type: "info",
      })
      return
    }

    const now = new Date()
    const checkoutHour = now.getHours()
    const checkoutMinutes = now.getMinutes()
    
    // Fetch location-specific working hours configuration
    const assignedLocation = realTimeLocations?.find(loc => loc.id === userProfile?.assigned_location_id)
    const checkOutEndTime = assignedLocation?.check_out_end_time || "17:00" // Default to 5 PM
    const requireEarlyCheckoutReason = assignedLocation?.require_early_checkout_reason ?? true
    
    // Parse checkout end time (HH:MM format)
    const [endHour, endMinute] = checkOutEndTime.split(":").map(Number)
    const checkoutEndTimeMinutes = endHour * 60 + (endMinute || 0)
    const currentTimeMinutes = checkoutHour * 60 + checkoutMinutes
    
    const isBeforeCheckoutTime = currentTimeMinutes < checkoutEndTimeMinutes
    
    console.log("[v0] Checkout validation:", {
      location: assignedLocation?.name || "Unknown",
      checkOutEndTime,
      currentTime: `${checkoutHour}:${checkoutMinutes.toString().padStart(2, '0')}`,
      isBeforeCheckoutTime,
      requireEarlyCheckoutReason,
    })

    if (isBeforeCheckoutTime && requireEarlyCheckoutReason && !earlyCheckoutReason) {
      setIsLoading(true)
      try {
        // Get location data first to show in dialog
        const locationData = await getCurrentLocationData()
        if (!locationData) {
          setIsLoading(false)
          return
        }

        const checkoutValidation = validateCheckoutLocation(locationData, realTimeLocations || [], proximitySettings)

        if (!checkoutValidation.canCheckOut) {
          throw new Error(checkoutValidation.message)
        }

        let nearestLocation = null
        if (realTimeLocations && realTimeLocations.length > 0) {
          if (userProfile?.assigned_location_id && assignedLocationInfo?.isAtAssignedLocation) {
            nearestLocation = realTimeLocations.find((loc) => loc.id === userProfile.assigned_location_id)
          } else {
            const locationDistances = realTimeLocations
              .map((loc) => {
                const distance = calculateDistance(
                  locationData.latitude,
                  locationData.longitude,
                  loc.latitude,
                  loc.longitude,
                )
                return { location: loc, distance: Math.round(distance) }
              })
              .sort((a, b) => a.distance - b.distance)
              .filter(({ distance }) => distance <= proximitySettings.checkInProximityRange)

            nearestLocation = locationDistances[0]?.location
          }
        }

        // Store pending checkout data and show dialog
        setPendingCheckoutData({ location: locationData, nearestLocation })
        setShowEarlyCheckoutDialog(true)
        setIsLoading(false)
        return
      } catch (err) {
        console.error("[v0] Pre-checkout validation error:", err)
        setFlashMessage({
          message: err instanceof Error ? err.message : "Failed to validate checkout location.",
          type: "error",
        })
        setIsLoading(false)
        return
      }
    }
    // End of early checkout check

    // Proceed with normal checkout
    setIsLoading(true)
    setError(null)

    try {
      if (!realTimeLocations || realTimeLocations.length === 0) {
        throw new Error("No QCC locations found")
      }

      const locationData = await getCurrentLocationData()
      if (!locationData) {
        setIsLoading(false)
        return
      }

      const checkoutValidation = validateCheckoutLocation(locationData, realTimeLocations || [], proximitySettings)

      if (!checkoutValidation.canCheckOut) {
        throw new Error(checkoutValidation.message)
      }

      let nearestLocation = null
      if (userProfile?.assigned_location_id && assignedLocationInfo?.isAtAssignedLocation) {
        nearestLocation = realTimeLocations.find((loc) => loc.id === userProfile.assigned_location_id)
      } else {
        const locationDistances = realTimeLocations
          .map((loc) => {
            const distance = calculateDistance(
              locationData.latitude,
              locationData.longitude,
              loc.latitude,
              loc.longitude,
            )
            return { location: loc, distance: Math.round(distance) }
          })
          .sort((a, b) => a.distance - b.distance)
          .filter(({ distance }) => distance <= proximitySettings.checkInProximityRange)

        nearestLocation = locationDistances[0]?.location
      }

      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          location_source: locationData.source,
          location_name: nearestLocation?.name || "Unknown Location",
          early_checkout_reason: earlyCheckoutReason || null,
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        console.log("[v0] Checkout successful:", result.data)

        setLocalTodayAttendance(result.data)

        clearAttendanceCache()

        setRecentCheckOut(true)
        setTimeout(() => setRecentCheckOut(false), 3000)

        const checkInTime = new Date(result.data.check_in_time)
        const checkOutTime = new Date(result.data.check_out_time)
        const workHours = ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2)

        setFlashMessage({
          message: `Successfully checked out from ${result.data.check_out_location_name}! Great work today. Total work hours: ${workHours} hours. See you tomorrow!`,
          type: "success",
        })

        setEarlyCheckoutReason("")
        setPendingCheckoutData(null) // Clear pending data after successful checkout

        setTimeout(() => {
          fetchTodayAttendance()
        }, 1000)
      } else {
        throw new Error(result.error || "Failed to record checkout")
      }
    } catch (err) {
      console.error("[v0] Checkout error:", err)
      setFlashMessage({
        message: err instanceof Error ? err.message : "Failed to record checkout. Please try again.",
        type: "error",
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
    const trimmedReason = earlyCheckoutReason.trim()
    
    if (!trimmedReason) {
      setFlashMessage({
        message: "Please provide a reason for early checkout before proceeding.",
        type: "error",
      })
      return
    }
    
    if (trimmedReason.length < 10) {
      setFlashMessage({
        message: "Early checkout reason must be at least 10 characters long. Please provide more details.",
        type: "error",
      })
      return
    }

    setShowEarlyCheckoutDialog(false)
    setIsLoading(true)

    try {
      const { location, nearestLocation } = pendingCheckoutData

      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          location_source: location.source,
          location_name: nearestLocation?.name || "Unknown Location",
          early_checkout_reason: earlyCheckoutReason,
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        console.log("[v0] Early checkout successful with reason")

        setLocalTodayAttendance(result.data)

        clearAttendanceCache()

        setRecentCheckOut(true)
        setTimeout(() => setRecentCheckOut(false), 3000)

        const checkInTime = new Date(result.data.check_in_time)
        const checkOutTime = new Date(result.data.check_out_time)
        const workHours = ((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(2)

        setFlashMessage({
          message: `Successfully checked out early from ${result.data.check_out_location_name}. Work hours: ${workHours} hours. Your reason has been recorded and is visible to department heads, supervisors, and HR.`,
          type: "warning",
        })

        setEarlyCheckoutReason("")
        setPendingCheckoutData(null)

        // Redirect to main page after 2 seconds
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 2000)
      } else {
        throw new Error(result.error || "Failed to record checkout")
      }
    } catch (err) {
      console.error("[v0] Early checkout error:", err)
      setFlashMessage({
        message: err instanceof Error ? err.message : "Failed to record checkout. Please try again.",
        type: "error",
      })
      setShowEarlyCheckoutDialog(true) // Keep dialog open if there's an error
    } finally {
      setIsLoading(false)
    }
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

  const checkInDate = localTodayAttendance?.check_in_time
    ? new Date(localTodayAttendance.check_in_time).toISOString().split("T")[0]
    : null

  const isFromPreviousDay = checkInDate && checkInDate !== currentDate

  const isCheckedIn = localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time && !isFromPreviousDay
  const isCheckedOut = localTodayAttendance?.check_out_time
  const isCompletedForDay =
    localTodayAttendance?.check_in_time && localTodayAttendance?.check_out_time && !isFromPreviousDay

  const defaultMode = canCheckInButton ? "checkin" : canCheckOutButton ? "checkout" : null

  const handleLocationSelect = (location: GeofenceLocation) => {
    console.log("Location selected:", location.name)
    // Logic to handle location selection, e.g., pre-filling a form or triggering an action
  }

  return (
    <div className={cn("space-y-6", className)}>
      {flashMessage && (
        <FlashMessage
          message={flashMessage.message}
          type={flashMessage.type}
          duration={50000}
          onClose={() => setFlashMessage(null)}
        />
      )}

      {/* Add checking status display in the UI */}
      {isCheckingIn && checkingMessage && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <div>
              <p className="font-medium text-blue-900">{checkingMessage}</p>
              {(recentCheckIn || recentCheckOut) && (
                <p className="text-sm text-blue-700 mt-1">
                  Status will automatically update in{" "}
                  {Math.ceil((REFRESH_PAUSE_DURATION - (Date.now() % REFRESH_PAUSE_DURATION)) / 1000)} seconds
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* {isOnLeave && (
        <Alert className="border-amber-200 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">On Leave</AlertTitle>
          <AlertDescription className="text-amber-800">
            You are currently marked as {leaveStatus === "on_leave" ? "on leave" : "on sick leave"}. Check-in and
            check-out are disabled during your leave period.
          </AlertDescription>
        </Alert>
      )} */}

      {userLocation && (
        <div
          className={`border-2 rounded-lg p-4 transition-all ${
            localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time
              ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-300 dark:border-green-700"
              : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
          }`}
        >
          <div className="flex items-start gap-3">
            {localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time ? (
              <>
                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100">✓ Checked In Successfully</p>
                    <p className="text-base font-semibold text-green-700 dark:text-green-300 mt-1">
                      📍 {localTodayAttendance.check_in_location_name}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 bg-white/50 dark:bg-black/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Check-in Time</p>
                      <p className="text-sm font-bold text-green-900 dark:text-green-100">
                        {new Date(localTodayAttendance.check_in_time).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">Date</p>
                      <p className="text-sm font-bold text-green-900 dark:text-green-100">
                        {new Date(localTodayAttendance.check_in_time).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">GPS Coordinates</p>
                      <p className="text-xs font-mono text-green-900 dark:text-green-100">
                        {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">GPS Accuracy</p>
                      <p className="text-sm font-bold text-green-900 dark:text-green-100">
                        {userLocation.accuracy?.toFixed(0)}m
                      </p>
                    </div>
                  </div>

                  {refreshTimer !== null && (
                    <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                      <Info className="h-3 w-3" />
                      <span>Updating status in {refreshTimer} seconds...</span>
                    </div>
                  )}

                  <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                    ⚠️ Remember to check out when you leave!
                  </p>
                </div>
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Your Current Location</p>
                    {detectedLocationName && (
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {detectedLocationName}
                      </p>
                    )}
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      GPS: {userLocation.latitude.toFixed(6)}, {userLocation.longitude.toFixed(6)}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Accuracy: {userLocation.accuracy?.toFixed(0)}m
                    </p>
                  </div>

                  {(() => {
                    if (!realTimeLocations || realTimeLocations.length === 0) return null

                    const locationsWithDistance = realTimeLocations.map((loc) => ({
                      ...loc,
                      distance: calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        loc.latitude,
                        loc.longitude,
                      ),
                    }))

                    const nearest = locationsWithDistance.sort((a, b) => a.distance - b.distance)[0]

                    return (
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Nearest: {nearest.name} (
                        {nearest.distance < 1000
                          ? `${nearest.distance.toFixed(0)}m`
                          : `${(nearest.distance / 1000).toFixed(1)}km`}
                        )
                      </p>
                    )
                  })()}
                </div>
              </>
            )}
            <Button
              onClick={getCurrentLocationData}
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="flex-shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Card className="bg-destructive/10 border-destructive/20 dark:bg-destructive/50 dark:border-destructive/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Success</p>
                  <p className="text-xs text-green-800 dark:text-green-200">{successMessage}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isCompletedForDay && (
        <div className="rounded-lg border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/30 dark:via-green-950/30 dark:to-teal-950/30 p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-900 dark:text-emerald-100">✅ Attendance Complete!</h3>
              <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                Your work session has been successfully recorded
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/60 dark:bg-black/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Check-In Time</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {new Date(localTodayAttendance.check_in_time).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                📍 {localTodayAttendance.check_in_location_name}
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Check-Out Time</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {new Date(localTodayAttendance.check_out_time).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                📍 {localTodayAttendance.check_out_location_name}
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Work Hours</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {localTodayAttendance.work_hours?.toFixed(2) || "0.00"} hours
              </p>
            </div>

            <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Status</p>
              <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">✓ Completed for Today</Badge>
            </div>
          </div>

          {refreshTimer !== null && refreshTimer > 0 && (
            <div className="mt-4 text-center text-sm text-emerald-700 dark:text-emerald-300">
              Status will refresh in {Math.floor(refreshTimer / 60)}:{(refreshTimer % 60).toString().padStart(2, "0")}
            </div>
          )}

          <div className="mt-4 text-center">
            <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
              🎉 Great work today! Your attendance has been successfully recorded.
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              You can view your full attendance history in the reports section.
            </p>
          </div>
        </div>
      )}

      {localTodayAttendance?.device_sharing_warning && (
        <Alert className="bg-yellow-50 border-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-700 mb-4">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-300 font-semibold">
            ⚠️ Shared Device Detected
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            {localTodayAttendance.device_sharing_warning}
          </AlertDescription>
        </Alert>
      )}

      {minutesUntilCheckout !== null && minutesUntilCheckout > 0 && isCheckedIn && !isCheckedOut && (
        <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
          <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-300">Check-Out Pending</AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            You can check out in {minutesUntilCheckout} minute{minutesUntilCheckout !== 1 ? "s" : ""}. A minimum of 2
            hours is required between check-in and check-out.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions Section */}
      {!isCompletedForDay && (
        <Card className={cn("w-full", className)}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time
                    ? "Today's Attendance"
                    : localTodayAttendance?.check_out_time
                      ? "Attendance Complete"
                      : "Today's Attendance"}
                </CardTitle>
                <CardDescription>Record your check-in and check-out for today</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Check-in/Check-out Buttons */}
            <div className="space-y-4">
              {!localTodayAttendance?.check_in_time && (
                <Button
                  onClick={handleCheckIn}
                  disabled={
                    !locationValidation?.canCheckIn || isCheckingIn || isProcessing || recentCheckIn || isLoading
                  }
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg relative overflow-hidden group"
                  size="lg"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10 flex items-center justify-center w-full">
                    {isCheckingIn ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {checkingMessage || "Checking In..."}
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-5 w-5" />
                        Check In
                        <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">Protected</span>
                      </>
                    )}
                  </div>
                </Button>
              )}

              {localTodayAttendance?.check_in_time && !localTodayAttendance?.check_out_time && (
                <>
                  {checkoutTimeReached ? (
                    <>
                      {console.log("[v0] Checkout button state:", {
                        checkoutTimeReached,
                        canCheckOut: locationValidation?.canCheckOut,
                        isCheckingIn,
                        isProcessing,
                        recentCheckOut,
                        isLoading,
                        buttonDisabled: !locationValidation?.canCheckOut || isCheckingIn || isProcessing || recentCheckOut || isLoading
                      })}
                      <Button
                        onClick={handleCheckOut}
                        disabled={
                          !locationValidation?.canCheckOut || isCheckingIn || isProcessing || recentCheckOut || isLoading
                        }
                        variant="destructive"
                        className="w-full transition-all duration-300 bg-red-600 hover:bg-red-700 text-white"
                        size="lg"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Checking Out...
                          </>
                        ) : (
                          <>
                            <LogOut className="mr-2 h-5 w-5" />
                            Check Out Now
                          </>
                        )}
                      </Button>
                      {!locationValidation?.canCheckOut && (
                        <p className="text-xs text-red-500 mt-2 text-center">
                          You are outside the approved location range. Please move closer to a QCC location to check out.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="w-full p-4 bg-muted/50 border-2 border-dashed border-border rounded-lg text-center">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground mb-1">Check-Out Available Soon</p>
                      <p className="text-xs text-muted-foreground">
                        {minutesUntilCheckout !== null && minutesUntilCheckout > 0
                          ? `Available in ${minutesUntilCheckout} minute${minutesUntilCheckout !== 1 ? "s" : ""}`
                          : "Calculating..."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Minimum 2 hours required between check-in and check-out
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-3 opacity-40 pointer-events-none">
              <p className="text-sm text-muted-foreground text-center mb-3">Alternative Method</p>
              <Button
                variant="outline"
                size="lg"
                disabled
                className="w-full h-12 md:h-14 text-sm md:text-base cursor-not-allowed bg-transparent"
              >
                <MapPin className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                Enter Location Code Manually
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Tap your location below for instant check-in - no camera needed!
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              disabled
              className="w-full h-12 md:h-14 opacity-40 cursor-not-allowed bg-transparent"
            >
              <QrCode className="h-5 w-5 md:h-6 md:w-6 mr-2" />
              Use QR Code Scanner
            </Button>

            <Button
              onClick={handleRefreshLocations}
              variant="secondary"
              size="lg"
              className="w-full h-12 md:h-14"
              disabled={isLoading || isCheckingIn}
            >
              <RefreshCw className={`h-5 w-5 md:h-6 md:w-6 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Attendance Status
            </Button>
            <p className="text-xs md:text-sm text-muted-foreground text-center">
              Click to manually update your attendance status if the buttons don't change after check-in/check-out
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Location Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 md:p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium text-muted-foreground">Your Assigned Location</p>
                <p className="text-lg md:text-xl font-semibold">{assignedLocationInfo?.name || "Loading..."}</p>
                {assignedLocationInfo && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Distance: {(assignedLocationInfo.distance / 1000).toFixed(2)}km away</span>
                  </div>
                )}
              </div>
              {assignedLocationInfo && (
                <Badge variant={assignedLocationInfo.isAtAssignedLocation ? "default" : "secondary"}>
                  {assignedLocationInfo.isAtAssignedLocation ? "At Location" : "Remote Location"}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Quick Select Location</p>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {realTimeLocations && realTimeLocations.length > 0 ? (
                realTimeLocations.map((location) => {
                  const distance = userLocation
                    ? calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        location.latitude,
                        location.longitude,
                      )
                    : null

                  return (
                    <Button
                      key={location.id}
                      onClick={() => handleLocationSelect(location)}
                      variant="outline"
                      className="h-auto p-4 justify-start text-left"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-base">{location.name}</p>
                        {distance !== null && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {distance < 1000 ? `${distance.toFixed(0)}m` : `${(distance / 1000).toFixed(2)}km`}
                          </p>
                        )}
                      </div>
                    </Button>
                  )
                })
              ) : (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No locations available</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">All QCC Locations</p>
            <div className="space-y-2">
              {realTimeLocations && realTimeLocations.length > 0 ? (
                realTimeLocations.map((location) => {
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
                      className="flex items-center justify-between p-3 md:p-4 rounded-lg border hover:bg-accent transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm md:text-base">{location.name}</p>
                        <p className="text-xs md:text-sm text-muted-foreground">{location.address}</p>
                      </div>
                      {distance !== null && (
                        <Badge variant="outline" className="ml-2">
                          {distance < 1000 ? `${distance.toFixed(0)}m` : `${(distance / 1000).toFixed(1)}km`}
                        </Badge>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Loading locations...</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {showCodeEntry && (
        <LocationCodeDialog
          open={showCodeEntry}
          onClose={() => setShowCodeEntry(false)}
          locations={realTimeLocations || []}
          userLocation={userLocation}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          canCheckIn={canCheckInButton}
          canCheckOut={canCheckOutButton}
          isCheckedIn={isCheckedIn}
        />
      )}

      {showLocationCodeDialog && (
        <LocationCodeDialog
          open={showLocationCodeDialog}
          onClose={() => setShowLocationCodeDialog(false)}
          locations={realTimeLocations || []}
          userLocation={userLocation}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          canCheckIn={canCheckInButton}
          canCheckOut={canCheckOutButton}
          isCheckedIn={isCheckedIn}
        />
      )}

      {showScanner && (
        <QRScannerDialog
          open={showScanner}
          onClose={() => setShowScanner(false)}
          mode={defaultMode}
          userLocation={userLocation}
        />
      )}

      {showEarlyCheckoutDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="h-5 w-5" />
                Early Check-Out Notice
              </CardTitle>
              <CardDescription>
                You are checking out before {assignedLocationInfo?.name?.toLowerCase().includes("tema port") ? "4:00 PM" : "5:00 PM"}. Please provide a reason.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-orange-200 bg-orange-50">
                <Info className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800">Important</AlertTitle>
                <AlertDescription className="text-orange-700">
                  Your reason will be visible to your department head, supervisor, and HR portal for review.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="early-checkout-reason">Reason for Early Checkout *</Label>
                <textarea
                  id="early-checkout-reason"
                  value={earlyCheckoutReason}
                  onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                  placeholder="e.g., Medical appointment, family emergency, approved leave..."
                  className="w-full min-h-[100px] p-3 border rounded-md resize-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  maxLength={500}
                />
                <p className={`text-xs ${earlyCheckoutReason.length < 10 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {earlyCheckoutReason.length}/500 characters (minimum 10 required)
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleEarlyCheckoutCancel}
                  variant="outline"
                  className="flex-1 bg-transparent"
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEarlyCheckoutConfirm}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                  disabled={isLoading || earlyCheckoutReason.trim().length < 10}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Confirm Check-Out"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
