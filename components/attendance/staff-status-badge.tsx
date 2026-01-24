"use client"

import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Plane, Clock, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface StaffStatusBadgeProps {
  isCheckedIn: boolean
  isOnLeave: boolean
  leaveStatus?: "active" | "pending" | "approved" | "rejected" | null
  className?: string
}

export function StaffStatusBadge({ isCheckedIn, isOnLeave, leaveStatus, className }: StaffStatusBadgeProps) {
  // Priority: Leave status > Check-in status
  if (isOnLeave && leaveStatus === "active") {
    return (
      <Badge
        className={cn(
          "px-4 py-2 text-base font-semibold shadow-md border-2 border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-900 hover:from-amber-200 hover:to-orange-200 transition-all duration-300",
          className
        )}
      >
        <Plane className="w-5 h-5 mr-2" />
        On Leave
      </Badge>
    )
  }

  if (leaveStatus === "approved") {
    return (
      <Badge
        className={cn(
          "px-4 py-2 text-base font-semibold shadow-md border-2 border-blue-300 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-900 hover:from-blue-200 hover:to-cyan-200 transition-all duration-300",
          className
        )}
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        Leave Approved
      </Badge>
    )
  }

  if (leaveStatus === "pending") {
    return (
      <Badge
        className={cn(
          "px-4 py-2 text-base font-semibold shadow-md border-2 border-amber-300 bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 hover:from-amber-200 hover:to-yellow-200 transition-all duration-300",
          className
        )}
      >
        <Clock className="w-5 h-5 mr-2" />
        Leave Pending
      </Badge>
    )
  }

  if (isCheckedIn) {
    return (
      <Badge
        className={cn(
          "px-4 py-2 text-base font-semibold shadow-md border-2 border-green-300 bg-gradient-to-r from-green-100 to-emerald-100 text-green-900 hover:from-green-200 hover:to-emerald-200 transition-all duration-300 animate-pulse",
          className
        )}
      >
        <CheckCircle2 className="w-5 h-5 mr-2" />
        At Post
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "px-4 py-2 text-base font-semibold shadow-sm border-2 bg-background text-muted-foreground transition-all duration-300",
        className
      )}
    >
      <XCircle className="w-5 h-5 mr-2" />
      Not Checked In
    </Badge>
  )
}
