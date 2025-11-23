"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, X, CheckCheck, AlertCircle } from "lucide-react"
import Image from "next/image"

interface Notification {
  id: string
  sender_label: string
  message: string
  notification_type: string
  is_read: boolean
  created_at: string
}

export function StaffNotificationModal() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/staff/notifications")
      const result = await response.json()

      if (result.success) {
        const unreadNotifications = result.data.filter((n: Notification) => !n.is_read)
        setNotifications(result.data)

        // Show modal if there are unread notifications
        if (unreadNotifications.length > 0) {
          setShowModal(true)
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching notifications:", error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/staff/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_read: true }),
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)))
      }
    } catch (error) {
      console.error("[v0] Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/staff/notifications/mark-all-read", {
        method: "POST",
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      }
    } catch (error) {
      console.error("[v0] Error marking all as read:", error)
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  if (loading || notifications.length === 0) {
    return null
  }

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="max-w-2xl max-h-[80vh] p-0 gap-0 overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 border-4 border-[#8B4513]">
        {/* Header with Company Logo */}
        <div className="relative bg-gradient-to-r from-[#8B4513] via-[#A0522D] to-[#8B4513] p-6 text-white">
          <div className="absolute inset-0 bg-[url('/patterns/cocoa-pattern.svg')] opacity-10" />
          <div className="relative flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-full border-4 border-white shadow-xl bg-white p-1">
              <Image src="/images/qcc-logo.png" alt="QCC Logo" fill className="object-contain rounded-full" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl font-bold mb-1">Important Messages</DialogTitle>
              <p className="text-amber-100 text-sm">Quality Control Company Ltd - Attendance Notices</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowModal(false)}
              className="hover:bg-white/20 text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Notification List */}
        <div className="flex-1 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#8B4513]" />
              <span className="font-semibold text-[#8B4513]">
                {unreadCount} Unread Message{unreadCount !== 1 ? "s" : ""}
              </span>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs border-[#8B4513] text-[#8B4513] hover:bg-[#8B4513] hover:text-white bg-transparent"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark All Read
              </Button>
            )}
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`relative p-4 rounded-lg border-2 transition-all ${
                    notification.is_read ? "bg-white/50 border-gray-200" : "bg-white border-[#8B4513] shadow-md"
                  }`}
                >
                  {/* Sender Label */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={notification.sender_label.includes("Management") ? "destructive" : "default"}
                        className={
                          notification.sender_label.includes("Management")
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-blue-600 hover:bg-blue-700"
                        }
                      >
                        {notification.sender_label}
                      </Badge>
                      {!notification.is_read && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          New
                        </Badge>
                      )}
                    </div>
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        className="h-8 text-xs text-[#8B4513] hover:text-[#8B4513] hover:bg-amber-100"
                      >
                        Mark Read
                      </Button>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-sm leading-relaxed text-gray-700 mb-2">{notification.message}</p>

                  {/* Timestamp */}
                  <p className="text-xs text-gray-500">
                    {new Date(notification.created_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-[#8B4513] p-4 bg-gradient-to-r from-amber-50 to-yellow-50">
          <p className="text-xs text-center text-gray-600">
            Please ensure you check in and check out daily at your assigned location
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
