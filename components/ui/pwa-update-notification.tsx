"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, RefreshCw } from "lucide-react"

export function PWAUpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return
    }

    const checkForUpdates = async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        setRegistration(reg)

        // Check for updates every 60 seconds
        setInterval(() => {
          reg.update()
        }, 60000)

        // Listen for new service worker waiting
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing

          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                // New service worker is ready to take over
                setShowUpdate(true)
              }
            })
          }
        })

        // Check if there's already a waiting service worker
        if (reg.waiting) {
          setShowUpdate(true)
        }
      } catch (error) {
        console.error("[PWA] Failed to check for updates:", error)
      }
    }

    // Listen for service worker activation messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "SW_ACTIVATED") {
        console.log("[PWA] New version activated:", event.data.version)
        // Reload the page to use the new version
        window.location.reload()
      }
    }

    navigator.serviceWorker.addEventListener("message", handleMessage)
    checkForUpdates()

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage)
    }
  }, [])

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: "SKIP_WAITING" })
      setShowUpdate(false)
    }
  }

  const handleDismiss = () => {
    setShowUpdate(false)
  }

  if (!showUpdate) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <Card className="border-primary bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <RefreshCw className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Update Available</h3>
              <p className="text-muted-foreground text-xs">
                A new version of QCC Attendance is available. Update now to get the latest features and improvements.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdate} className="h-8">
                Update Now
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8">
                Later
              </Button>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={handleDismiss} className="h-6 w-6 shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  )
}
