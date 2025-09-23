import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { StatsCard } from "@/components/dashboard/stats-card"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/server"
import { Clock, Calendar, MapPin, Users, TrendingUp, UserCheck, AlertCircle, Activity } from "lucide-react"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get user profile with error handling
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select(`
      *,
      departments (
        name,
        code
      )
    `)
    .eq("id", user.id)
    .maybeSingle() // Use maybeSingle instead of single to handle missing records

  // If no profile exists, show a message to contact admin
  if (!profile && !profileError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-lg shadow-lg border-0 bg-gradient-to-br from-card to-card/50">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-heading font-bold text-primary">Profile Setup Required</CardTitle>
              <CardDescription className="text-base">
                Your account needs to be set up by an administrator.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <p className="text-sm font-medium text-muted-foreground">Account Details</p>
                <p className="text-sm font-mono bg-background/50 px-3 py-2 rounded border">User ID: {user.id}</p>
                <p className="text-sm font-mono bg-background/50 px-3 py-2 rounded border">
                  Email: {user.email?.split("@")[0]}
                </p>
              </div>
              <p className="text-sm leading-relaxed">
                Please contact your IT administrator to complete your profile setup and gain access to the attendance
                system.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    )
  }

  let pendingApprovals = 0
  if (profile?.role === "admin") {
    const { count } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false)

    pendingApprovals = count || 0
  }

  // Get today's attendance with error handling
  const today = new Date().toISOString().split("T")[0]
  const { data: todayAttendance, error: attendanceError } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", user.id)
    .gte("check_in_time", `${today}T00:00:00`)
    .lt("check_in_time", `${today}T23:59:59`)
    .maybeSingle()

  // Get this month's attendance count with error handling
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { count: monthlyAttendance, error: monthlyError } = await supabase
    .from("attendance_records")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("check_in_time", startOfMonth)

  // Get total locations with error handling
  const { count: totalLocations, error: locationsError } = await supabase
    .from("geofence_locations")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-lg text-muted-foreground font-medium">
            Welcome back,{" "}
            <span className="text-primary font-semibold">{profile?.first_name || user.email?.split("@")[0]}</span>{" "}
            {profile?.last_name || ""}
          </p>
        </div>

        {profile?.role === "admin" && pendingApprovals > 0 && (
          <Alert className="border-primary/20 bg-primary/5 shadow-sm">
            <AlertCircle className="h-5 w-5 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-primary font-semibold text-base">
                {pendingApprovals} user{pendingApprovals > 1 ? "s" : ""} awaiting approval
              </span>
              <Button asChild size="sm" className="ml-4 shadow-sm hover:shadow-md transition-shadow">
                <Link href="/dashboard/user-approvals">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Review Now
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Today's Status"
            value={todayAttendance ? "Checked In" : "Not Checked In"}
            description={
              todayAttendance
                ? `At ${new Date(todayAttendance.check_in_time).toLocaleTimeString()}`
                : "Click to check in"
            }
            icon={Clock}
            variant={todayAttendance ? "success" : "default"}
          />

          <StatsCard
            title="This Month"
            value={monthlyAttendance || 0}
            description="Days attended"
            icon={Calendar}
            trend={{ value: 5, isPositive: true }}
          />

          <StatsCard title="QCC Locations" value={totalLocations || 0} description="Active campuses" icon={MapPin} />

          <StatsCard
            title="Department"
            value={profile?.departments?.code || "N/A"}
            description={profile?.departments?.name || "No department assigned"}
            icon={Users}
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <QuickActions />
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-3">
            <Card className="shadow-sm border-0 bg-gradient-to-br from-card to-card/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-heading font-semibold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="text-base">Your latest attendance records</CardDescription>
              </CardHeader>
              <CardContent>
                {todayAttendance ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-6 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/10">
                      <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">Checked in today</p>
                        <p className="text-sm text-muted-foreground font-medium">
                          {new Date(todayAttendance.check_in_time).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-muted-foreground">No attendance recorded today</p>
                    <p className="text-sm text-muted-foreground mt-2">Use the quick actions to check in</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-sm border-0 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-heading font-semibold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Performance Overview
            </CardTitle>
            <CardDescription className="text-base">Your attendance statistics and trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/10">
                <div className="text-3xl font-heading font-bold text-primary mb-2">{monthlyAttendance || 0}</div>
                <div className="text-sm font-medium text-muted-foreground">Days This Month</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-chart-2/5 to-chart-2/10 rounded-xl border border-chart-2/10">
                <div className="text-3xl font-heading font-bold text-chart-2 mb-2">
                  {monthlyAttendance ? Math.round((monthlyAttendance / new Date().getDate()) * 100) : 0}%
                </div>
                <div className="text-sm font-medium text-muted-foreground">Attendance Rate</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-chart-3/5 to-chart-3/10 rounded-xl border border-chart-3/10">
                <div className="text-lg font-heading font-bold text-chart-3 mb-2">
                  {profile?.role === "admin"
                    ? "Administrator"
                    : profile?.role === "department_head"
                      ? "Department Head"
                      : "Staff"}
                </div>
                <div className="text-sm font-medium text-muted-foreground">Role</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
