export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp?: number
}

// Cache location for stable validation (reduces GPS fluctuation issues)
let cachedLocation: LocationData | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 30000 // 30 seconds cache

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

export interface BrowserToleranceSettings {
  chrome: number
  edge: number
  firefox: number
  safari: number
  opera: number
  default: number
  mobile: number // New: tolerance for mobile/tablet devices
}

export interface GeoSettings {
  browserTolerances?: BrowserToleranceSettings
  enableBrowserSpecificTolerance?: boolean
  globalProximityDistance?: number
  checkInProximityRange?: number
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
  const browserInfo = detectBrowser()
  const deviceInfo = detectDevice()

  if (deviceInfo.isMobile || deviceInfo.isTablet) {
    return 100
  }

  // Updated Chrome, Firefox, Safari, and Opera to 2000 meters tolerance
  // This is a trade secret and should not be displayed in the UI
  switch (browserInfo.name.toLowerCase()) {
    case "chrome":
      return 2000 // Increased tolerance for PC Chrome users
    case "edge":
      return 200 // Moderate tolerance for PC Edge users
    case "firefox":
      return 2000 // Increased tolerance for PC Firefox users
    case "safari":
      return 2000 // Increased tolerance for PC Safari users
    case "opera":
      return 2000 // Increased tolerance for PC Opera users
    default:
      return 2000 // Default desktop tolerance
  }
}

function detectDevice(): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } {
  const ua = navigator.userAgent.toLowerCase()
  const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua)
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(ua)
  const isDesktop = !isMobile && !isTablet

  return { isMobile, isTablet, isDesktop }
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
}> {
  const distance = calculateDistance(userLocation.latitude, userLocation.longitude, locationLat, locationLng)

  const tolerance = await getBrowserTolerance(geoSettings)
  const browserInfo = detectBrowser()

  return {
    isWithin: distance <= tolerance,
    distance: Math.round(distance),
    tolerance,
    browser: browserInfo.name,
  }
}

