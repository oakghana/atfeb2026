import { useEffect, useState, useRef, useCallback } from "react"

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface UseGeoLocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  cacheExpiryMs?: number
}

// Global cache for geolocation data
const locationCache = {
  data: null as LocationData | null,
  timestamp: 0,
  expiry: 30000, // 30 seconds default
}

export function useOptimizedGeolocation(options: UseGeoLocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 30000,
    cacheExpiryMs = 30000,
  } = options

  const [location, setLocation] = useState<LocationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const requestInProgressRef = useRef(false)
  const watchIdRef = useRef<number | null>(null)

  const getCurrentLocationCached = useCallback(async (): Promise<LocationData | null> => {
    // Return cached data if still valid
    const now = Date.now()
    if (
      locationCache.data &&
      now - locationCache.timestamp < cacheExpiryMs
    ) {
      console.log("[v0] Using cached geolocation data")
      return locationCache.data
    }

    // Prevent duplicate requests
    if (requestInProgressRef.current) {
      console.log("[v0] Geolocation request already in progress")
      return null
    }

    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setError("Geolocation not supported")
        resolve(null)
        return
      }

      requestInProgressRef.current = true
      setIsLoading(true)

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          }

          // Update cache
          locationCache.data = locationData
          locationCache.timestamp = now

          setLocation(locationData)
          setError(null)
          requestInProgressRef.current = false
          setIsLoading(false)
          resolve(locationData)
          console.log("[v0] Geolocation updated:", locationData)
        },
        (positionError) => {
          const errorMsg = `Geolocation error: ${positionError.message}`
          setError(errorMsg)
          requestInProgressRef.current = false
          setIsLoading(false)
          resolve(null)
          console.warn("[v0]", errorMsg)
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge,
        }
      )
    })
  }, [enableHighAccuracy, timeout, maximumAge, cacheExpiryMs])

  // Request location on mount
  useEffect(() => {
    getCurrentLocationCached()

    // Cleanup
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      requestInProgressRef.current = false
    }
  }, [getCurrentLocationCached])

  return {
    location,
    error,
    isLoading,
    refetch: getCurrentLocationCached,
  }
}
