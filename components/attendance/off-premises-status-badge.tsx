"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, AlertTriangle, MapPin } from "lucide-react"

interface OffPremisesStatusBadgeProps {
  approvalStatus?: "pending_supervisor_approval" | "approved_offpremises" | "normal_checkin"
  requestLocation?: string
  onOfficialDuty?: boolean
}

export function OffPremisesStatusBadge({
  approvalStatus,
  requestLocation,
  onOfficialDuty,
}: OffPremisesStatusBadgeProps) {
  if (approvalStatus === "pending_supervisor_approval") {
    return (
      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">
          Off-Premises Request Pending Review
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Your off-premises check-in request from {requestLocation || "your location"} is being reviewed by your supervisors.
          You are temporarily checked in and will be marked present once approved. Check-out will be available after approval.
        </AlertDescription>
      </Alert>
    )
  }

  if (approvalStatus === "approved_offpremises") {
    return (
      <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle className="text-green-900 dark:text-green-100">
          Off-Premises Check-In Approved
        </AlertTitle>
        <AlertDescription className="text-green-800 dark:text-green-200">
          Your off-premises request has been approved. You are checked in on official duty outside premises at {requestLocation || "your approved location"}. 
          You may check out from any location when your shift ends.
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
