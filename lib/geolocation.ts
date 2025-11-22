export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp?: number
}

export interface GeofenceLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
}

export interface ProximitySettings {
  checkInProximityRange: number
  defaultRadius: number
  requireHighAccuracy: boolean
  allowManualOverride: boolean
}

export class GeolocationError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message)
    this.name = "GeolocationError"
  }
}

export function detectWindowsLocationCapabilities(): {
  isWindows: boolean
  hasGPS: boolean
  hasWiFi: boolean
  supportedSources: string[]
  recommendedSettings: PositionOptions
} {
  const userAgent = navigator.userAgent.toLowerCase()
  const isWindows = userAgent.includes("windows")

  // Detect available location sources on Windows
  const hasGPS = "geolocation" in navigator && "permissions" in navigator
  const hasWiFi = "connection" in navigator || "onLine" in navigator

  const supportedSources = []
  if (hasGPS) supportedSources.push("GPS")
  if (hasWiFi) supportedSources.push("Wi-Fi")
  if (isWindows) supportedSources.push("Windows Location Services")

  const recommendedSettings: PositionOptions = {
    enableHighAccuracy: true,
    timeout: isWindows ? 10000 : 8000, // Faster timeout for quicker QR code fallback
    maximumAge: 0, // Always request fresh location data, no cached positions
  }

  return {
    isWindows,
    hasGPS,
    hasWiFi,
    supportedSources,
    recommendedSettings,
  }
}

export async function getCurrentLocation(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationError("Geolocation is not supported by this browser", 0))
      return
    }

    const capabilities = detectWindowsLocationCapabilities()
    console.log("[v0] Windows location capabilities:", capabilities)

    const options = capabilities.recommendedSettings

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("[v0] Location acquired:", {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: capabilities.isWindows ? "Windows Location Services" : "Browser Geolocation",
        })

        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
        })
      },
      (error) => {
        let message = "Unknown error occurred"
        let guidance = ""

        switch (error.code) {
          case error.PERMISSION_DENIED:
            if (capabilities.isWindows) {
              message = "Location access denied. Please enable location permissions."
              guidance = `
Windows Location Setup:
1. Open Windows Settings → Privacy & Security → Location
2. Turn ON "Location services" 
3. Turn ON "Allow apps to access your location"
4. In your browser, click the location icon in the address bar and select "Allow"
5. Refresh this page and try again

Alternative: Use the QR code option for attendance.`
            } else {
              message =
                "Location access denied. Please enable location permissions in your browser settings and try again, or use the QR code option instead."
            }
            break
          case error.POSITION_UNAVAILABLE:
            if (capabilities.isWindows) {
              message = "Windows Location Services unavailable."
              guidance = `
Troubleshooting:
1. Check if Windows Location Services are enabled in Settings
2. Ensure you have an active internet connection for Wi-Fi positioning
3. Try moving to a location with better GPS signal (near a window)
4. Use the QR code option as an alternative`
            } else {
              message = "Location information is unavailable. Please check your GPS settings or use the QR code option."
            }
            break
          case error.TIMEOUT:
            if (capabilities.isWindows) {
              message = "Windows Location Services timed out."
              guidance = `
Quick fix: Use the QR code option below for instant check-in/check-out

If you prefer GPS:
1. Enable Windows Location Services in Settings → Privacy & Security → Location
2. Ensure internet connection is active
3. Move near a window for better signal
4. Try again`
            } else {
              message = "Location request timed out. Please use the QR code option below or try again."
            }
            break
        }

        const fullMessage = guidance ? `${message}\n\n${guidance}` : message
        reject(new GeolocationError(fullMessage, error.code))
      },
      options,
    )
  })
}

export function watchLocation(
  onLocationUpdate: (location: LocationData) => void,
  onError: (error: GeolocationError) => void,
): number | null {
  if (!navigator.geolocation) {
    onError(new GeolocationError("Geolocation is not supported by this browser", 0))
    return null
  }

  const capabilities = detectWindowsLocationCapabilities()

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: capabilities.isWindows ? 12000 : 10000,
    maximumAge: 0, // Always get fresh location updates
  }

  return navigator.geolocation.watchPosition(
    (position) => {
      onLocationUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
      })
    },
    (error) => {
      let message = "Location tracking error"
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = capabilities.isWindows
            ? "Windows Location Services access denied. Please check your Windows privacy settings."
            : "Location access denied"
          break
        case error.POSITION_UNAVAILABLE:
          message = capabilities.isWindows
            ? "Windows Location Services unavailable. Check your location settings."
            : "Location unavailable"
          break
        case error.TIMEOUT:
          message = capabilities.isWindows ? "Windows Location Services timeout. Trying again..." : "Location timeout"
          break
      }
      onError(new GeolocationError(message, error.code))
    },
    options,
  )
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

