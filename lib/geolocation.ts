import type {
  LocationData,
  GeofenceLocation,
  ProximitySettings,
  BrowserToleranceSettings,
  GeoSettings,
} from "./geolocation-types"
import { getDeviceInfo } from "./device-info"

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
  browserName: string
  hasKnownIssues: boolean
  issueDescription?: string
} {
  const userAgent = navigator.userAgent.toLowerCase()
  const isWindows = userAgent.includes("windows")

  let browserName = "Unknown"
  let hasKnownIssues = false
  let issueDescription = ""

  if (userAgent.includes("opr/") || userAgent.includes("opera")) {
    browserName = "Opera"
    hasKnownIssues = true
    issueDescription =
      "Opera browser on Windows has known GPS accuracy issues and often uses IP-based location (very inaccurate). We strongly recommend using Chrome or Edge for GPS check-in, or use the QR code option for reliable attendance."
  } else if (userAgent.includes("firefox")) {
    browserName = "Firefox"
  } else if (userAgent.includes("edg/")) {
    browserName = "Edge"
  } else if (userAgent.includes("chrome")) {
    browserName = "Chrome"
  } else if (userAgent.includes("safari")) {
    browserName = "Safari"
  }

  // Detect available location sources on Windows
  const hasGPS = "geolocation" in navigator && "permissions" in navigator
  const hasWiFi = "connection" in navigator || "onLine" in navigator

  const supportedSources = []
  if (hasGPS) supportedSources.push("GPS")
  if (hasWiFi) supportedSources.push("Wi-Fi")
  if (isWindows) supportedSources.push("Windows Location Services")

  const recommendedSettings: PositionOptions = {
    enableHighAccuracy: true,
    timeout: isWindows ? 10000 : 8000,
    maximumAge: 0,
  }

  return {
    isWindows,
    hasGPS,
    hasWiFi,
    supportedSources,
    recommendedSettings,
    browserName,
    hasKnownIssues,
    issueDescription,
  }
}

export function detectBrowser(): {
  name: string
  version: string
  hasGPSIssues: boolean
} {
  const userAgent = navigator.userAgent.toLowerCase()
  let name = "Unknown"
  let version = ""
  let hasGPSIssues = false

  if (userAgent.includes("opr/") || userAgent.includes("opera")) {
    name = "Opera"
    hasGPSIssues = true
    version = userAgent.match(/opr\/([0-9.]+)/)?.[1] || ""
  } else if (userAgent.includes("edg/")) {
    name = "Edge"
    version = userAgent.match(/edg\/([0-9.]+)/)?.[1] || ""
  } else if (userAgent.includes("chrome")) {
    name = "Chrome"
    version = userAgent.match(/chrome\/([0-9.]+)/)?.[1] || ""
  } else if (userAgent.includes("firefox")) {
    name = "Firefox"
    version = userAgent.match(/firefox\/([0-9.]+)/)?.[1] || ""
  } else if (userAgent.includes("safari")) {
    name = "Safari"
    version = userAgent.match(/version\/([0-9.]+)/)?.[1] || ""
  }

  return { name, version, hasGPSIssues }
}

/**
 * Get browser-specific tolerance distance
 */
export async function getBrowserTolerance(geoSettings?: GeoSettings): Promise<number> {
  const deviceInfo = getDeviceInfo()
  const isMobile = deviceInfo.device_type === "mobile" || deviceInfo.device_type === "tablet"

  // If user is on mobile/tablet, use mobile tolerance (50 meters)
  if (isMobile) {
    return geoSettings?.mobileDeviceTolerance || 50
  }

  const browserInfo = detectBrowser()

  // If browser-specific tolerance is disabled, use global setting
  if (!geoSettings?.enableBrowserSpecificTolerance) {
    return geoSettings?.globalProximityDistance || 1000
  }

  const tolerances = geoSettings?.browserTolerances || {
    chrome: 1000,
    edge: 300,
    firefox: 1000,
    safari: 1000,
    opera: 1000,
    default: 1000,
  }

  // Map browser name to tolerance
  const browserKey = browserInfo.name.toLowerCase() as keyof BrowserToleranceSettings
  return tolerances[browserKey] || tolerances.default
}

/**
 * Check if user is within proximity of a location with browser-specific tolerance
 */
