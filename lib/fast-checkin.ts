"use client"

import { createClient } from "@/lib/supabase/client"

interface FastCheckInParams {
  location_id: string
  latitude: number
  longitude: number
  accuracy: number
  device_info: any
  location_name?: string
  is_remote_location?: boolean
}

interface CheckInResult {
  success: boolean
  message: string
  data?: any
  error?: string
}

// Request batching for concurrent check-ins (prevents race conditions)
let isCheckInInProgress = false
const checkInQueue: Array<{
  params: FastCheckInParams
  resolve: (result: CheckInResult) => void
  reject: (error: Error) => void
}> = []

async function processCheckInQueue() {
  if (isCheckInInProgress || checkInQueue.length === 0) return

  isCheckInInProgress = true
  const current = checkInQueue.shift()

  if (!current) {
    isCheckInInProgress = false
    return
  }

  try {
    const result = await performCheckIn(current.params)
    current.resolve(result)
  } catch (error) {
    current.reject(error as Error)
  } finally {
    isCheckInInProgress = false
    // Process next in queue
    if (checkInQueue.length > 0) {
      processCheckInQueue()
    }
  }
}

async function performCheckIn(params: FastCheckInParams): Promise<CheckInResult> {
  try {
    // Use a fast endpoint that doesn't require location validation
    const response = await fetch("/api/attendance/fast-check-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        message: errorData.message || "Check-in failed",
        error: errorData.error,
      }
    }

    const data = await response.json()
    return {
      success: true,
      message: "Checked in successfully",
      data,
    }
  } catch (error) {
    return {
      success: false,
      message: "Network error during check-in",
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

export async function fastCheckIn(params: FastCheckInParams): Promise<CheckInResult> {
  return new Promise((resolve, reject) => {
    checkInQueue.push({ params, resolve, reject })
    processCheckInQueue()
  })
}

// Optimized query to get today's attendance without extra fields
export async function getTodayAttendanceOptimized(userId: string) {
  const supabase = createClient()

  const today = new Date().toISOString().split("T")[0]

  try {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, check_in_time, check_out_time, check_in_location_name, check_out_location_name")
      .eq("user_id", userId)
      .gte("check_in_time", `${today}T00:00:00`)
      .lt("check_in_time", `${today}T23:59:59`)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows found" which is fine
      throw error
    }

    return data
  } catch (error) {
    console.error("[v0] Error fetching today's attendance:", error)
    return null
  }
}

// Prefetch nearby locations to speed up location validation
export async function prefetchNearbyLocations(latitude: number, longitude: number, radiusKm = 2) {
  const supabase = createClient()

  try {
    // Simple bounding box query (faster than distance calculation)
    const latDelta = radiusKm / 111 // 1 degree ~ 111 km
    const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180))

    const { data } = await supabase
      .from("geofence_locations")
      .select("id, name, latitude, longitude, radius_meters")
      .eq("is_active", true)
      .gte("latitude", latitude - latDelta)
      .lte("latitude", latitude + latDelta)
      .gte("longitude", longitude - lonDelta)
      .lte("longitude", longitude + lonDelta)

    return data || []
  } catch (error) {
    console.error("[v0] Error prefetching locations:", error)
    return []
  }
}
