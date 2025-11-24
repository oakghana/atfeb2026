"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Navigation, AlertTriangle, RefreshCw } from "lucide-react"
import { getCurrentLocation, detectWindowsLocationCapabilities } from "@/lib/geolocation"
import { useToast } from "@/hooks/use-toast"

export function GPSStatusBanner() {
  const [locationStatus, setLocationStatus] = useState<{
    hasLocation: boolean
    accuracy?: number
    isStale: boolean
    lastChecked?: number
  }>({
    hasLocation: false,
    isStale: true,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    checkGPSStatus()
  }, [])

  const checkGPSStatus = async () => {
    try {
      const location = await getCurrentLocation()
      const now = Date.now()
      setLocationStatus({
        hasLocation: true,
        accuracy: location.accuracy,
        isStale: false,
        lastChecked: now,
      })
    } catch (error) {
      setLocationStatus({
        hasLocation: false,
        isStale: true,
      })
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (locationStatus.lastChecked) {
        const timeSinceCheck = Date.now() - locationStatus.lastChecked
        if (timeSinceCheck > 5 * 60 * 1000) {
          // 5 minutes
          setLocationStatus((prev) => ({ ...prev, isStale: true }))
        }
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [locationStatus.lastChecked])

  const handleRefreshGPS = async () => {
    setIsRefreshing(true)
    try {
      const location = await getCurrentLocation()
      const now = Date.now()
      setLocationStatus({
        hasLocation: true,
        accuracy: location.accuracy,
        isStale: false,
        lastChecked: now,
      })

      toast({
        title: "GPS Updated",
        description: `Location refreshed successfully. Accuracy: ${Math.round(location.accuracy)}m`,
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: "GPS Update Failed",
        description: "Unable to update GPS location. Please check your browser settings.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const capabilities = detectWindowsLocationCapabilities()
  const showBanner =
    !locationStatus.hasLocation || locationStatus.isStale || (locationStatus.accuracy && locationStatus.accuracy > 200)

  if (!showBanner) {
    return null
  }

  return (
    <Alert className="mb-4 border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
        {!locationStatus.hasLocation ? "GPS Location Required" : "GPS Update Recommended"}
      </AlertTitle>
      <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200 space-y-3">
        {!locationStatus.hasLocation ? (
          <p>Your GPS location is not available. Please update your location to enable check-in/check-out.</p>
        ) : locationStatus.isStale ? (
          <p>Your GPS location may be outdated. Refresh it for accurate attendance tracking.</p>
        ) : (
          <p>
            Your GPS accuracy is {locationStatus.accuracy?.toFixed(0)}m. Refreshing may improve check-in reliability.
          </p>
        )}

        <Button
          onClick={handleRefreshGPS}
          disabled={isRefreshing}
          size="sm"
          className="bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
              Updating GPS...
            </>
          ) : (
            <>
              <Navigation className="h-3 w-3 mr-2" />
              Update GPS Location
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
