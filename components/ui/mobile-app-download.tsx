"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Smartphone, Download, Apple, Play, Globe, MapPin, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed"
    platform: string
  }>
  prompt(): Promise<void>
}

interface MobileAppDownloadProps {
  className?: string
  variant?: "sidebar" | "dashboard"
}

export function MobileAppDownload({ className, variant = "sidebar" }: MobileAppDownloadProps) {
  const [isInstalling, setIsInstalling] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const checkInstalled = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
      setIsInstalled(standalone)
      return standalone
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      const installed = checkInstalled()

      // Only handle prompt if not already installed
      if (!installed) {
        console.log("[PWA] Install prompt available")
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
      }
    }

    const handleAppInstalled = () => {
      console.log("[PWA] App installed successfully")
      setIsInstalled(true)
      setDeferredPrompt(null)
      setIsInstalling(false)
    }

    checkInstalled()

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkInstalled()
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  const handlePWAInstall = async () => {
    setIsInstalling(true)

    try {
      if (deferredPrompt) {
        console.log("[PWA] Showing install prompt")
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        console.log("[PWA] User choice:", outcome)

        if (outcome === "accepted") {
          console.log("[PWA] User accepted the install prompt")
          // Don't reset deferredPrompt here - let the appinstalled event handle it
        } else {
          console.log("[PWA] User dismissed the install prompt")
          setDeferredPrompt(null)
          setIsInstalling(false)
        }
      } else {
        // Provide manual installation instructions
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isAndroid = /Android/.test(navigator.userAgent)
        const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)

        let instructions = "📱 Install QCC Attendance App:\n\n"

        if (isIOS && isSafari) {
          instructions += "1. Tap the Share button (⬆️) at the bottom\n"
          instructions += "2. Scroll down and tap 'Add to Home Screen'\n"
          instructions += "3. Tap 'Add' to install the app\n\n"
        } else if (isAndroid) {
          instructions += "1. Tap the menu (⋮) in your browser\n"
          instructions += "2. Select 'Add to Home screen' or 'Install app'\n"
          instructions += "3. Tap 'Add' or 'Install' to confirm\n\n"
        } else {
          instructions += "1. Look for an install icon (⬇️) in your browser's address bar\n"
          instructions += "2. Click it and select 'Install'\n"
          instructions += "3. Or use your browser's menu to 'Install app'\n\n"
        }

        instructions += "✅ App Features:\n"
        instructions += "• Real-time GPS location tracking\n"
        instructions += "• Offline attendance recording\n"
        instructions += "• Push notifications\n"
        instructions += "• Native mobile experience\n"
        instructions += "• Instant proximity updates"

        alert(instructions)
        setIsInstalling(false)
      }
    } catch (error) {
      console.error("[PWA] Installation error:", error)
      setIsInstalling(false)
    }
  }

  const canInstall = deferredPrompt !== null && !isInstalled

  if (variant === "sidebar") {
    return (
      <div className={cn("px-4 pb-4", className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto p-4 bg-gradient-to-r from-accent/10 to-accent/5 border-accent/20 hover:from-accent/20 hover:to-accent/10 hover:border-accent/30 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] touch-manipulation min-h-[56px]"
            >
              <div className="relative">
                <div className="p-2 bg-accent/20 rounded-lg">
                  <Smartphone className="h-5 w-5 text-accent" />
                </div>
                <div className="absolute -top-1 -right-1">
                  {isInstalled ? (
                    <CheckCircle className="h-4 w-4 text-green-500 bg-background rounded-full" />
                  ) : (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-accent text-accent-foreground">
                      {canInstall ? "Ready" : "New"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">Mobile App</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {isInstalled ? "App Installed ✓" : canInstall ? "Ready to Install" : "Download & Install"}
                </p>
              </div>
              <Download className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 shadow-xl border-border/50 bg-background/95 backdrop-blur-xl"
          >
            <DropdownMenuLabel className="font-semibold flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-accent" />
              {isInstalled ? "QCC Attendance App Installed" : "QCC Attendance Mobile App"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/50" />

            <DropdownMenuItem
              onClick={handlePWAInstall}
              disabled={isInstalling || isInstalled}
              className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px]"
            >
              <div className="p-1.5 bg-primary/10 rounded-md">
                {isInstalled ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Globe className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <span className="font-medium">
                  {isInstalled ? "App Already Installed" : canInstall ? "Install Web App" : "Get Install Instructions"}
                </span>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {isInstalled ? "Real-time location tracking active" : "Includes real-time location tracking"}
                  </p>
                </div>
              </div>
              {isInstalling && (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border/50" />

            <DropdownMenuItem disabled className="flex items-center gap-3 px-3 py-3 opacity-50 rounded-lg min-h-[44px]">
              <div className="p-1.5 bg-muted/20 rounded-md">
                <Apple className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <span className="font-medium">iOS App Store</span>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
              <Badge variant="outline" className="text-xs">
                Soon
              </Badge>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border/50" />

            <DropdownMenuItem disabled className="flex items-center gap-3 px-3 py-3 opacity-50 rounded-lg min-h-[44px]">
              <div className="p-1.5 bg-muted/20 rounded-md">
                <Play className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <span className="font-medium">Google Play Store</span>
                <p className="text-xs text-muted-foreground">Coming soon</p>
              </div>
              <Badge variant="outline" className="text-xs">
                Soon
              </Badge>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border/50" />

            <div className="px-3 py-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Install the mobile app for offline access, push notifications, real-time location updates, and a native
                mobile experience.
              </p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  // Dashboard variant - floating action button style
  return (
    <div className={cn("fixed bottom-6 right-6 z-40", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-2xl bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent hover:shadow-3xl transition-all duration-300 hover:scale-110 touch-manipulation"
          >
            {isInstalled ? <CheckCircle className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-80 shadow-xl border-border/50 bg-background/95 backdrop-blur-xl mb-4"
        >
          <DropdownMenuLabel className="font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-accent" />
            {isInstalled ? "Mobile App Installed" : "Download Mobile App"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />

          <DropdownMenuItem
            onClick={handlePWAInstall}
            disabled={isInstalling || isInstalled}
            className="flex items-center gap-3 px-3 py-4 cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 touch-manipulation"
          >
            <div className="p-2 bg-primary/10 rounded-lg">
              {isInstalled ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Globe className="h-5 w-5 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <span className="font-medium text-base">
                {isInstalled ? "App Already Installed" : canInstall ? "Install Web App" : "Get Install Instructions"}
              </span>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isInstalled ? "Real-time location tracking active" : "Includes real-time location tracking"}
                </p>
              </div>
            </div>
            {isInstalling && (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border/50" />

          <DropdownMenuItem disabled className="flex items-center gap-3 px-3 py-4 opacity-50 rounded-lg">
            <div className="p-2 bg-muted/20 rounded-lg">
              <Apple className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-base">iOS App Store</span>
              <p className="text-sm text-muted-foreground">Native iOS app coming soon</p>
            </div>
            <Badge variant="outline" className="text-xs">
              Soon
            </Badge>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border/50" />

          <DropdownMenuItem disabled className="flex items-center gap-3 px-3 py-4 opacity-50 rounded-lg">
            <div className="p-2 bg-muted/20 rounded-lg">
              <Play className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-base">Google Play Store</span>
              <p className="text-sm text-muted-foreground">Native Android app coming soon</p>
            </div>
            <Badge variant="outline" className="text-xs">
              Soon
            </Badge>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
