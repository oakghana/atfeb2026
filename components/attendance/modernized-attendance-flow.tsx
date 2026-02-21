"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Clock, MapPin, Timer, Calendar, LogOut, LogIn, Loader2, CheckCircle2, AlertTriangle, Zap, TrendingUp } from "lucide-react"
import { useEffect, useState, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { canCheckOutAtTime, getCheckOutDeadline, canCheckInAtTime, getCheckInDeadline } from "@/lib/attendance-utils"

interface ModernizedAttendanceFlowProps {
  checkInTime?: string
  checkOutTime?: string
  checkInLocation?: string
  minimumWorkMinutes?: number
  userDepartment?: { code?: string | null; name?: string | null } | undefined | null
  userRole?: string | null
  isCheckingIn?: boolean
  isCheckingOut?: boolean
  onCheckIn?: () => void
  onCheckOut?: () => void
  canCheckOut?: boolean
  isOffPremises?: boolean
  predictedCheckoutTime?: string | null
}

interface CountdownState {
  hours: number
  minutes: number
  seconds: number
  percentage: number
  canCheckout: boolean
  hasNotified: boolean
}

export function ModernizedAttendanceFlow({
  checkInTime,
  checkOutTime,
  checkInLocation,
  minimumWorkMinutes = 120,
  userDepartment,
  userRole,
  isCheckingIn = false,
  isCheckingOut = false,
  onCheckIn,
  onCheckOut,
  canCheckOut = true,
  isOffPremises = false,
  predictedCheckoutTime,
}: ModernizedAttendanceFlowProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [countdown, setCountdown] = useState<CountdownState>({
    hours: 0,
    minutes: 0,
    seconds: 0,
    percentage: 0,
    canCheckout: false,
    hasNotified: false,
  })
  const [showNotification, setShowNotification] = useState(false)
  const [isNotificationDismissed, setIsNotificationDismissed] = useState(false)

  // Calculate countdown state
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date()
      setCurrentTime(now)

      if (!checkInTime) return

      const checkInDate = new Date(checkInTime)
      const minimumCheckoutTime = new Date(checkInDate.getTime() + minimumWorkMinutes * 60 * 1000)
      const diff = minimumCheckoutTime.getTime() - now.getTime()
      const totalDiff = minimumWorkMinutes * 60 * 1000

      if (diff <= 0) {
        setCountdown((prev) => ({
          ...prev,
          hours: 0,
          minutes: 0,
          seconds: 0,
          percentage: 100,
          canCheckout: true,
        }))
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        const percentage = Math.round(((totalDiff - diff) / totalDiff) * 100)

        // Trigger notification when 5 minutes remaining
        const fiveMinutesInMs = 5 * 60 * 1000
        const shouldNotify = diff <= fiveMinutesInMs && diff > fiveMinutesInMs - 1000

        setCountdown((prev) => ({
          ...prev,
          hours,
          minutes,
          seconds,
          percentage,
          canCheckout: false,
          hasNotified: shouldNotify ? true : prev.hasNotified,
        }))

        if (shouldNotify && !isNotificationDismissed) {
          setShowNotification(true)
        }
      }
    }

    const timer = setInterval(calculateCountdown, 1000)
    calculateCountdown() // Initial calculation

    return () => clearInterval(timer)
  }, [checkInTime, minimumWorkMinutes, isNotificationDismissed])

  const elapsedTime = checkInTime
    ? Math.floor((currentTime.getTime() - new Date(checkInTime).getTime()) / (1000 * 60))
    : 0
  const elapsedHours = Math.floor(elapsedTime / 60)
  const elapsedMinutes = elapsedTime % 60

  const timeUntilCheckInDeadline = () => {
    const now = new Date()
    const deadline = new Date(now)
    deadline.setHours(15, 0, 0, 0) // 3 PM
    
    if (now > deadline) {
      return null
    }
    
    const diff = deadline.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    return { hours, minutes }
  }

  const checkInDeadline = timeUntilCheckInDeadline()
  const isCheckInAllowed = canCheckInAtTime(currentTime, userDepartment, userRole)
  const isCheckOutAllowed = canCheckOutAtTime(currentTime, userDepartment, userRole)

  return (
    <div className="space-y-4">
      {/* Notification Banner */}
      {showNotification && !isNotificationDismissed && countdown.canCheckout && (
        <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 text-green-900">
          <Zap className="h-4 w-4" />
          <AlertTitle>Ready to Check Out!</AlertTitle>
          <AlertDescription className="mt-2 flex items-center justify-between">
            <span>Your minimum work period is complete. You can now check out.</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={() => setIsNotificationDismissed(true)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Check-In Card */}
      {!checkInTime && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5 text-blue-600" />
              Daily Check-In
            </CardTitle>
            <CardDescription>Start your work session with location verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isCheckInAllowed && checkInDeadline && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Check-In Deadline Approaching</AlertTitle>
                <AlertDescription>
                  Regular staff must check in before {getCheckInDeadline()}.
                  {checkInDeadline && ` (${checkInDeadline.hours}h ${checkInDeadline.minutes}m remaining)`}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Check in to record your attendance and start tracking your work session
              </p>

              <Button
                onClick={onCheckIn}
                disabled={isCheckingIn || !isCheckInAllowed}
                size="lg"
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg h-14 font-semibold"
              >
                {isCheckingIn ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-2" />
                    Check In Now
                  </>
                )}
              </Button>

              {!isCheckInAllowed && (
                <p className="text-xs text-center text-muted-foreground">
                  Check-in not available after {getCheckInDeadline()} for regular staff
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Session - Timer and Checkout */}
      {checkInTime && !checkOutTime && (
        <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-50 to-emerald-50 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
                  <div className="relative bg-green-500 rounded-full p-3">
                    <Clock className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Active Session</h3>
                  <p className="text-sm text-muted-foreground">
                    Started {formatDistanceToNow(new Date(checkInTime), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white hover:bg-green-600 animate-pulse">On Duty</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Session Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-lg bg-white/60 border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Check-In Time</p>
                <p className="text-lg font-bold text-foreground">
                  {new Date(checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <div className="rounded-lg bg-white/60 border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time Worked</p>
                <p className="text-lg font-bold text-foreground">
                  {elapsedHours}h {elapsedMinutes}m
                </p>
              </div>

              <div className="rounded-lg bg-white/60 border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
                <p className="text-sm font-semibold text-foreground truncate">{checkInLocation || "On-Premises"}</p>
              </div>
            </div>

            {/* Progress Bar - Visual representation of minimum work period */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium text-muted-foreground">Work Progress</p>
                <p className="text-xs font-semibold text-foreground">{countdown.percentage}%</p>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-green-500 transition-all duration-1000 ease-out rounded-full"
                  style={{ width: `${countdown.percentage}%` }}
                />
              </div>
            </div>

            {/* Checkout Status - Timer or Ready */}
            {countdown.canCheckout ? (
              <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500 rounded-full p-2">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">Ready to Check Out</p>
                    <p className="text-sm text-green-700">Your minimum work period is complete</p>
                  </div>
                </div>

                {predictedCheckoutTime && (
                  <div className="flex items-center gap-2 text-xs text-green-700 pt-2 border-t border-green-200">
                    <TrendingUp className="h-4 w-4" />
                    <span>Predicted checkout time: {new Date(predictedCheckoutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-300 p-4 space-y-3">
                <p className="text-sm font-medium text-orange-900">Minimum work period in progress</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-orange-700">Checkout available in:</p>
                  <div className="flex items-center gap-1 text-3xl font-bold text-orange-600 font-mono">
                    <span className="w-12 text-right">{String(countdown.hours).padStart(2, "0")}</span>
                    <span className="animate-pulse">:</span>
                    <span className="w-12">{String(countdown.minutes).padStart(2, "0")}</span>
                    <span className="animate-pulse">:</span>
                    <span className="w-12">{String(countdown.seconds).padStart(2, "0")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Time Restriction Alert */}
            {!isCheckOutAllowed && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Check-Out Deadline</AlertTitle>
                <AlertDescription>
                  Regular staff must check out before {getCheckOutDeadline()}. You may have limited time to complete your checkout.
                </AlertDescription>
              </Alert>
            )}

            {/* Checkout Button */}
            {onCheckOut && (
              <Button
                onClick={onCheckOut}
                disabled={
                  isCheckingOut ||
                  (!countdown.canCheckout && !isOffPremises && !isCheckOutAllowed)
                }
                variant={countdown.canCheckout ? "default" : "outline"}
                className={`w-full h-14 font-semibold transition-all duration-300 ${
                  countdown.canCheckout
                    ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg"
                    : ""
                }`}
                size="lg"
              >
                {isCheckingOut ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Checking Out...
                  </>
                ) : (
                  <>
                    <LogOut className="mr-2 h-5 w-5" />
                    {isOffPremises ? "Off-Premises Check Out" : "Check Out Now"}
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Checked Out State */}
      {checkOutTime && (
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Session Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-white border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Check-In</p>
                <p className="font-semibold">{new Date(checkInTime || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <div className="rounded-lg bg-white border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase">Check-Out</p>
                <p className="font-semibold">{new Date(checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Total work duration: {elapsedHours}h {elapsedMinutes}m
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
