"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, MapPin, Clock, Zap } from "lucide-react"
import { useEffect, useState } from "react"

interface CheckinSuccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkInTime: string
  checkInLocation: string
  isOffPremises: boolean
}

export function CheckinSuccessModal({
  open,
  onOpenChange,
  checkInTime,
  checkInLocation,
  isOffPremises,
}: CheckinSuccessModalProps) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (open) {
      setIsAnimating(true)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-0 shadow-2xl overflow-hidden p-0">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-950 dark:via-cyan-950 dark:to-teal-950" />

        {/* Confetti-like animated circles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-24 h-24 bg-blue-400/10 rounded-full blur-3xl ${
                isAnimating ? "animate-pulse" : ""
              }`}
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="relative p-8 space-y-6 text-center">
          {/* Success Badge Animation */}
          <div className="flex justify-center">
            <div
              className={`relative w-20 h-20 ${
                isAnimating ? "animate-bounce" : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              {/* Pulsing ring */}
              <div className="absolute inset-0 border-2 border-blue-400 rounded-full animate-ping opacity-75" />
            </div>
          </div>

          {/* Main Message */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400">
              Ready to Work!
            </h2>
            <p className="text-lg font-semibold text-foreground">
              You've Successfully Checked In
            </p>
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-full border border-blue-200 dark:border-blue-800">
            <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
              {isOffPremises ? "Remote Work Mode" : "On-Site Active"}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            {/* Time */}
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-muted-foreground">Checkin</span>
              </div>
              <p className="font-mono font-bold text-foreground">{checkInTime}</p>
            </div>

            {/* Location */}
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-blue-100 dark:border-blue-900/50">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-medium text-muted-foreground">Location</span>
              </div>
              <p className="font-semibold text-foreground text-sm truncate">
                {checkInLocation}
              </p>
            </div>
          </div>

          {/* Timer Info */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <span className="font-semibold">Minimum work period:</span> 2 hours 0 minutes
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              You'll be able to check out once this time has elapsed
            </p>
          </div>

          {/* Action Button */}
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-6 text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Continue
          </Button>

          {/* Footer Message */}
          <p className="text-xs text-muted-foreground">
            Your check-in has been recorded. Have a productive day!
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