export async function getCurrentLocation(useCache = false): Promise<LocationData> {
  // Return cached location if available and fresh
  if (useCache && cachedLocation && Date.now() - cacheTimestamp < CACHE_DURATION) {
    console.log("[v0] Using cached location:", cachedLocation)
    return cachedLocation
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"))
      return
    }

    const capabilities = detectWindowsLocationCapabilities()
    console.log("[v0] Windows location capabilities:", capabilities)

    const highAccuracyOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: capabilities.isWindows ? 20000 : 15000, // Longer timeout for better GPS lock
      maximumAge: 0, // Always get fresh location, never use cached
    }

    let attempts = 0
    const maxAttempts = 3 // More attempts for better accuracy
    let bestPosition: GeolocationPosition | null = null

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

          // Keep track of best position
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position
          }

          // If accuracy is still poor and we have attempts left, try again
          if (accuracy > 1000 && attempts < maxAttempts) {
            console.log("[v0] Poor accuracy detected, retrying with different settings...")
            // Alternate between high accuracy and network-based
            const retryOptions: PositionOptions = attempts % 2 === 0 
              ? {
                  enableHighAccuracy: true,
                  timeout: 20000,
                  maximumAge: 0,
                }
              : {
                  enableHighAccuracy: false, // Use network-based location
                  timeout: 10000,
                  maximumAge: 3000,
                }
            setTimeout(() => tryGetLocation(retryOptions), 1500)
            return
          }

          // Use best position we got
          const finalPosition = bestPosition || position
          console.log("[v0] Using final position with accuracy:", finalPosition.coords.accuracy)

          const locationData: LocationData = {
            latitude: finalPosition.coords.latitude,
            longitude: finalPosition.coords.longitude,
            accuracy: finalPosition.coords.accuracy,
            timestamp: Date.now(),
          }

          // Cache the location for stable validation
          cachedLocation = locationData
          cacheTimestamp = Date.now()

          resolve(locationData)
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
          reject(new Error(fullMessage))
        },
        options,
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
  deviceRadiusCheckIn?: number, // From database settings
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
  const deviceInfo = detectDevice()
  // Use database-configured device radius if provided, otherwise use defaults
  // Default: mobile/tablet 400m, laptop 700m, desktop 2000m
  let deviceProximityBase = deviceRadiusCheckIn
  if (!deviceProximityBase) {
    if (deviceInfo.isMobile || deviceInfo.isTablet) {
      deviceProximityBase = 400
    } else if (deviceInfo.isLaptop) {
      deviceProximityBase = 700
    } else {
      deviceProximityBase = 2000 // Desktop PC
    }
  }
  const displayDistance = 100 // What we show to users in UI messages (standard requirement)

  console.log("[v0] Check-in validation - Device Detection:", {
    deviceType: deviceInfo.device_type,
    deviceName: deviceInfo.device_name,
    isMobile: deviceInfo.isMobile,
    isTablet: deviceInfo.isTablet,
    isLaptop: deviceInfo.isLaptop,
    isDesktop: deviceInfo.isDesktop,
    deviceProximityBase: deviceProximityBase,
    userAgent: deviceInfo.browser_info
  })

  const nearest = findNearestLocation(userLocation, qccLocations)

  if (!nearest) {
    return {
      canCheckIn: false,
      message: "No QCC locations found in the system.",
    }
  }

  // Calculate distances using device-specific radius (overrides location radius)
  const allLocationsWithDistance = qccLocations
    .map((location) => {
      const distance = Math.round(
        calculateDistance(userLocation.latitude, userLocation.longitude, location.latitude, location.longitude),
      )
      // Use device-specific radius (location radius is ignored)
      const withinRange = distance <= deviceProximityBase
      return {
        location,
        distance,
        effectiveRadius: deviceProximityBase,
        withinRange
      }
    })
    .sort((a, b) => a.distance - b.distance)

  const availableLocations = allLocationsWithDistance.filter(({ withinRange }) => withinRange)

  console.log("[v0] Check-in validation - Locations:", {
    nearestLocation: allLocationsWithDistance[0]?.location.name,
    nearestDistance: allLocationsWithDistance[0]?.distance,
    proximityRadius: deviceProximityBase, // Changed from internalProximityDistance to deviceProximityBase
    availableLocationsCount: availableLocations.length,
    allLocations: allLocationsWithDistance.map(l => `${l.location.name}: ${l.distance}m`)
  })

  const canCheckIn = availableLocations.length > 0

  let message: string

  if (canCheckIn) {
    message = `You can check in at ${nearest.location.name}`
  } else {
    const nearestDistanceKm = (nearest.distance / 1000).toFixed(1)
    message = `You are too far from ${nearest.location.name}. You must be within ${displayDistance} meters of a QCC location to check in.`
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
  deviceRadiusCheckOut?: number, // From database settings
): {
  canCheckOut: boolean
  nearestLocation?: GeofenceLocation
  distance?: number
  message: string
  accuracyWarning?: string
} {
  const deviceInfo = detectDevice()
  // Use database-configured device radius if provided, otherwise use defaults
  // Default: mobile/tablet 400m, laptop 700m, desktop 1000m
  let deviceProximityBase = deviceRadiusCheckOut
  if (!deviceProximityBase) {
    if (deviceInfo.isMobile || deviceInfo.isTablet) {
      deviceProximityBase = 400
    } else if (deviceInfo.isLaptop) {
      deviceProximityBase = 700
    } else {
      deviceProximityBase = 1000 // Desktop PC
    }
  }
  const displayDistance = 100 // What we show to users in UI messages (standard requirement, regardless of device)


  const nearest = findNearestLocation(userLocation, qccLocations)

  if (!nearest) {
    return {
      canCheckOut: false,
      message: "No QCC locations found in the system.",
    }
  }

  // Use device-specific radius (location radius is ignored)
  const baseProximity = deviceProximityBase

  // More lenient validation: if accuracy is poor but distance is reasonable, still allow
  const effectiveProximity = userLocation.accuracy > 1000 
    ? baseProximity + userLocation.accuracy * 0.5 // Add 50% of accuracy as buffer
    : baseProximity

  console.log("[v0] Check-out validation:", {
    location: nearest.location.name,
    distance: nearest.distance,
    deviceProximityBase,
    baseProximity,
    effectiveProximity,
    userAccuracy: userLocation.accuracy,
  })

  const canCheckOut = nearest.distance <= effectiveProximity

  let message: string

  if (canCheckOut) {
    message = `You can check out at ${nearest.location.name}`
  } else {
    message = `You must be within ${displayDistance} meters of a QCC location to check out`
  }

  let accuracyWarning: string | undefined
  const capabilities = detectWindowsLocationCapabilities()

  if (userLocation.accuracy > 100) {
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
  onError: (error: Error) => void,
): number | null {
  if (!navigator.geolocation) {
    onError(new Error("Geolocation is not supported by this browser"))
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
      onError(new Error(message))
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
    throw new Error("Failed to get any location readings")
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

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    // Use Nominatim (OpenStreetMap) for reverse geocoding - free and no API key required
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          "User-Agent": "QCC-Attendance-App",
        },
      },
    )

    if (!response.ok) {
      throw new Error("Reverse geocoding failed")
    }

    const data = await response.json()

    // Extract meaningful location name
    const address = data.address || {}
    const locationParts = []

    if (address.building || address.office) {
      locationParts.push(address.building || address.office)
    }
    if (address.road || address.street) {
      locationParts.push(address.road || address.street)
    }
    if (address.suburb || address.neighbourhood) {
      locationParts.push(address.suburb || address.neighbourhood)
    }
    if (address.city || address.town || address.village) {
      locationParts.push(address.city || address.town || address.village)
    }

    const locationName =
      locationParts.length > 0
        ? locationParts.slice(0, 3).join(", ")
        : data.display_name?.split(",").slice(0, 3).join(",") || "Unknown Location"

    console.log("[v0] Reverse geocoded location:", locationName)
    return locationName
  } catch (error) {
    console.error("[v0] Reverse geocoding error:", error)
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
  }
}
