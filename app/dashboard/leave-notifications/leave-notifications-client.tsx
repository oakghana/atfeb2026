"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Bell,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { LeaveNotificationCard, type LeaveNotification } from "@/components/leave/leave-notification-card"

interface LeaveNotificationsClientProps {
  userRole: string | null
}

export function LeaveNotificationsClient({ userRole }: LeaveNotificationsClientProps) {
  const [notifications, setNotifications] = useState<LeaveNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [selectedNotifId, setSelectedNotifId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      console.log("Fetching notifications...")

      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser()

      if (userError) {
        console.error("Auth error:", userError)
        throw new Error(`Authentication error: ${userError.message}`)
      }

      if (!user) {
        console.log("No authenticated user found")
        return
      }

      // First try a simple query to check if table access works
      const { data: simpleData, error: simpleError } = await supabase
        .from("leave_notifications")
        .select("id, created_at")
        .limit(1)

      if (simpleError) {
        console.error("Simple query error:", simpleError)
        throw new Error(`Database access error: ${simpleError.message}`)
      }

      console.log("Simple query successful, found", simpleData?.length || 0, "notifications")

      const { data, error } = await supabase
        .from("leave_notifications")
        .select(`
          *,
          leave_request:leave_requests (
            id,
            start_date,
            end_date,
            reason,
            status,
            created_at,
            user:user_profiles (
              id,
              first_name,
              last_name,
              employee_id,
              departments (
                name
              )
            )
          )
        `)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Database query error:", error)
        throw error
      }

      console.log("Fetched notifications:", data?.length || 0, "items")
      setNotifications(data || [])
    } catch (error) {
      console.error("Error fetching notifications:", error)
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        error
      })
      // Don't re-throw the error, just log it and continue
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (notificationId: string) => {
    setProcessingId(notificationId)
    try {
      const response = await fetch("/api/leave/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          notificationId,
        }),
      })

      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error("Error approving leave:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async () => {
    if (!selectedNotifId) return

    setProcessingId(selectedNotifId)
    try {
      const response = await fetch("/api/leave/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          notificationId: selectedNotifId,
        }),
      })

      if (response.ok) {
        await fetchNotifications()
        setShowRejectDialog(false)
        setRejectionReason("")
        setSelectedNotifId(null)
      }
    } catch (error) {
      console.error("Error rejecting leave:", error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDismiss = async (notificationId: string) => {
    setProcessingId(notificationId)
    try {
      const response = await fetch("/api/leave/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dismiss",
          notificationId,
        }),
      })

      if (response.ok) {
        await fetchNotifications()
      }
    } catch (error) {
      console.error("Error dismissing notification:", error)
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading leave notifications...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!["admin", "regional_manager", "department_head"].includes(userRole || "")) {
    return (
      <DashboardLayout>
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="text-amber-800">
            You don't have permission to manage leave notifications. Only admins, regional managers, and department heads can access this page.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    )
  }

  const pendingNotifications = notifications.filter(n => n.status === "pending")
  const approvedNotifications = notifications.filter(n => n.status === "approved")
  const rejectedNotifications = notifications.filter(n => n.status === "rejected")

  const roleBadge = {
    admin: { label: "Administrator", color: "bg-red-100 text-red-800 border-red-200" },
    regional_manager: { label: "Regional Manager", color: "bg-blue-100 text-blue-800 border-blue-200" },
    department_head: { label: "Department Head", color: "bg-green-100 text-green-800 border-green-200" },
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">
                Leave Notifications
              </h1>
              <p className="text-lg text-muted-foreground font-medium mt-1">
                Manage leave requests from your team
              </p>
            </div>
            <Badge className={`ml-auto ${roleBadge[userRole as keyof typeof roleBadge]?.color || ""} border font-semibold`}>
              {roleBadge[userRole as keyof typeof roleBadge]?.label}
            </Badge>
          </div>
        </div>

        {notifications.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-12 pb-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No leave notifications</p>
                <p className="text-sm text-muted-foreground mt-2">
                  All leave requests have been processed or there are currently no pending requests.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:w-fit">
              <TabsTrigger className="flex items-center gap-2" value="pending">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Pending</span>
                {pendingNotifications.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {pendingNotifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger className="flex items-center gap-2" value="approved">
                <CheckCircle2 className="h-4 w-4" />
                <span className="hidden sm:inline">Approved</span>
                {approvedNotifications.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {approvedNotifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger className="flex items-center gap-2" value="rejected">
                <XCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Rejected</span>
                {rejectedNotifications.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {rejectedNotifications.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="mt-6">
              <TabsContent value="pending" className="space-y-4">
                {pendingNotifications.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="pt-12 pb-12">
                      <div className="text-center">
                        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No pending leave requests</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {pendingNotifications.map((notif) => (
                      <div key={notif.id} onClick={() => console.log(notif)}>
                        <LeaveNotificationCard
                          notification={notif}
                          isManager={true}
                          onApprove={() => handleApprove(notif.id)}
                          onReject={() => {
                            setSelectedNotifId(notif.id)
                            setShowRejectDialog(true)
                          }}
                          onDismiss={handleDismiss}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approved" className="space-y-4">
                {approvedNotifications.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="pt-12 pb-12">
                      <div className="text-center">
                        <CheckCircle2 className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No approved leave requests</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {approvedNotifications.map((notif) => (
                      <LeaveNotificationCard
                        key={notif.id}
                        notification={notif}
                        isManager={true}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="space-y-4">
                {rejectedNotifications.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="pt-12 pb-12">
                      <div className="text-center">
                        <XCircle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No rejected leave requests</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {rejectedNotifications.map((notif) => (
                      <LeaveNotificationCard
                        key={notif.id}
                        notification={notif}
                        isManager={true}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this leave request. The staff member will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter reason for rejection (optional)"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false)
                  setRejectionReason("")
                  setSelectedNotifId(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={processingId === selectedNotifId}
                className="bg-red-600 hover:bg-red-700"
              >
                {processingId === selectedNotifId ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Request
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}