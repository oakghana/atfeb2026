"use client"

import { useState } from "react"
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
import { Smartphone, Download, Apple, Play, Globe, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileAppDownloadProps {
  className?: string
  variant?: "sidebar" | "dashboard"
}

export function MobileAppDownload({ className, variant = "sidebar" }: MobileAppDownloadProps) {
  const [isInstalling, setIsInstalling] = useState(false)

  const handlePWAInstall = async () => {
    setIsInstalling(true)

    // Check if PWA install prompt is available
    const deferredPrompt = (window as any).deferredPrompt
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        console.log("[PWA] User choice:", outcome)
      } catch (error) {
        console.error("[PWA] Error during installation:", error)
      }
    } else {
      // Show manual install instructions
      alert(
        "To install the app:\n\n1. Tap the share button in your browser\n2. Select 'Add to Home Screen'\n3. Tap 'Add' to install\n\nThe app includes real-time location tracking for accurate attendance recording.",
      )
    }

    setIsInstalling(false)
  }

  const isStandalone = () => {
    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
  }

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
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-accent text-accent-foreground">
                    New
                  </Badge>
                </div>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-foreground">Mobile App</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {isStandalone() ? "App Installed" : "Download & Install"}
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
              QCC Attendance Mobile App
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/50" />

            <DropdownMenuItem
              onClick={handlePWAInstall}
              disabled={isInstalling || isStandalone()}
              className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 touch-manipulation min-h-[44px]"
            >
              <div className="p-1.5 bg-primary/10 rounded-md">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <span className="font-medium">{isStandalone() ? "App Already Installed" : "Install Web App"}</span>
                <div className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    {isStandalone() ? "Real-time location tracking active" : "Includes real-time location tracking"}
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
            <Smartphone className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-80 shadow-xl border-border/50 bg-background/95 backdrop-blur-xl mb-4"
        >
          <DropdownMenuLabel className="font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-accent" />
            Download Mobile App
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-border/50" />

          <DropdownMenuItem
            onClick={handlePWAInstall}
            disabled={isInstalling || isStandalone()}
            className="flex items-center gap-3 px-3 py-4 cursor-pointer hover:bg-muted/50 rounded-lg transition-all duration-200 touch-manipulation"
          >
            <div className="p-2 bg-primary/10 rounded-lg">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <span className="font-medium text-base">
                {isStandalone() ? "App Already Installed" : "Install Web App"}
              </span>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isStandalone() ? "Real-time location tracking active" : "Includes real-time location tracking"}
                </p>
              </div>
            </div>
            {isInstalling && (
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            )}
          </DropdownMenuItem>

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
