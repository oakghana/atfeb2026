"use client"

import type { LocationData } from "@/lib/geolocation"

// Global cache for location requests to avoid duplicate API calls
const locationRequestCache = new Map<string, Promise<LocationData>>()
const locationResultCache = new Map<string, { data: LocationData; timestamp: number }>()

const LOCATION_CACHE_TTL = 5000 // 5 seconds
const MAX_CONCURRENT_REQUESTS = 1

export async function getFastLocation(timeout = 8000): Promise<LocationData> {
  const cacheKey = "current_location"

  // Check if we have a cached result that's still valid
  const cached = locationResultCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < LOCATION_CACHE_TTL) {
    return cached.data
  }

  // Check if a request is already in flight
  const inFlight = locationRequestCache.get(cacheKey)
  if (inFlight) {
    try {
      return await inFlight
    } catch (error) {
      locationRequestCache.delete(cacheKey)
      throw error
    }
  }

  // Create a new location request
  const promise = getLocationInternal(timeout)
  locationRequestCache.set(cacheKey, promise)

  try {
    const result = await promise
    locationResultCache.set(cacheKey, { data: result, timestamp: Date.now() })
    return result
  } finally {
    locationRequestCache.delete(cacheKey)
  }
}

async function getLocationInternal(timeout: number): Promise<LocationData> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not available"))
      return
    }

    const timeoutId = setTimeout(() => {
      reject(new Error("Location request timed out"))
    }, timeout)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId)
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
          speed: position.coords.speed,
          heading: position.coords.heading,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
        })
      },
      (error) => {
        clearTimeout(timeoutId)
        reject(error)
      },
      {
        enableHighAccuracy: false, // Disable high accuracy for faster response
        timeout: timeout,
        maximumAge: 3000, // Use cached position if available and not older than 3 seconds
      }
    )
  })
}

// Clear caches for fresh location on demand
export function clearLocationCache() {
  locationResultCache.clear()
  locationRequestCache.clear()
}
