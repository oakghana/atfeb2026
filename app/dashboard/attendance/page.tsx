import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { AttendanceRecorder } from "@/components/attendance/attendance-recorder"
import { PersonalAttendanceHistory } from "@/components/attendance/personal-attendance-history"
import { LocationPreviewCard } from "@/components/attendance/location-preview-card"
import { LeaveStatusCard } from "@/components/leave/leave-status-card"
import { StaffStatusBadge } from "@/components/attendance/staff-status-badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/server"
import { Clock, History } from "lucide-react"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Attendance | QCC Electronic Attendance",
  description: "Record your daily attendance and view your history at QCC locations",
}

export default async function AttendancePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const today = new Date().toISOString().split("T")[0]
  const { data: todayAttendance } = await supabase
    .from("attendance_records")
    .select(`
      *,
      geofence_locations!check_in_location_id (
        name
      ),
      checkout_location:geofence_locations!check_out_location_id (
        name
      )
    `)
    .eq("user_id", user.id)
    .gte("check_in_time", `${today}T00:00:00`)
    .lt("check_in_time", `${today}T23:59:59`)
    .maybeSingle()

  const enhancedAttendance = todayAttendance
    ? {
        ...todayAttendance,
        check_in_location_name: todayAttendance.geofence_locations?.name || todayAttendance.check_in_location_name,
        check_out_location_name: todayAttendance.checkout_location?.name || todayAttendance.check_out_location_name,
      }
    : null

  // Fetch user profile with leave status
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("assigned_location_id, leave_status, leave_start_date, leave_end_date, leave_reason, first_name, last_name")
    .eq("id", user.id)
    .single()

  // Fetch all locations and assigned location details
  const { data: locations } = await supabase
    .from("geofence_locations")
    .select("*")
    .eq("is_active", true)
    .order("name")

  const assignedLocation = locations?.find((loc) => loc.id === userProfile?.assigned_location_id) || null

  // Determine if staff is currently on leave
  const isOnLeave = userProfile?.leave_status === "active"
  const isCheckedIn = !!enhancedAttendance && !enhancedAttendance.check_out_time

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">Attendance</h1>
                <p className="text-lg text-muted-foreground font-medium mt-1">
                  Record your daily attendance and view your history at QCC locations
                </p>
              </div>
            </div>
            <StaffStatusBadge
              isCheckedIn={isCheckedIn}
              isOnLeave={isOnLeave}
              leaveStatus={userProfile?.leave_status as "active" | "pending" | "approved" | "rejected" | null}
            />
          </div>
        </div>

        {/* Leave Status Card - Shows if user is on leave */}
        {userProfile?.leave_status && (
          <LeaveStatusCard
            leaveStatus={userProfile.leave_status as "active" | "pending" | "approved" | "rejected" | null}
            leaveStartDate={userProfile.leave_start_date}
            leaveEndDate={userProfile.leave_end_date}
            leaveReason={userProfile.leave_reason}
            onRequestLeave={() => {}} // This will be handled in the client component
          />
        )}

        <Tabs defaultValue="today" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl">
            <TabsTrigger
              value="today"
              className="flex items-center gap-2 font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
            >
              <Clock className="h-4 w-4" />
              Today's Attendance
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex items-center gap-2 font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg"
            >
              <History className="h-4 w-4" />
              Attendance History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-6 mt-8">
            <LocationPreviewCard assignedLocation={assignedLocation} locations={locations || []} />
            <AttendanceRecorder todayAttendance={enhancedAttendance} userLeaveStatus={userProfile?.leave_status} />
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-8">
            <PersonalAttendanceHistory />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
