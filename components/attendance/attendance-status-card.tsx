"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertCircle, CheckCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface AttendanceStatusCardProps {
  isCheckedIn: boolean
  isCheckedOut: boolean
  checkInTime?: string
  checkOutTime?: string
  checkInLocation?: string
  checkOutLocation?: string
  workHours?: number
  className?: string
}

export function AttendanceStatusCard({
  isCheckedIn,
  isCheckedOut,
  checkInTime,
  checkOutTime,
  checkInLocation,
  checkOutLocation,
  workHours,
  className,
}: AttendanceStatusCardProps) {
  // Smart status detection
  const getStatus = () => {
    if (isCheckedOut) {
      return {
        label: "Completed for Today",
        icon: CheckCheck,
        color: "text-green-600 bg-green-50",
        badge: "Checked Out",
        badgeVariant: "default" as const,
      }
    }
    if (isCheckedIn) {
      return {
        label: "Currently On Duty",
        icon: Clock,
        color: "text-blue-600 bg-blue-50",
        badge: "Active Session",
        badgeVariant: "secondary" as const,
      }
    }
    return {
      label: "Not Checked In",
      icon: AlertCircle,
      color: "text-amber-600 bg-amber-50",
      badge: "Ready to Check In",
      badgeVariant: "outline" as const,
    }
  }

  const status = getStatus()
  const StatusIcon = status.icon

  const formatTime = (isoTime?: string) => {
    if (!isoTime) return "--:--"
    const date = new Date(isoTime)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  }

  return (
    <Card className={cn("shadow-sm border-0", status.color, className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className="w-5 h-5" />
            <div>
              <CardTitle className="text-lg">{status.label}</CardTitle>
              <CardDescription className="text-xs">Today's Attendance Status</CardDescription>
            </div>
          </div>
          <Badge variant={status.badgeVariant}>{status.badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Check In</p>
            <p className="font-semibold">{formatTime(checkInTime)}</p>
            {checkInLocation && <p className="text-xs text-muted-foreground truncate">{checkInLocation}</p>}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Check Out</p>
            <p className="font-semibold">{checkOutTime ? formatTime(checkOutTime) : "Pending"}</p>
            {checkOutLocation && <p className="text-xs text-muted-foreground truncate">{checkOutLocation}</p>}
          </div>
        </div>
        {workHours && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">Work Hours</p>
            <p className="font-bold text-base">{workHours.toFixed(2)} hours</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
