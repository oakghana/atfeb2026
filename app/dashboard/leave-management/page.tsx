"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, XCircle, Clock, Calendar } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface LeaveRequest {
  id: string
  user_id: string
  staff_name: string
  leave_status: "pending" | "active" | "approved" | "rejected"
  leave_start_date: string
  leave_end_date: string
  leave_reason: string
  department: string
}

export default function LeaveManagementPage() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchLeaveRequests()
  }, [])

  const fetchLeaveRequests = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      // Get user's department
      const { data: userProfile } = await supabase
        .from("user_profiles")
        .select("department_id")
        .eq("id", user.id)
        .single()

      if (!userProfile?.department_id) {
        setLoading(false)
        return
      }

      // Fetch all pending/active/approved leave requests in this department
      const { data: leaveRequests } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name, leave_status, leave_start_date, leave_end_date, leave_reason, departments(name)")
        .eq("department_id", userProfile.department_id)
        .in("leave_status", ["pending", "active", "approved"])

      if (leaveRequests) {
        const formatted = leaveRequests.map((req: any) => ({
          id: req.id,
          user_id: req.id,
          staff_name: `${req.first_name} ${req.last_name}`,
          leave_status: req.leave_status,
          leave_start_date: req.leave_start_date,
          leave_end_date: req.leave_end_date,
          leave_reason: req.leave_reason,
          department: req.departments?.name || "Unknown",
        }))
        setRequests(formatted)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId: string, startDate: string, endDate: string) => {
    const supabase = createClient()
    // Change status to "approved" so staff can submit with document
    await supabase
      .from("user_profiles")
      .update({
        leave_status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    // Send notification
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("staff_notifications").insert({
        recipient_id: userId,
        sender_id: user.id,
        sender_role: "department_head",
        sender_label: "Department Head",
        notification_type: "leave_approved",
        message: `Your leave request for ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()} has been approved! Submit your supporting document to activate the leave.`,
      })
    }

    fetchLeaveRequests()
  }

  const handleReject = async (userId: string) => {
    const supabase = createClient()
    await supabase
      .from("user_profiles")
      .update({
        leave_status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    // Send notification
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      await supabase.from("staff_notifications").insert({
        recipient_id: userId,
        sender_id: user.id,
        sender_role: "department_head",
        sender_label: "Department Head",
        notification_type: "leave_rejected",
        message: "Your leave request has been declined.",
      })
    }

    fetchLeaveRequests()
  }

  const pendingRequests = requests.filter((r) => r.leave_status === "pending")
  const activeRequests = requests.filter((r) => r.leave_status === "active")

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading leave requests...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">Leave Management</h1>
              <p className="text-lg text-muted-foreground font-medium mt-1">Review and manage leave requests from your department</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                Pending Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-600">{pendingRequests.length}</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Active Leaves
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{activeRequests.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({activeRequests.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No pending leave requests</p>
                </CardContent>
              </Card>
            ) : (
              pendingRequests.map((request) => (
                <Card key={request.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{request.staff_name}</CardTitle>
                        <CardDescription>{request.department}</CardDescription>
                      </div>
                      <Badge className="bg-amber-600">Pending</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                        <p className="font-semibold">{new Date(request.leave_start_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">End Date</p>
                        <p className="font-semibold">{new Date(request.leave_end_date).toLocaleDateString()}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Reason</p>
                      <p className="text-sm">{request.leave_reason}</p>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={() => handleApprove(request.user_id, request.leave_start_date, request.leave_end_date)}
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button onClick={() => handleReject(request.user_id)} size="sm" variant="destructive" className="flex-1">
                        <XCircle className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No active leaves</p>
                </CardContent>
              </Card>
            ) : (
              activeRequests.map((request) => (
                <Card key={request.id} className="border-2 border-green-200 bg-green-50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{request.staff_name}</CardTitle>
                        <CardDescription>{request.department}</CardDescription>
                      </div>
                      <Badge className="bg-green-600">Active</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                        <p className="font-semibold">{new Date(request.leave_start_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">End Date</p>
                        <p className="font-semibold">{new Date(request.leave_end_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