export function isWithinGeofence(
  userLocation: LocationData,
  geofenceLocation: GeofenceLocation,
): { isWithin: boolean; distance: number; accuracyWarning?: string } {
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    geofenceLocation.latitude,
    geofenceLocation.longitude,
  )

  const toleranceBuffer = 20 // Additional buffer for GPS accuracy variations
  const effectiveRadius = geofenceLocation.radius_meters + toleranceBuffer
  const isWithin = distance <= effectiveRadius

  let accuracyWarning: string | undefined

  const capabilities = detectWindowsLocationCapabilities()

  if (userLocation.accuracy > 20) {
    accuracyWarning = capabilities.isWindows
      ? `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For better accuracy on Windows:
• Move near a window for better GPS signal
• Ensure Windows Location Services are enabled
• Check that Wi-Fi is connected for assisted positioning`
      : "GPS accuracy is low. Please ensure you have a clear view of the sky for better location precision."
  }

  return {
    isWithin,
    distance: Math.round(distance),
    accuracyWarning,
  }
}

export function findNearestLocation(
  userLocation: LocationData,
  locations: GeofenceLocation[],
): { location: GeofenceLocation; distance: number } | null {
  if (locations.length === 0) return null

  let nearest = locations[0]
  let minDistance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    nearest.latitude,
    nearest.longitude,
  )

  for (let i = 1; i < locations.length; i++) {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      locations[i].latitude,
      locations[i].longitude,
    )
    if (distance < minDistance) {
      minDistance = distance
      nearest = locations[i]
    }
  }

  return { location: nearest, distance: Math.round(minDistance) }
}

export function validateAttendanceLocation(
  userLocation: LocationData,
  qccLocations: GeofenceLocation[],
  proximitySettings?: ProximitySettings,
): {
  canCheckIn: boolean
  nearestLocation?: GeofenceLocation
  distance?: number
  message: string
  accuracyWarning?: string
  allLocations?: Array<{ location: GeofenceLocation; distance: number }>
  availableLocations?: Array<{ location: GeofenceLocation; distance: number }>
} {
  const baseProximityDistance = proximitySettings?.checkInProximityRange || 50
  const toleranceBuffer = 50 // Increased buffer to account for browser GPS variance (total effective range: 100m)
  const globalProximityDistance = baseProximityDistance + toleranceBuffer

  const nearest = findNearestLocation(userLocation, qccLocations)

  if (!nearest) {
    return {
      canCheckIn: false,
      message: "No QCC locations found in the system.",
    }
  }

  const allLocationsWithDistance = qccLocations
    .map((location) => ({
      location,
      distance: Math.round(
        calculateDistance(userLocation.latitude, userLocation.longitude, location.latitude, location.longitude),
      ),
    }))
    .sort((a, b) => a.distance - b.distance)

  const availableLocations = allLocationsWithDistance.filter(({ distance }) => distance <= globalProximityDistance)

  const canCheckIn = availableLocations.length > 0

  let message: string
  if (canCheckIn) {
    if (availableLocations.length === 1) {
      message = `Ready for check-in at ${availableLocations[0].location.name} (${availableLocations[0].distance}m away)`
    } else {
      message = `Ready for check-in at ${availableLocations.length} nearby locations. Nearest: ${availableLocations[0].location.name} (${availableLocations[0].distance}m away)`
    }
  } else {
    message = `Outside ${globalProximityDistance}m range - Cannot check in. Nearest location: ${nearest.location.name} (Distance: ${nearest.distance}m). Try using QR code instead.`
  }

  let accuracyWarning: string | undefined
  const capabilities = detectWindowsLocationCapabilities()

  if (userLocation.accuracy > 30) {
    accuracyWarning = capabilities.isWindows
      ? `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For better accuracy with ${globalProximityDistance}m proximity range on Windows:
• Ensure Windows Location Services are enabled in Settings
• Move to a location with better GPS signal (near windows)
• Check that Wi-Fi is connected for assisted positioning
• Consider using QR code for guaranteed check-in`
      : `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For best results with ${globalProximityDistance}m proximity range:
• Ensure you have a clear view of the sky
• Move to a location with better GPS signal
• Consider using QR code for guaranteed check-in`
  }

  return {
    canCheckIn,
    nearestLocation: nearest.location,
    distance: nearest.distance,
    message,
    accuracyWarning,
    allLocations: allLocationsWithDistance,
    availableLocations,
  }
}

