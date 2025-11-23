"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AlertTriangle, CheckCircle2, X, AlertCircle } from "lucide-react"
import Image from "next/image"

interface StaffWarning {
  id: string
  sender_label: string
  sender_role: string
  subject: string
  message: string
  warning_type: string
  is_read: boolean
  created_at: string
  attendance_date: string | null
}

export function StaffWarningModal() {
  const [warnings, setWarnings] = useState<StaffWarning[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWarnings()
  }, [])

  const fetchWarnings = async () => {
    try {
      console.log("[v0] Fetching staff warnings...")
      const response = await fetch("/api/staff/warnings?unread_only=true")
      const result = await response.json()

      if (result.success && result.warnings && result.warnings.length > 0) {
        console.log("[v0] Unread warnings found:", result.warnings.length)
        setWarnings(result.warnings)
        setIsOpen(true)
      } else {
        console.log("[v0] No unread warnings")
      }
    } catch (error) {
      console.error("[v0] Error fetching warnings:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (warningId: string) => {
    try {
      await fetch(`/api/staff/warnings/${warningId}`, {
        method: "PATCH",
      })
      setWarnings((prev) => prev.filter((w) => w.id !== warningId))
      if (warnings.length <= 1) {
        setIsOpen(false)
      }
    } catch (error) {
      console.error("[v0] Error marking warning as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch("/api/staff/warnings/mark-all-read", {
        method: "POST",
      })
      setWarnings([])
      setIsOpen(false)
    } catch (error) {
      console.error("[v0] Error marking all warnings as read:", error)
    }
  }

  const getWarningIcon = (type: string) => {
    switch (type) {
      case "daily_absence":
      case "weekly_absence":
      case "no_checkout":
        return <AlertTriangle className="h-6 w-6 text-red-500" />
      case "early_checkout":
        return <AlertCircle className="h-6 w-6 text-orange-500" />
      default:
        return <AlertTriangle className="h-6 w-6 text-yellow-500" />
    }
  }

  const getWarningColor = (senderRole: string) => {
    return senderRole === "admin" ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"
  }

  if (loading || warnings.length === 0) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12">
                <Image src="/images/qcc-logo.png" alt="QCC Logo" fill className="object-contain" priority />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Official Notice from Quality Control Company Ltd
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {warnings.length} unread notification{warnings.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-primary hover:text-primary/80">
              Mark All Read
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-4 py-4">
            {warnings.map((warning) => (
              <div
                key={warning.id}
                className={`relative border-2 rounded-lg p-4 ${getWarningColor(warning.sender_role)} shadow-sm`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 h-6 w-6"
                  onClick={() => markAsRead(warning.id)}
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="flex items-start gap-3">
                  <div className="mt-1">{getWarningIcon(warning.warning_type)}</div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={
                          warning.sender_role === "admin"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : "bg-orange-100 text-orange-800 border-orange-300"
                        }
                      >
                        {warning.sender_label}
                      </Badge>
                      {warning.attendance_date && (
                        <span className="text-xs text-gray-600">
                          Date: {new Date(warning.attendance_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg text-gray-900">{warning.subject}</h3>

                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-white/50 rounded p-3 border border-gray-200">
                      {warning.message}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="text-xs text-gray-500">
                        Received: {new Date(warning.created_at).toLocaleString()}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => markAsRead(warning.id)} className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
