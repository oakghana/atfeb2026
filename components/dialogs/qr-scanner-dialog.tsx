"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { QrCode, Camera, AlertTriangle, Loader2 } from "lucide-react"
import type { LocationData } from "@/lib/geolocation"

interface QRScannerDialogProps {
  open: boolean
  onClose: () => void
  mode: "checkin" | "checkout" | null
  userLocation: LocationData | null
}

export function QRScannerDialog({ open, onClose, mode, userLocation }: QRScannerDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const handleStartScanning = async () => {
    try {
      setIsScanning(true)
      setError(null)

      // Check if the browser supports camera access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported on this device")
      }

      // Request camera permission and open QR events page with scanner
      await navigator.mediaDevices.getUserMedia({ video: true })

      // Redirect to QR events page which will open the camera scanner
      window.location.href = `/dashboard/qr-events?mode=${mode || "checkin"}&autoScan=true`
    } catch (err) {
      console.error("[v0] Camera access error:", err)
      setError(err instanceof Error ? err.message : "Failed to access camera")
      setIsScanning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>QR Code Scanner</DialogTitle>
          <DialogDescription>Use your device camera to scan the QR code at your work location</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <QrCode className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">How to use QR Code Check-in</p>
                <p className="text-xs text-muted-foreground">Quick and easy camera scanning</p>
              </div>
            </div>

            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-semibold">1.</span>
                <span>Click the button below to open your device camera</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">2.</span>
                <span>Point your camera at the QR code displayed at your work location</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold">3.</span>
                <span>The system will automatically scan and record your attendance</span>
              </li>
            </ol>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button onClick={handleStartScanning} className="w-full h-12" size="lg" disabled={isScanning}>
              {isScanning ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Opening Camera...
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 mr-2" />
                  Open Camera to Scan QR Code
                </>
              )}
            </Button>

            <Button onClick={onClose} variant="outline" className="w-full bg-transparent">
              Cancel
            </Button>
          </div>

          {/* Additional Info */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> Make sure you have camera permissions enabled and are at your assigned work
              location before scanning. The camera will open automatically when you tap the button above.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
