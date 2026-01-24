"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, CheckCircle2, Clock, AlertCircle, Upload } from "lucide-react"
import { LeaveRequestDialog, LeaveRequestData } from "./leave-request-dialog"

interface LeaveStatusCardProps {
  leaveStatus: "active" | "pending" | "rejected" | "approved" | null
  leaveStartDate: string | null
  leaveEndDate: string | null
  leaveReason: string | null
  onRequestLeave: () => void
}

export function LeaveStatusCard({
  leaveStatus,
  leaveStartDate,
  leaveEndDate,
  leaveReason,
  onRequestLeave,
}: LeaveStatusCardProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if user is currently on leave
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const startDate = leaveStartDate ? new Date(leaveStartDate) : null
  const endDate = leaveEndDate ? new Date(leaveEndDate) : null

  // User is on leave if they have leave dates and today is within that range
  // Note: leave_status "active" means working at post, NOT on leave
  const isCurrentlyOnLeave =
    startDate && endDate && today >= startDate && today <= endDate

  const handleSubmitApprovedLeave = async (data: LeaveRequestData) => {
    setIsSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("startDate", data.startDate.toISOString())
      formData.append("endDate", data.endDate.toISOString())
      formData.append("reason", data.reason)
      formData.append("leaveType", data.leaveType)
      if (data.documentFile) {
        formData.append("document", data.documentFile)
      }

      // Call server-side API to handle leave submission with Supabase updates
      const response = await fetch("/api/leave/activate", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to submit leave")
      }

      // Refresh page to show updated leave status
      window.location.reload()
    } catch (error) {
      console.error("[v0] Error submitting leave:", error)
      alert(error instanceof Error ? error.message : "Failed to submit leave")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show nothing if user is working normally (no leave request or dates)
  if (!leaveStatus || leaveStatus === "active" || (leaveStatus === "rejected" && !startDate)) {
    return null
  }

  // Currently on approved leave
  if (isCurrentlyOnLeave) {
    return (
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-green-900">
              <CheckCircle2 className="w-5 h-5" />
              Currently On Approved Leave
            </CardTitle>
            <Badge className="bg-green-600 hover:bg-green-700">Active</Badge>
          </div>
          <CardDescription className="text-green-700">
            Attendance is not required during this period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/50 rounded-lg border border-green-100">
              <p className="text-xs text-muted-foreground mb-1">Start Date</p>
              <p className="font-semibold">{startDate?.toLocaleDateString()}</p>
            </div>
            <div className="p-3 bg-white/50 rounded-lg border border-green-100">
              <p className="text-xs text-muted-foreground mb-1">End Date</p>
              <p className="font-semibold">{endDate?.toLocaleDateString()}</p>
            </div>
          </div>

          {leaveReason && (
            <div className="p-3 bg-white/50 rounded-lg border border-green-100">
              <p className="text-xs text-muted-foreground mb-1">Reason</p>
              <p className="text-sm">{leaveReason}</p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-white/50 rounded-lg border border-green-100">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-900">
              Your leave is active. Your department head has been notified. Check-in/check-out is disabled during this period.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Leave approved but not yet submitted with document
  if (leaveStatus === "approved" && startDate && endDate) {
    return (
      <>
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
                <CheckCircle2 className="w-5 h-5" />
                Leave Approved
              </CardTitle>
              <Badge className="bg-blue-600 hover:bg-blue-700">Approved</Badge>
            </div>
            <CardDescription className="text-blue-700">
              Submit your document to activate the leave immediately
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-white/50 rounded-lg border border-blue-100">
                <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                <p className="font-semibold">{startDate?.toLocaleDateString()}</p>
              </div>
              <div className="p-3 bg-white/50 rounded-lg border border-blue-100">
                <p className="text-xs text-muted-foreground mb-1">End Date</p>
                <p className="font-semibold">{endDate?.toLocaleDateString()}</p>
              </div>
            </div>

            {leaveReason && (
              <div className="p-3 bg-white/50 rounded-lg border border-blue-100">
                <p className="text-xs text-muted-foreground mb-1">Reason</p>
                <p className="text-sm">{leaveReason}</p>
              </div>
            )}

            <Alert className="bg-blue-100 border-blue-300">
              <Upload className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 font-medium">
                Upload your supporting document (approval letter, medical certificate, etc.) to activate the leave.
              </AlertDescription>
            </Alert>

            <Button
              onClick={() => setShowDialog(true)}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Leave with Document"}
            </Button>
          </CardContent>
        </Card>

        <LeaveRequestDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          staffName="Your Leave"
          hasApprovedLeave={true}
          onSubmit={handleSubmitApprovedLeave}
        />
      </>
    )
  }

  // Pending leave request (awaiting HOD approval)
  if (leaveStatus === "pending" && startDate && endDate) {
    return (
      <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-900">
              <Clock className="w-5 h-5" />
              Leave Request Pending
            </CardTitle>
            <Badge className="bg-amber-600 hover:bg-amber-700">Pending</Badge>
          </div>
          <CardDescription className="text-amber-700">Awaiting HOD approval</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/50 rounded-lg border border-amber-100">
              <p className="text-xs text-muted-foreground mb-1">Start Date</p>
              <p className="font-semibold">{startDate?.toLocaleDateString()}</p>
            </div>
            <div className="p-3 bg-white/50 rounded-lg border border-amber-100">
              <p className="text-xs text-muted-foreground mb-1">End Date</p>
              <p className="font-semibold">{endDate?.toLocaleDateString()}</p>
            </div>
          </div>

          {leaveReason && (
            <div className="p-3 bg-white/50 rounded-lg border border-amber-100">
              <p className="text-xs text-muted-foreground mb-1">Reason</p>
              <p className="text-sm">{leaveReason}</p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-white/50 rounded-lg border border-amber-100">
            <Clock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-900">Your HOD will review and respond to this request soon.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Rejected leave request
  if (leaveStatus === "rejected") {
    return (
      <Card className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-red-900">
              <AlertCircle className="w-5 h-5" />
              Leave Request Rejected
            </CardTitle>
            <Badge variant="destructive">Rejected</Badge>
          </div>
          <CardDescription className="text-red-700">Your leave request was not approved</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onRequestLeave} variant="outline" className="w-full bg-transparent">
            Submit New Request
          </Button>
        </CardContent>
      </Card>
    )
  }

  return null
}
