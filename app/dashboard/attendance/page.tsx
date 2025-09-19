import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { AttendanceRecorder } from "@/components/attendance/attendance-recorder"
import { PersonalAttendanceHistory } from "@/components/attendance/personal-attendance-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/server"
import { Clock, History } from "lucide-react"

export default async function AttendancePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Get today's attendance with enhanced location tracking
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
    .single()

  const enhancedAttendance = todayAttendance
    ? {
        ...todayAttendance,
        check_in_location_name: todayAttendance.geofence_locations?.name || todayAttendance.check_in_location_name,
        check_out_location_name: todayAttendance.checkout_location?.name || todayAttendance.check_out_location_name,
      }
    : null

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-3">
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
        </div>

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
            <AttendanceRecorder todayAttendance={enhancedAttendance} />
          </TabsContent>

          <TabsContent value="history" className="space-y-6 mt-8">
            <PersonalAttendanceHistory />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
