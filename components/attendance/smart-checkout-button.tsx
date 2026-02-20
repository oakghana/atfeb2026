"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, LogOut, MapPin, Clock } from "lucide-react"
import { getDeviceInfo } from "@/lib/device-info"

interface SmartCheckoutButtonProps {
  attendanceRecord?: {
    approval_status?: "pending_supervisor_approval" | "approved_offpremises" | "normal_checkin"
    on_official_duty_outside_premises?: boolean
    id?: string
  } | null
  isAtQCCLocation: boolean
  isLoading: boolean
  onCheckOut: () => Promise<void>
  onOffPremisesCheckOut: () => Promise<void>
  userLocation: any
}

export function SmartCheckoutButton({
  attendanceRecord,
  isAtQCCLocation,
  isLoading,
  onCheckOut,
  onOffPremisesCheckOut,
  userLocation,
}: SmartCheckoutButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const isOffPremisesApproved = attendanceRecord?.approval_status === "approved_offpremises"
  const isOffPremisesPending = attendanceRecord?.approval_status === "pending_supervisor_approval"

  // Smart logic: show only ONE button
  const shouldShowOffPremisesCheckout = isOffPremisesApproved && !isAtQCCLocation
  const shouldShowNormalCheckout = !isOffPremisesApproved && !isOffPremisesPending
  const shouldDisableCheckout = isOffPremisesPending

  const handleClick = async () => {
    setIsProcessing(true)
    try {
      if (shouldShowOffPremisesCheckout) {
        await onOffPremisesCheckOut()
      } else {
        await onCheckOut()
      }
    } finally {
      setIsProcessing(false)
    }
  }

  if (shouldDisableCheckout) {
    return (
      <div className="space-y-2">
        <Button
          disabled={true}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white"
          size="lg"
        >
          <Clock className="mr-2 h-5 w-5" />
          Pending Supervisor Review
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Your off-premises request is awaiting approval. Check-out will be available after approval.
        </p>
      </div>
    )
  }

  if (!shouldShowNormalCheckout && !shouldShowOffPremisesCheckout) {
    return null
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading || isProcessing}
      className={`w-full ${
        shouldShowOffPremisesCheckout
          ? "bg-purple-600 hover:bg-purple-700"
          : "bg-red-600 hover:bg-red-700"
      } text-white shadow-lg`}
      size="lg"
      title={
        shouldShowOffPremisesCheckout
          ? "Check out from your off-premises location"
          : "Check out from your assigned location"
      }
    >
      {isLoading || isProcessing ? (
        <>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Checking Out...
        </>
      ) : shouldShowOffPremisesCheckout ? (
        <>
          <MapPin className="mr-2 h-5 w-5" />
          Check Out Off-Premises
        </>
      ) : (
        <>
          <LogOut className="mr-2 h-5 w-5" />
          Check Out
        </>
      )}
    </Button>
  )
}
