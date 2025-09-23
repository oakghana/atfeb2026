export interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}

export interface GeofenceLocation {
  id: string
  name: string
  latitude: number
  longitude: number
  radius_meters: number
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

export async function getCurrentLocation(): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeolocationError("Geolocation is not supported by this browser", 0))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        let message = "Unknown error occurred"
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message =
              "Location access denied. Please enable location permissions in your browser settings and try again, or use the QR code option instead."
            break
          case error.POSITION_UNAVAILABLE:
            message = "Location information is unavailable. Please check your GPS settings or use the QR code option."
            break
          case error.TIMEOUT:
            message = "Location request timed out. Please try again or use the QR code option."
            break
        }
        reject(new GeolocationError(message, error.code))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, // Increased timeout from 10s to 15s
        maximumAge: 60000,
      },
    )
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

  // Enhanced validation for 20-meter precision
  const isWithin = distance <= geofenceLocation.radius_meters
  let accuracyWarning: string | undefined

  // Warn if GPS accuracy is poor for 20-meter geofencing
  if (userLocation.accuracy > 10) {
    accuracyWarning =
      "GPS accuracy is low. Please ensure you have a clear view of the sky for better location precision."
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
): {
  canCheckIn: boolean
  nearestLocation?: GeofenceLocation
  distance?: number
  message: string
  accuracyWarning?: string
} {
  const nearest = findNearestLocation(userLocation, qccLocations)

  if (!nearest) {
    return {
      canCheckIn: false,
      message: "No QCC locations found in the system.",
    }
  }

  const validation = isWithinGeofence(userLocation, nearest.location)

  if (validation.isWithin) {
    return {
      canCheckIn: true,
      nearestLocation: nearest.location,
      distance: validation.distance,
      message: `You are within ${nearest.location.name} (${validation.distance}m away). You can check in.`,
      accuracyWarning: validation.accuracyWarning,
    }
  } else {
    return {
      canCheckIn: false,
      nearestLocation: nearest.location,
      distance: validation.distance,
      message: `You are ${validation.distance}m away from ${nearest.location.name}. You must be within 20 meters to check in.`,
      accuracyWarning: validation.accuracyWarning,
    }
  }
}

export function validateCheckoutLocation(
  userLocation: LocationData,
  qccLocations: GeofenceLocation[],
): {
  canCheckOut: boolean
  nearestLocation?: GeofenceLocation
  distance?: number
  message: string
  accuracyWarning?: string
} {
  const nearest = findNearestLocation(userLocation, qccLocations)

  if (!nearest) {
    return {
      canCheckOut: false,
      message: "No QCC locations found in the system.",
    }
  }

  return {
    canCheckOut: true,
    nearestLocation: nearest.location,
    distance: nearest.distance,
    message: `Check-out allowed from any location. Nearest QCC location: ${nearest.location.name} (${nearest.distance}m away)`,
    accuracyWarning:
      userLocation.accuracy > 10 ? "GPS accuracy is low, but check-out is still allowed from any location." : undefined,
  }
}

export async function requestLocationPermission(): Promise<{ granted: boolean; message: string }> {
  if (!navigator.geolocation) {
    return {
      granted: false,
      message: "Geolocation is not supported by this browser. Please use the QR code option instead.",
    }
  }

  try {
    // Check if permissions API is available
    if ("permissions" in navigator) {
      const permission = await navigator.permissions.query({ name: "geolocation" })

      if (permission.state === "granted") {
        return { granted: true, message: "Location permission already granted" }
      } else if (permission.state === "denied") {
        return {
          granted: false,
          message:
            "Location access is blocked. Please enable location permissions in your browser settings:\n\n1. Click the location icon in your address bar\n2. Select 'Allow' for location access\n3. Refresh the page and try again\n\nAlternatively, use the QR code option for attendance.",
        }
      }
    }

    // Try to get location to trigger permission request
    await getCurrentLocation()
    return { granted: true, message: "Location permission granted successfully" }
  } catch (error) {
    if (error instanceof GeolocationError && error.code === 1) {
      return {
        granted: false,
        message:
          "Location access denied. To enable:\n\n1. Click the location icon (🔒) in your browser's address bar\n2. Select 'Allow' for location access\n3. Refresh the page and try again\n\nOr use the QR code option for attendance tracking.",
      }
    }
    return {
      granted: false,
      message: error instanceof Error ? error.message : "Failed to access location. Please use the QR code option.",
    }
  }
}
