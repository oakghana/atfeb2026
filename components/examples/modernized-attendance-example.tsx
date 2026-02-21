// Example: How to integrate the modernized attendance flow into your existing page

import "use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { ModernizedAttendanceFlow } from "@/components/attendance/modernized-attendance-flow"
import { Skeleton } from "@/components/ui/skeleton"

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time: string | null
  check_in_location_id: string
  user_id: string
}

interface LocationInfo {
  name: string
  address: string
}

export function ModernizedAttendanceExample() {
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)

  // Attendance state
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null)
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null)
  const [userDepartment, setUserDepartment] = useState<{
    code: string | null
    name: string | null
  } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [predictedCheckoutTime, setPredictedCheckoutTime] = useState<string | null>(null)

  // Load today's attendance record on mount
  useEffect(() => {
    loadTodayAttendance()
  }, [])

  const loadTodayAttendance = async () => {
    try {
      setLoading(true)

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        })
        return
      }

      // Get today's attendance record
      const today = new Date().toISOString().split("T")[0]
      const { data: attendance, error: attendanceError } = await supabase
        .from("attendance_records")
        .select(
          `
          id,
          check_in_time,
          check_out_time,
          check_in_location_id,
          user_id,
          geofence_locations!check_in_location_id (
            name,
            address
          )
        `
        )
        .eq("user_id", user.id)
        .gte("check_in_time", `${today}T00:00:00`)
        .lt("check_in_time", `${today}T23:59:59`)
        .maybeSingle()

      if (attendanceError) {
        throw attendanceError
      }

      if (attendance) {
        setTodayAttendance(attendance)

        // Set location info if available
        if (attendance.geofence_locations) {
          setLocationInfo(attendance.geofence_locations as LocationInfo)
        }

        // Calculate predicted checkout time (check-in time + 120 minutes)
        const checkInTime = new Date(attendance.check_in_time)
        const predicted = new Date(checkInTime.getTime() + 120 * 60 * 1000)
        setPredictedCheckoutTime(predicted.toISOString())
      }

      // Get user profile for department and role
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("department_id, role, departments!inner(code, name)")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("Error loading user profile:", profileError)
      } else if (profile) {
        if (profile.departments) {
          setUserDepartment({
            code: profile.departments.code,
            name: profile.departments.name,
          })
        }
        setUserRole(profile.role)
      }
    } catch (error) {
      console.error("Error loading attendance:", error)
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCheckIn = useCallback(async () => {
    try {
      setCheckingIn(true)

      // Call your check-in API
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: null, // Would get from geolocation
          longitude: null,
          location_id: null,
          device_info: {
            userAgent: navigator.userAgent,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Check-in failed")
      }

      const data = await response.json()

      toast({
        title: "Success",
        description: "Checked in successfully",
      })

      // Reload attendance data
      await loadTodayAttendance()
    } catch (error) {
      console.error("Check-in error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to check in",
        variant: "destructive",
      })
    } finally {
      setCheckingIn(false)
    }
  }, [toast])

  const handleCheckOut = useCallback(async () => {
    try {
      setCheckingOut(true)

      // Call your check-out API
      const response = await fetch("/api/attendance/check-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          latitude: null, // Would get from geolocation
          longitude: null,
          location_id: todayAttendance?.check_in_location_id,
          qr_code_used: false,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Check-out failed")
      }

      toast({
        title: "Success",
        description: "Checked out successfully",
      })

      // Reload attendance data
      await loadTodayAttendance()
    } catch (error) {
      console.error("Check-out error:", error)
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to check out",
        variant: "destructive",
      })
    } finally {
      setCheckingOut(false)
    }
  }, [todayAttendance?.check_in_location_id, toast])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <ModernizedAttendanceFlow
      checkInTime={todayAttendance?.check_in_time}
      checkOutTime={todayAttendance?.check_out_time}
      checkInLocation={locationInfo?.name}
      minimumWorkMinutes={120}
      userDepartment={userDepartment}
      userRole={userRole}
      isCheckingIn={checkingIn}
      isCheckingOut={checkingOut}
      onCheckIn={handleCheckIn}
      onCheckOut={handleCheckOut}
      canCheckOut={true}
      isOffPremises={false}
      predictedCheckoutTime={predictedCheckoutTime}
    />
  )
}

// Usage in a page:
// import { ModernizedAttendanceExample } from '@/components/examples/modernized-attendance'
//
// export default function AttendancePage() {
//   return (
//     <div className="container py-6">
//       <h1 className="text-3xl font-bold mb-6">Daily Attendance</h1>
//       <ModernizedAttendanceExample />
//     </div>
//   )
// }
