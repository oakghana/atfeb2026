"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LogOut, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickCheckoutButtonProps {
  isCheckedIn: boolean
  isCheckedOut: boolean
  isLoading?: boolean
  onQuickCheckout: () => Promise<void>
  className?: string
}

export function QuickCheckoutButton({
  isCheckedIn,
  isCheckedOut,
  isLoading = false,
  onQuickCheckout,
  className,
}: QuickCheckoutButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  if (!isCheckedIn || isCheckedOut) {
    return null
  }

  const handleQuickCheckout = async () => {
    setIsSubmitting(true)
    try {
      await onQuickCheckout()
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (error) {
      console.error("Quick checkout error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showSuccess) {
    return (
      <Button
        disabled
        className={cn(
          "w-full bg-green-600 hover:bg-green-600 text-white shadow-lg",
          className,
        )}
      >
        <CheckCircle2 className="w-4 h-4 mr-2" />
        Checked Out Successfully
      </Button>
    )
  }

  return (
    <Button
      onClick={handleQuickCheckout}
      disabled={isSubmitting || isLoading}
      className={cn(
        "w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg font-semibold",
        className,
      )}
      size="lg"
    >
      {isSubmitting ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Checking Out...
        </>
      ) : (
        <>
          <LogOut className="w-4 h-4 mr-2" />
          Check Out Now
        </>
      )}
    </Button>
  )
}
