"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface Location {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
  district_id?: string
  is_active: boolean
}

export function useRealTimeLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const supabase = createClient()

  const fetchLocations = useCallback(async () => {
    try {
      console.log("[v0] Real-time locations - Fetching locations")
      const response = await fetch("/api/attendance/locations")
      const result = await response.json()

      if (result.success) {
        console.log("[v0] Real-time locations - Fetched", result.data?.length, "locations")
        setLocations(result.data || [])
        setError(null)
      } else {
        console.error("[v0] Real-time locations - Fetch error:", result.error)
        setError(result.error || "Failed to fetch locations")
      }
    } catch (err) {
      console.error("[v0] Real-time locations - Exception:", err)
      setError("Failed to fetch locations")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch
    fetchLocations()

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "LOCATION_UPDATE") {
        console.log("[v0] Real-time locations - Service worker update received")
        setLocations(event.data.data || [])
      }
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage)
    }

    // Set up real-time subscription for location changes
    const channel = supabase
      .channel("locations_realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "geofence_locations",
        },
        (payload) => {
          console.log(
            "[v0] Real-time locations - Change detected:",
            payload.eventType,
            payload.new?.name || payload.old?.name,
          )

          // Refetch locations when any change occurs
          fetchLocations()

          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready
              .then((registration) => {
                return registration.sync.register("location-sync")
              })
              .catch((error) => {
                console.error("[v0] Failed to register location sync:", error)
              })
          }
        },
      )
      .subscribe((status) => {
        console.log("[v0] Real-time locations - Subscription status:", status)
        setIsConnected(status === "SUBSCRIBED")
      })

    return () => {
      console.log("[v0] Real-time locations - Cleaning up subscription")
      supabase.removeChannel(channel)

      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage)
      }
    }
  }, [fetchLocations, supabase])

  return {
    locations,
    loading,
    error,
    isConnected,
    refetch: fetchLocations,
  }
}
