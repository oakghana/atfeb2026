"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, Smartphone, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface InstallAppButtonProps {
  className?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg"
  showText?: boolean
}

export function InstallAppButton({
  className,
  variant = "default",
  size = "default",
  showText = true,
}: InstallAppButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      const isInWebAppiOS = (window.navigator as any).standalone === true
      const isInstalled = isStandalone || isInWebAppiOS
      setIsInstalled(isInstalled)
    }

    checkInstalled()

    // Listen for PWA install availability
    const handleInstallAvailable = (event: CustomEvent) => {
      console.log("[InstallButton] Install prompt available")
      setDeferredPrompt(event.detail)
    }

    // Listen for PWA installed event
    const handleInstalled = () => {
      console.log("[InstallButton] App installed")
      setIsInstalled(true)
      setDeferredPrompt(null)
      setIsInstalling(false)
    }

    window.addEventListener("pwa-install-available", handleInstallAvailable as EventListener)
    window.addEventListener("pwa-installed", handleInstalled)

    // Check if prompt is already available
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt)
    }

    return () => {
      window.removeEventListener("pwa-install-available", handleInstallAvailable as EventListener)
      window.removeEventListener("pwa-installed", handleInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Fallback for iOS or when prompt is not available
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        alert('To install this app on your iOS device, tap the Share button and then "Add to Home Screen".')
      } else {
        alert('To install this app, use your browser\'s "Add to Home Screen" or "Install" option in the menu.')
      }
      return
    }

    setIsInstalling(true)

    try {
      // Show the install prompt
      deferredPrompt.prompt()

      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice

      console.log(`[InstallButton] User response: ${outcome}`)

      if (outcome === "accepted") {
        console.log("[InstallButton] User accepted the install prompt")
      } else {
        console.log("[InstallButton] User dismissed the install prompt")
        setIsInstalling(false)
      }

      // Clear the deferredPrompt
      setDeferredPrompt(null)
      ;(window as any).deferredPrompt = null
    } catch (error) {
      console.error("[InstallButton] Error during installation:", error)
      setIsInstalling(false)
    }
  }

  // Don't show button if already installed
  if (isInstalled) {
    return showText ? (
      <Button variant="outline" size={size} className={cn("cursor-default", className)} disabled>
        <Check className="w-4 h-4 mr-2" />
        App Installed
      </Button>
    ) : null
  }

  return (
    <Button
      onClick={handleInstall}
      variant={variant}
      size={size}
      className={cn("transition-all duration-200", className)}
      disabled={isInstalling}
    >
      {isInstalling ? (
        <>
          <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {showText && "Installing..."}
        </>
      ) : (
        <>
          <Download className="w-4 h-4 mr-2" />
          {showText && "Install App"}
        </>
      )}
    </Button>
  )
}

// Mobile-specific install prompt component
export function MobileInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if we're on mobile and app is not installed
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    const isInWebAppiOS = (window.navigator as any).standalone === true
    const isInstalled = isStandalone || isInWebAppiOS

    setIsInstalled(isInstalled)

    if (isMobile && !isInstalled) {
      // Show prompt after a delay
      const timer = setTimeout(() => {
        setShowPrompt(true)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [])

  if (isInstalled || !showPrompt) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 p-4 bg-card border border-border rounded-lg shadow-lg">
      <div className="flex items-start gap-3">
        <Smartphone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground">Install QCC Attendance</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add this app to your home screen for quick access and offline functionality.
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <InstallAppButton variant="outline" size="sm" showText={false} className="h-8 w-8 p-0" />
          <Button variant="ghost" size="sm" onClick={() => setShowPrompt(false)} className="h-8 px-2 text-xs">
            Later
          </Button>
        </div>
      </div>
    </div>
  )
}
