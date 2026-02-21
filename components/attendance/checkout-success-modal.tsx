"use client"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Check, MapPin, Clock, Award } from "lucide-react"
import { useEffect, useState } from "react"

interface CheckoutSuccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  checkoutTime: string
  checkoutLocation: string
  workHours: number
  workMinutes: number
  isRemoteCheckout: boolean
}

export function CheckoutSuccessModal({
  open,
  onOpenChange,
  checkoutTime,
  checkoutLocation,
  workHours,
  workMinutes,
  isRemoteCheckout,
}: CheckoutSuccessModalProps) {
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
        <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950 dark:via-emerald-950 dark:to-teal-950" />

        {/* Confetti-like animated circles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-24 h-24 bg-green-400/10 rounded-full blur-3xl ${
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
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                <Check className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              {/* Pulsing ring */}
              <div className="absolute inset-0 border-2 border-green-400 rounded-full animate-ping opacity-75" />
            </div>
          </div>

          {/* Main Message */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400">
              Good Job!
            </h2>
            <p className="text-lg font-semibold text-foreground">
              You've Successfully Checked Out
            </p>
          </div>

          {/* Achievement Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 rounded-full border border-amber-200 dark:border-amber-800">
            <Award className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Day's Work Completed
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            {/* Time */}
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-green-100 dark:border-green-900/50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-muted-foreground">Checkout</span>
              </div>
              <p className="font-mono font-bold text-foreground">{checkoutTime}</p>
            </div>

            {/* Work Duration */}
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-green-100 dark:border-green-900/50">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-muted-foreground">Duration</span>
              </div>
              <p className="font-bold text-foreground">
                {workHours}h {workMinutes}m
              </p>
            </div>

            {/* Location */}
            <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border border-green-100 dark:border-green-900/50 col-span-2">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-xs font-medium text-muted-foreground">Location</span>
              </div>
              <p className="font-semibold text-foreground truncate">
                {isRemoteCheckout ? "Remote Checkout" : checkoutLocation}
              </p>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-6 text-base rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Done
          </Button>

          {/* Footer Message */}
          <p className="text-xs text-muted-foreground">
            Your attendance has been recorded and will appear in your reports shortly
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