export async function isWithinBrowserProximity(
  userLocation: LocationData,
  locationLat: number,
  locationLng: number,
  geoSettings?: GeoSettings,
): Promise<{
  isWithin: boolean
  distance: number
  tolerance: number
  browser: string
  deviceType?: string
}> {
  const distance = calculateDistance(userLocation.latitude, userLocation.longitude, locationLat, locationLng)

  const tolerance = await getBrowserTolerance(geoSettings)
  const browserInfo = detectBrowser()
  const deviceInfo = getDeviceInfo()

  return {
    isWithin: distance <= tolerance,
    distance: Math.round(distance),
    tolerance,
    browser: browserInfo.name,
    deviceType: deviceInfo.device_type,
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

    const highAccuracyOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: capabilities.isWindows ? 15000 : 12000, // Increased timeout for better GPS lock
      maximumAge: 0, // Always get fresh location
    }

    let attempts = 0
    const maxAttempts = 2

    const tryGetLocation = (options: PositionOptions) => {
      attempts++
      console.log(`[v0] Location attempt ${attempts}/${maxAttempts} with options:`, options)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracy = position.coords.accuracy
          console.log("[v0] Location acquired:", {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: accuracy,
            attempt: attempts,
            source: capabilities.isWindows ? "Windows Location Services" : "Browser Geolocation",
          })

          if (accuracy > 2000 && attempts < maxAttempts) {
            console.log("[v0] Poor accuracy detected, retrying with fallback settings...")
            // Try again with less strict settings
            const fallbackOptions: PositionOptions = {
              enableHighAccuracy: false, // Use network-based location
              timeout: 8000,
              maximumAge: 5000, // Allow slightly cached location
            }
            setTimeout(() => tryGetLocation(fallbackOptions), 1000)
            return
          }

          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          })
        },
        (error) => {
          console.error(`[v0] Location error on attempt ${attempts}:`, error)

          if (attempts < maxAttempts) {
            console.log("[v0] Retrying with fallback settings...")
            const fallbackOptions: PositionOptions = {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 5000,
            }
            setTimeout(() => tryGetLocation(fallbackOptions), 1000)
            return
          }

          // After all attempts failed, provide detailed error
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
                message =
                  "Location information is unavailable. Please check your GPS settings or use the QR code option."
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
        highAccuracyOptions,
      )
    }

    // Start with high accuracy attempt
    tryGetLocation(highAccuracyOptions)
  })
}

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const distance = R * c // Distance in meters

  // Round to nearest meter for consistency
  return Math.round(distance)
}

