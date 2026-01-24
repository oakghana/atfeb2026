"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, Timer, Calendar } from "lucide-react"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"

interface ActiveSessionTimerProps {
  checkInTime: string
  checkInLocation: string
  checkOutLocation?: string
  minimumWorkMinutes?: number
}

export function ActiveSessionTimer({
  checkInTime,
  checkInLocation,
  checkOutLocation,
  minimumWorkMinutes = 120,
}: ActiveSessionTimerProps) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [timeUntilCheckout, setTimeUntilCheckout] = useState<{
    hours: number
    minutes: number
    seconds: number
    canCheckout: boolean
  }>({ hours: 0, minutes: 0, seconds: 0, canCheckout: false })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now)

      const checkInDate = new Date(checkInTime)
      const minimumCheckoutTime = new Date(checkInDate.getTime() + minimumWorkMinutes * 60 * 1000)
      const diff = minimumCheckoutTime.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeUntilCheckout({ hours: 0, minutes: 0, seconds: 0, canCheckout: true })
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeUntilCheckout({ hours, minutes, seconds, canCheckout: false })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [checkInTime, minimumWorkMinutes])

  const checkInDate = new Date(checkInTime)
  const elapsedTime = Math.floor((currentTime.getTime() - checkInDate.getTime()) / (1000 * 60))
  const elapsedHours = Math.floor(elapsedTime / 60)
  const elapsedMinutes = elapsedTime % 60

  return (
    <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
      <CardContent className="p-6 space-y-4">
        {/* Active Session Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
              <div className="relative bg-green-500 rounded-full p-3">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg text-foreground">Active Work Session</h3>
              <p className="text-sm text-muted-foreground">
                Started {formatDistanceToNow(checkInDate, { addSuffix: true })}
              </p>
            </div>
          </div>
          <Badge className="bg-green-500 text-white hover:bg-green-600">On Duty</Badge>
        </div>

        {/* Session Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Check-in Info */}
          <div className="rounded-lg bg-white/60 dark:bg-black/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Calendar className="h-3.5 w-3.5" />
              Check-In
            </div>
            <p className="text-2xl font-bold text-foreground">
              {checkInDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{checkInLocation}</span>
            </div>
          </div>

          {/* Time Worked */}
          <div className="rounded-lg bg-white/60 dark:bg-black/20 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Timer className="h-3.5 w-3.5" />
              Time Worked
            </div>
            <p className="text-2xl font-bold text-foreground">
              {elapsedHours}h {elapsedMinutes}m
            </p>
            <p className="text-sm text-muted-foreground">
              {elapsedTime} minutes elapsed
            </p>
          </div>
        </div>

        {/* Countdown Timer */}
        {!timeUntilCheckout.canCheckout ? (
          <div className="rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Minimum work period in progress
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  Checkout will be available after {minimumWorkMinutes} minutes
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-3xl font-bold text-orange-600 dark:text-orange-400 font-mono">
                  <span className="w-12 text-right">{String(timeUntilCheckout.hours).padStart(2, "0")}</span>
                  <span className="animate-pulse">:</span>
                  <span className="w-12">{String(timeUntilCheckout.minutes).padStart(2, "0")}</span>
                  <span className="animate-pulse">:</span>
                  <span className="w-12">{String(timeUntilCheckout.seconds).padStart(2, "0")}</span>
                </div>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">until checkout available</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-center gap-3">
              <div className="bg-green-500 rounded-full p-2">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">Ready to check out</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  You can now check out from your location
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Checkout Location Info */}
        {checkOutLocation && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Checkout location: {checkOutLocation}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
