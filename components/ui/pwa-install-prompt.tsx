"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, X, Smartphone, MapPin } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
      const wasDismissed = localStorage.getItem("pwa-install-dismissed") === "true"

      if (isStandalone) {
        setIsInstalled(true)
        setShowPrompt(false)
        // Clear dismissed flag if app is now installed
        localStorage.removeItem("pwa-install-dismissed")
      }

      return isStandalone
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      const installed = checkInstalled()

      // Only set deferred prompt if not already installed
      if (!installed) {
        setDeferredPrompt(e as BeforeInstallPromptEvent)

        // Show prompt after a delay if not dismissed before and not installed
        setTimeout(() => {
          const dismissed = localStorage.getItem("pwa-install-dismissed")
          if (!dismissed && !checkInstalled()) {
            setShowPrompt(true)
          }
        }, 5000)
      }
    }

    const handleShowPWAInstall = () => {
      const installed = checkInstalled()
      if (deferredPrompt && !installed) {
        setShowPrompt(true)
      }
    }

    const handleAppInstalled = () => {
      console.log("[PWA] App was installed")
      setShowPrompt(false)
      setIsInstalled(true)
      setDeferredPrompt(null)
      // Clear dismissed flag since app is now installed
      localStorage.removeItem("pwa-install-dismissed")
    }

    checkInstalled()

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkInstalled()
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    window.addEventListener("show-pwa-install", handleShowPWAInstall)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
      window.removeEventListener("show-pwa-install", handleShowPWAInstall)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [isInstalled, deferredPrompt])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      console.log("[PWA] User choice:", outcome)

      if (outcome === "accepted") {
        console.log("[PWA] User accepted the install prompt")
      } else {
        console.log("[PWA] User dismissed the install prompt")
        localStorage.setItem("pwa-install-dismissed", "true")
      }

      setShowPrompt(false)
      setDeferredPrompt(null)
    } catch (error) {
      console.error("[PWA] Error during installation:", error)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("pwa-install-dismissed", "true")
  }

  if (!showPrompt || isInstalled) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-2xl border-0">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Install QCC Attendance</CardTitle>
                <CardDescription className="text-primary-foreground/80 text-sm">
                  Get the full app experience with real-time location tracking
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="text-primary-foreground hover:bg-white/20 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="h-4 w-4 text-primary-foreground/90 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-primary-foreground/90">
              Install the QCC Attendance app for faster access, offline functionality, real-time location updates, and a
              native mobile experience.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              className="flex-1 bg-white text-primary hover:bg-white/90 font-semibold"
            >
              <Download className="h-4 w-4 mr-2" />
              Install App
            </Button>
            <Button variant="ghost" onClick={handleDismiss} className="text-primary-foreground hover:bg-white/20">
              Not Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