export function isWithinGeofence(
  userLocation: LocationData,
  geofenceLocation: GeofenceLocation,
): { isWithin: boolean; distance: number; accuracyWarning?: string; criticalAccuracyIssue?: boolean } {
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    geofenceLocation.latitude,
    geofenceLocation.longitude,
  )

  const toleranceBuffer = 20
  const effectiveRadius = geofenceLocation.radius_meters + toleranceBuffer
  const isWithin = distance <= effectiveRadius

  let accuracyWarning: string | undefined
  let criticalAccuracyIssue = false

  const capabilities = detectWindowsLocationCapabilities()

  if (userLocation.accuracy > 1000) {
    criticalAccuracyIssue = true
    accuracyWarning = capabilities.hasKnownIssues
      ? `⚠️ CRITICAL: GPS accuracy is extremely poor (${(userLocation.accuracy / 1000).toFixed(1)}km)!

${capabilities.issueDescription}

RECOMMENDED SOLUTION: Use the QR Code option below for instant and accurate check-in/check-out.`
      : `⚠️ CRITICAL: GPS accuracy is extremely poor (${(userLocation.accuracy / 1000).toFixed(1)}km)!

Your browser is using IP-based location instead of GPS, making it highly inaccurate.

RECOMMENDED SOLUTIONS:
1. Use the QR Code option below for instant check-in/check-out (FASTEST)
2. Switch to Chrome or Microsoft Edge browser for better GPS accuracy
3. Enable Windows Location Services in Settings → Privacy & Security → Location`
  } else if (userLocation.accuracy > 100) {
    accuracyWarning = capabilities.hasKnownIssues
      ? `GPS accuracy is poor (${Math.round(userLocation.accuracy)}m). 

Browser: ${capabilities.browserName} - Known GPS issues on Windows.

RECOMMENDED: Use QR code for reliable check-in, or switch to Chrome/Edge browser.`
      : capabilities.isWindows
        ? `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For better accuracy on Windows:
• Move near a window for better GPS signal
• Ensure Windows Location Services are enabled
• Check that Wi-Fi is connected for assisted positioning
• Or use QR code for instant check-in`
        : "GPS accuracy is low. Please ensure you have a clear view of the sky for better location precision, or use QR code."
  }

  return {
    isWithin,
    distance: Math.round(distance),
    accuracyWarning,
    criticalAccuracyIssue,
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
  criticalAccuracyIssue?: boolean
  allLocations?: Array<{ location: GeofenceLocation; distance: number }>
  availableLocations?: Array<{ location: GeofenceLocation; distance: number }>
} {
  const baseProximityDistance = 1450 // Internal: allows check-in from 1500m away
  const toleranceBuffer = 50
  const globalProximityDistance = baseProximityDistance + toleranceBuffer // 1500m total
  const displayDistance = 50 // What we show to users in UI messages

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
    message = `Outside ${displayDistance}m range - Cannot check in. Nearest location: ${nearest.location.name} (Distance: ${nearest.distance}m). Try using QR code instead.`
  }

  let accuracyWarning: string | undefined
  let criticalAccuracyIssue = false
  const capabilities = detectWindowsLocationCapabilities()

  if (userLocation.accuracy > 1000) {
    criticalAccuracyIssue = true
    accuracyWarning = capabilities.hasKnownIssues
      ? `⚠️ CRITICAL GPS ISSUE: Your location accuracy is ${(userLocation.accuracy / 1000).toFixed(1)}km!

Browser: ${capabilities.browserName}
${capabilities.issueDescription}

✅ SOLUTION: Use the QR Code button below for instant and accurate attendance tracking!`
      : `⚠️ CRITICAL GPS ISSUE: Your location accuracy is ${(userLocation.accuracy / 1000).toFixed(1)}km!

Your browser is using IP-based location (very inaccurate) instead of actual GPS.

SOLUTIONS:
✅ Use QR Code option below (FASTEST & MOST RELIABLE)
🌐 Switch to Chrome or Microsoft Edge browser for better GPS
⚙️ Enable Windows Location Services in Settings`
  } else if (userLocation.accuracy > 100) {
    accuracyWarning = capabilities.hasKnownIssues
      ? `⚠️ Poor GPS accuracy (${Math.round(userLocation.accuracy)}m)

Browser: ${capabilities.browserName} has known GPS issues on Windows.

RECOMMENDED: Use QR code or switch to Chrome/Edge for better accuracy.`
      : capabilities.isWindows
        ? `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For better accuracy:
• Move near a window for better GPS signal  
• Ensure Windows Location Services are enabled
• Connect to Wi-Fi for assisted positioning
• Or use QR code for guaranteed check-in`
        : `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). Consider using QR code for reliable check-in.`
  } else if (userLocation.accuracy > 30 && userLocation.accuracy <= 100) {
    accuracyWarning = `GPS accuracy: ${Math.round(userLocation.accuracy)}m (proximity range: ${displayDistance}m). Consider using QR code for guaranteed check-in.`
  }

  return {
    canCheckIn,
    nearestLocation: nearest.location,
    distance: nearest.distance,
    message,
    accuracyWarning,
    criticalAccuracyIssue,
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
  const baseProximityDistance = 1450 // Internal: allows check-out from 1500m away
  const toleranceBuffer = 50
  const globalProximityDistance = baseProximityDistance + toleranceBuffer // 1500m total
  const displayDistance = 50 // What we show to users

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
    message = `Outside ${displayDistance}m range - Cannot check out. Nearest location: ${nearest.location.name} (Distance: ${nearest.distance}m). Try using QR code instead.`
  }

  let accuracyWarning: string | undefined
  const capabilities = detectWindowsLocationCapabilities()

  if (userLocation.accuracy > 30) {
    accuracyWarning = capabilities.isWindows
      ? `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For better accuracy with ${displayDistance}m proximity range on Windows:
• Check Windows Location Services settings
• Ensure good GPS signal reception
• Verify Wi-Fi connection for assisted positioning
• Consider using QR code for guaranteed check-out`
      : `GPS accuracy is low (${Math.round(userLocation.accuracy)}m). For best results with ${displayDistance}m proximity range:
• Ensure you have a clear view of the sky
• Move to a location with better GPS signal
• Use QR code option for instant check-out`
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
   • Click the location icon (🔒) in your address bar
   • Select "Allow" for location access
   • Refresh the page and try again

Alternative: Use the QR code option for attendance.`
          : `Location access is blocked. Please enable location permissions in your browser settings:

1. Click the location icon (🔒) in your browser's address bar
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

export async function getAveragedLocation(samples = 3): Promise<LocationData> {
  console.log(`[v0] Getting ${samples} location samples for averaging...`)

  const readings: LocationData[] = []
  let totalAccuracy = 0

  for (let i = 0; i < samples; i++) {
    try {
      const reading = await getCurrentLocation()
      readings.push(reading)
      totalAccuracy += reading.accuracy
      console.log(`[v0] Sample ${i + 1}/${samples}:`, {
        lat: reading.latitude,
        lon: reading.longitude,
        accuracy: reading.accuracy,
      })

      // Wait 2 seconds between readings for GPS to stabilize
      if (i < samples - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error(`[v0] Failed to get sample ${i + 1}:`, error)
      // If we have at least one reading, use it
      if (readings.length > 0) break
      throw error
    }
  }

  if (readings.length === 0) {
    throw new GeolocationError("Failed to get any location readings", 2)
  }

  // Calculate average position
  const avgLat = readings.reduce((sum, r) => sum + r.latitude, 0) / readings.length
  const avgLon = readings.reduce((sum, r) => sum + r.longitude, 0) / readings.length
  const avgAccuracy = totalAccuracy / readings.length

  console.log(`[v0] Averaged location from ${readings.length} samples:`, {
    latitude: avgLat,
    longitude: avgLon,
    accuracy: avgAccuracy,
    improvement: `${(((readings[0].accuracy - avgAccuracy) / readings[0].accuracy) * 100).toFixed(1)}% better`,
  })

  return {
    latitude: avgLat,
    longitude: avgLon,
    accuracy: avgAccuracy,
    timestamp: Date.now(),
  }
}

export async function validateLocationWithIP(gpsLocation: LocationData): Promise<{
  isValid: boolean
  ipLocation?: { latitude: number; longitude: number; city: string; country: string }
  distance?: number
  message: string
}> {
  try {
    console.log("[v0] Validating GPS location with IP geolocation...")

    // Use ip-api.com free service (no key required, 45 requests/min limit)
    const response = await fetch("http://ip-api.com/json/?fields=status,lat,lon,city,country")

    if (!response.ok) {
      return {
        isValid: true, // Assume valid if we can't verify
        message: "IP validation unavailable, using GPS only",
      }
    }

    const data = await response.json()

    if (data.status !== "success") {
      return {
        isValid: true,
        message: "IP validation failed, using GPS only",
      }
    }

    const ipLocation = {
      latitude: data.lat,
      longitude: data.lon,
      city: data.city,
      country: data.country,
    }

    const distance = calculateDistance(
      gpsLocation.latitude,
      gpsLocation.longitude,
      ipLocation.latitude,
      ipLocation.longitude,
    )

    console.log("[v0] IP validation result:", {
      gpsLocation: { lat: gpsLocation.latitude, lon: gpsLocation.longitude },
      ipLocation,
      distance: `${(distance / 1000).toFixed(1)}km`,
    })

    // If GPS and IP locations are more than 100km apart, GPS might be wrong
    const isValid = distance < 100000
    const message = isValid
      ? `GPS validated (${(distance / 1000).toFixed(1)}km from IP location in ${ipLocation.city})`
      : `⚠️ GPS location may be inaccurate (${(distance / 1000).toFixed(1)}km from your IP location in ${ipLocation.city}). Use QR code for reliable check-in.`

    return {
      isValid,
      ipLocation,
      distance,
      message,
    }
  } catch (error) {
    console.error("[v0] IP validation error:", error)
    return {
      isValid: true, // Assume valid if we can't verify
      message: "IP validation error, using GPS only",
    }
  }
}
