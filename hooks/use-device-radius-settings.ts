'use client';

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface DeviceRadiusSettings {
  mobile: { checkIn: number; checkOut: number }
  tablet: { checkIn: number; checkOut: number }
  laptop: { checkIn: number; checkOut: number }
  desktop: { checkIn: number; checkOut: number }
}

const DEFAULT_SETTINGS: DeviceRadiusSettings = {
  mobile: { checkIn: 400, checkOut: 400 },
  tablet: { checkIn: 400, checkOut: 400 },
  laptop: { checkIn: 700, checkOut: 700 },
  desktop: { checkIn: 2000, checkOut: 1000 },
}

export function useDeviceRadiusSettings() {
  const [settings, setSettings] = useState<DeviceRadiusSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("device_radius_settings")
          .select("device_type, check_in_radius_meters, check_out_radius_meters")
          .eq("is_active", true)

        if (error) {
          console.error("[v0] Error fetching device radius settings:", error)
          setSettings(DEFAULT_SETTINGS)
          return
        }

        if (data) {
          const newSettings: DeviceRadiusSettings = {
            mobile: { checkIn: 400, checkOut: 400 },
            tablet: { checkIn: 400, checkOut: 400 },
            laptop: { checkIn: 700, checkOut: 700 },
            desktop: { checkIn: 2000, checkOut: 1000 },
          }

          for (const item of data) {
            if (item.device_type === "mobile") {
              newSettings.mobile = {
                checkIn: item.check_in_radius_meters,
                checkOut: item.check_out_radius_meters,
              }
            } else if (item.device_type === "tablet") {
              newSettings.tablet = {
                checkIn: item.check_in_radius_meters,
                checkOut: item.check_out_radius_meters,
              }
            } else if (item.device_type === "laptop") {
              newSettings.laptop = {
                checkIn: item.check_in_radius_meters,
                checkOut: item.check_out_radius_meters,
              }
            } else if (item.device_type === "desktop") {
              newSettings.desktop = {
                checkIn: item.check_in_radius_meters,
                checkOut: item.check_out_radius_meters,
              }
            }
          }

          setSettings(newSettings)
          console.log("[v0] Device radius settings loaded:", newSettings)
        }
      } catch (error) {
        console.error("[v0] Error loading device radius settings:", error)
        setSettings(DEFAULT_SETTINGS)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  return { settings, loading }
}