export function validateCheckoutLocation(
  userLocation: LocationData,
  qccLocations: GeofenceLocation[],
  proximitySettings?: ProximitySettings,
): {
  canCheckOut: boolean
  nearestLocation?: GeofenceLocation
  distance?: number
  message: string
  accuracyWarning?: string
} {
  const baseProximityDistance = proximitySettings?.checkInProximityRange || 50
  const toleranceBuffer = 50 // Increased buffer to account for browser GPS variance (total effective range: 100m)
  const globalProximityDistance = baseProximityDistance + toleranceBuffer

  const nearest = findNearestLocation(userLocation, qccLocations)

  if (!nearest) {
    return {
      canCheckOut: false,
      message: "No QCC locations found in the system.",
    }
  }

  const canCheckOut = nearest.distance <= globalProximityDistance

  let message: string
  if (canCheckOut) {
    message = `Ready for check-out at ${nearest.location.name} (${nearest.distance}m away)`
  } else {
    message = `Outside ${globalProximityDistance}m range - Cannot check out. Nearest location: ${nearest.location.name} (Distance: ${nearest.distance}m). Try using QR code instead.`
  }

  let accuracyWarning: string | undefined
  const capabilities = detectWindowsLocationCapabilities()

  if (userLocation.accuracy > 30) {
    accuracyWarning = capabilities.isWindows
      ? `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For better accuracy with ${globalProximityDistance}m proximity range on Windows:
• Check Windows Location Services settings
• Ensure good GPS signal reception
• Verify Wi-Fi connection for assisted positioning
• Consider using QR code for guaranteed check-out`
      : `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For best results with ${globalProximityDistance}m proximity range:
• Ensure you have a clear view of the sky
• Move to a location with better GPS signal
• Consider using QR code for guaranteed check-out`
  }

  return {
    canCheckOut,
    nearestLocation: nearest.location,
    distance: nearest.distance,
    message,
    accuracyWarning,
  }
}

export async function requestLocationPermission(): Promise<{ granted: boolean; message: string }> {
  if (!navigator.geolocation) {
    return {
      granted: false,
      message: "Geolocation is not supported by this browser. Please use the QR code option instead.",
    }
  }

  const capabilities = detectWindowsLocationCapabilities()

  try {
    // Check if permissions API is available
    if ("permissions" in navigator) {
      const permission = await navigator.permissions.query({ name: "geolocation" })

      if (permission.state === "granted") {
        return { granted: true, message: "Location permission already granted" }
      } else if (permission.state === "denied") {
        const message = capabilities.isWindows
          ? `Location access is blocked. To enable on Windows:

1. Windows Settings:
   • Open Settings → Privacy & Security → Location
   • Turn ON "Location services"
   • Turn ON "Allow apps to access your location"

2. Browser Settings:
   • Click the location/lock icon in your address bar
   • Select "Allow" for location access
   • Refresh the page and try again

Alternative: Use the QR code option for attendance.`
          : `Location access is blocked. Please enable location permissions in your browser settings:

1. Click the location icon in your address bar
2. Select 'Allow' for location access
3. Refresh the page and try again

Alternatively, use the QR code option for attendance.`

        return { granted: false, message }
      }
    }

    // Try to get location to trigger permission request
    await getCurrentLocation()
    return { granted: true, message: "Location permission granted successfully" }
  } catch (error) {
    if (error instanceof GeolocationError && error.code === 1) {
      const message = capabilities.isWindows
        ? `Location access denied. To enable on Windows:

1. Windows Settings → Privacy & Security → Location:
   • Turn ON "Location services"
   • Turn ON "Allow apps to access your location"

2. Browser permissions:
   • Click the location icon (🔒) in your browser's address bar
   • Select "Allow" for location access
   • Refresh the page and try again

Or use the QR code option for attendance tracking.`
        : `Location access denied. To enable:

1. Click the location icon (🔒) in your browser's address bar
2. Select "Allow" for location access
3. Refresh the page and try again

Or use the QR code option for attendance tracking.`

      return { granted: false, message }
    }
    return {
      granted: false,
      message: error instanceof Error ? error.message : "Failed to access location. Please use the QR code option.",
    }
  }
}

export function getWindowsLocationTroubleshooting(): {
  isWindows: boolean
  troubleshootingSteps: string[]
  quickFixes: string[]
} {
  const capabilities = detectWindowsLocationCapabilities()

  if (!capabilities.isWindows) {
    return {
      isWindows: false,
      troubleshootingSteps: [
        "Enable location permissions in your browser",
        "Check GPS settings on your device",
        "Ensure you have internet connectivity",
      ],
      quickFixes: ["Try refreshing the page", "Use QR code for attendance instead"],
    }
  }

  return {
    isWindows: true,
    troubleshootingSteps: [
      "Open Windows Settings > Privacy & Security > Location",
      "Turn on 'Location services' for Windows",
      "Turn on 'Allow apps to access your location'",
      "In your browser, allow location access when prompted",
      "Ensure you have Wi-Fi or internet connection for better accuracy",
      "Check that your browser has permission to access location",
    ],
    quickFixes: [
      "Connect to Wi-Fi for improved location accuracy",
      "Move to an area with better GPS signal (near windows)",
      "Restart your browser and try again",
      "Use QR code for immediate attendance tracking",
    ],
  }
}
