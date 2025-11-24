"use client"

import type React from "react"
import Link from "next/link"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  MapPin,
  Plus,
  QrCode,
  Edit,
  AlertTriangle,
  Loader2,
  Navigation,
  Wifi,
  WifiOff,
  Power,
  Home,
} from "lucide-react"
import { generateQRCode, generateSignature, type QRCodeData } from "@/lib/qr-code"

interface GeofenceLocation {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
  qr_code?: string
}

export function LocationManagement() {
  const [locations, setLocations] = useState<GeofenceLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAddingLocation, setIsAddingLocation] = useState(false)
  const [editingLocation, setEditingLocation] = useState<GeofenceLocation | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<GeofenceLocation | null>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt" | null>(null)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [retryCount, setRetryCount] = useState(0)

  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius_meters: "50",
  })

  useEffect(() => {
    fetchLocations()
    checkLocationPermission()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const checkLocationPermission = async () => {
    if ("permissions" in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" })
        setLocationPermission(permission.state)

        permission.addEventListener("change", () => {
          setLocationPermission(permission.state)
        })
      } catch (error) {
        console.warn("Permission API not supported")
      }
    }
  }

  const validateLocationForm = useCallback((location: typeof newLocation): boolean => {
    const errors: Record<string, string> = {}

    if (!location.name.trim()) errors.name = "Location name is required"
    if (!location.address.trim()) errors.address = "Address is required"

    const lat = Number.parseFloat(location.latitude)
    const lng = Number.parseFloat(location.longitude)
    const radius = Number.parseInt(location.radius_meters)

    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.latitude = "Latitude must be between -90 and 90"
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      errors.longitude = "Longitude must be between -180 and 180"
    }
    if (isNaN(radius) || radius < 10 || radius > 10000) {
      errors.radius_meters = "Radius must be between 10 and 10,000 meters"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }, [])

  const fetchLocations = async (attempt = 1) => {
    try {
      if (!isOnline && attempt === 1) {
        throw new Error("No internet connection")
      }

      const response = await fetch("/api/admin/locations")
      if (!response.ok) {
        if (response.status >= 500 && attempt < 3) {
          throw new Error("RETRY")
        }
        throw new Error(`Failed to fetch locations (${response.status})`)
      }

      const data = await response.json()
      setLocations(Array.isArray(data) ? data : data.data || [])
      setError(null)
      setRetryCount(0)
    } catch (err) {
      if (err instanceof Error && err.message === "RETRY" && attempt < 3) {
        console.log(`[v0] Retrying fetch locations, attempt ${attempt + 1}`)
        setTimeout(() => fetchLocations(attempt + 1), 1000 * attempt)
        return
      }

      const errorMessage = err instanceof Error ? err.message : "Failed to load locations"
      setError(errorMessage)
      setRetryCount(attempt)
      setLocations([])
    } finally {
      if (attempt === 1) setLoading(false)
    }
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateLocationForm(newLocation)) return
    if (!isOnline) {
      setError("No internet connection. Please check your network and try again.")
      return
    }

    setLoading(true)
    setError(null)

    const attemptAdd = async (attempt: number): Promise<void> => {
      try {
        const response = await fetch("/api/admin/locations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            ...newLocation,
            latitude: Number.parseFloat(newLocation.latitude),
            longitude: Number.parseFloat(newLocation.longitude),
            radius_meters: Number.parseInt(newLocation.radius_meters),
          }),
        })

        if (response.status === 409) {
          const errorData = await response.json()
          setError(
            `⚠️ COORDINATE CONFLICT: ${errorData.error}\n\nA location already exists at or very near these coordinates. Please verify this is not a duplicate.`,
          )
          setLoading(false)
          return
        }

        if (!response.ok) {
          if (response.status >= 500 && attempt < 3) {
            throw new Error("RETRY")
          }
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Server error (${response.status})`)
        }

        setSuccess("✅ Location added successfully - Only this new location was created")
        await fetchLocations()
        setIsAddingLocation(false)
        setNewLocation({ name: "", address: "", latitude: "", longitude: "", radius_meters: "50" })
        setFormErrors({})
        setRetryCount(0)

        setTimeout(() => setSuccess(null), 5000)
      } catch (error) {
        if (error instanceof Error && error.message === "RETRY" && attempt < 3) {
          console.log(`[v0] Retrying add location, attempt ${attempt + 1}`)
          setTimeout(() => attemptAdd(attempt + 1), 1000 * attempt)
          return
        }

        const errorMessage = error instanceof Error ? error.message : "Failed to add location"
        setError(errorMessage)
        setRetryCount(attempt)
      }
    }

    await attemptAdd(1)
    setLoading(false)
  }

  const handleEditLocation = async () => {
    if (!editingLocation) return

    if (!validateLocationForm(editingLocation)) {
      setError("Please fix all form errors before saving")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/locations/${editingLocation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingLocation.name,
          address: editingLocation.address,
          latitude: editingLocation.latitude,
          longitude: editingLocation.longitude,
          radius_meters: editingLocation.radius_meters,
          is_active: editingLocation.is_active,
        }),
      })

      if (response.status === 409) {
        const errorData = await response.json()
        setError(
          `⚠️ COORDINATE CONFLICT: ${errorData.error}\n\nPlease verify:\n• You have the correct GPS coordinates\n• This is not a duplicate location\n• The location is actually different from: ${errorData.conflictingLocations?.join(", ")}`,
        )
        setLoading(false)
        return
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update location")
      }

      const result = await response.json()
      setSuccess(result.message || "Location updated successfully - Only this location was modified")
      await fetchLocations()
      setEditingLocation(null)

      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update location"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleLocation = async (location: GeofenceLocation) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: location.name,
          address: location.address,
          latitude: location.latitude,
          longitude: location.longitude,
          radius_meters: location.radius_meters,
          is_active: !location.is_active, // Toggle the active status
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update location status")
      }

      const action = location.is_active ? "deactivated" : "activated"
      setSuccess(`Location ${action} successfully - All staff dashboards will update automatically`)
      await fetchLocations()

      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update location status"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const generateLocationQR = async (location: GeofenceLocation) => {
    try {
      const timestamp = Date.now()
      const qrData: QRCodeData = {
        type: "location",
        locationId: location.id,
        timestamp,
        signature: generateSignature(location.id, timestamp),
      }

      const qrCodeDataUrl = await generateQRCode(qrData)
      setQrCodeUrl(qrCodeDataUrl)
      setSelectedLocation(location)
    } catch (err) {
      setError("Failed to generate QR code")
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser")
      return
    }

    if (locationPermission === "denied") {
      setError("Location access denied. Please enable location permissions in your browser settings.")
      return
    }

    setLoading(true)
    setError(null)

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords

        if (editingLocation) {
          setEditingLocation((prev) =>
            prev
              ? {
                  ...prev,
                  latitude,
                  longitude,
                }
              : null,
          )
        } else {
          setNewLocation((prev) => ({
            ...prev,
            latitude: latitude.toString(),
            longitude: longitude.toString(),
          }))
        }

        setSuccess("Location detected successfully")
        setTimeout(() => setSuccess(null), 3000)
        setLoading(false)
      },
      (error) => {
        let errorMessage = "Failed to get current location"

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please enable location permissions."
            setLocationPermission("denied")
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable. Please try again."
            break
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again."
            break
        }

        setError(errorMessage)
        setLoading(false)
      },
      options,
    )
  }

  const LocationSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-full" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  if (loading && locations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Location Management</h2>
            <p className="text-muted-foreground">Manage geofence locations and QR codes</p>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <LocationSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button asChild variant="outline" size="sm" className="shrink-0 bg-transparent">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <h2 className="text-xl sm:text-2xl font-bold">Location Management</h2>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Manage geofence locations and QR codes</span>
            {!isOnline && (
              <div className="flex items-center gap-1 text-orange-600">
                <WifiOff className="h-3 w-3" />
                <span>Offline</span>
              </div>
            )}
            {isOnline && (
              <div className="flex items-center gap-1 text-green-600">
                <Wifi className="h-3 w-3" />
                <span>Online</span>
              </div>
            )}
          </div>
        </div>

        <Dialog open={isAddingLocation} onOpenChange={setIsAddingLocation}>
          <DialogTrigger asChild>
            <Button disabled={!isOnline} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>Create a new geofence location for attendance tracking</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLocation} className="space-y-4">
              <div>
                <Label htmlFor="name">Location Name *</Label>
                <Input
                  id="name"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Main Campus"
                  required
                  className={formErrors.name ? "border-red-500" : ""}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {formErrors.name}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address"
                  required
                  className={formErrors.address ? "border-red-500" : ""}
                />
                {formErrors.address && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {formErrors.address}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude *</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={newLocation.latitude}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, latitude: e.target.value }))}
                    placeholder="25.2854"
                    required
                    className={formErrors.latitude ? "border-red-500" : ""}
                  />
                  {formErrors.latitude && (
                    <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {formErrors.latitude}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude *</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={newLocation.longitude}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, longitude: e.target.value }))}
                    placeholder="51.5310"
                    required
                    className={formErrors.longitude ? "border-red-500" : ""}
                  />
                  {formErrors.longitude && (
                    <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {formErrors.longitude}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="radius">Radius (meters) *</Label>
                <Input
                  id="radius"
                  type="number"
                  min="10"
                  max="10000"
                  value={newLocation.radius_meters}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, radius_meters: e.target.value }))}
                  placeholder="50"
                  required
                  className={formErrors.radius_meters ? "border-red-500" : ""}
                />
                {formErrors.radius_meters && (
                  <p className="text-sm text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {formErrors.radius_meters}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 50m for standard attendance tracking, 10-30m for specific rooms
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={getCurrentLocation}
                className="w-full bg-transparent"
                disabled={loading || locationPermission === "denied"}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <Navigation className="h-4 w-4 mr-2" />
                    Use Current Location
                  </>
                )}
              </Button>

              {locationPermission === "denied" && (
                <p className="text-sm text-orange-600 text-center">
                  Location access denied. Please enable in browser settings.
                </p>
              )}

              <div className="flex gap-2">
                <Button type="submit" disabled={loading || !isOnline} className="flex-1">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Location"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsAddingLocation(false)} className="flex-1">
                  Cancel
                </Button>
              </div>

              {retryCount > 0 && (
                <p className="text-sm text-orange-600 text-center">
                  Retried {retryCount} time(s). Please check your connection.
                </p>
              )}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            {retryCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => fetchLocations()} disabled={loading}>
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <Card key={location.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base sm:text-lg truncate">{location.name}</CardTitle>
                <Badge variant={location.is_active ? "default" : "secondary"}>
                  {location.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardDescription className="text-sm line-clamp-2">{location.address}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="grid grid-cols-2 gap-2">
                  <div>Lat: {location.latitude.toFixed(4)}</div>
                  <div>Lng: {location.longitude.toFixed(4)}</div>
                </div>
                <div>Radius: {location.radius_meters}m</div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => generateLocationQR(location)} className="flex-1">
                  <QrCode className="h-4 w-4 mr-1" />
                  QR Code
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingLocation(location)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant={location.is_active ? "destructive" : "default"}
                  onClick={() => handleToggleLocation(location)}
                  disabled={loading}
                  title={location.is_active ? "Deactivate location" : "Activate location"}
                >
                  <Power className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {locations.length === 0 && !loading && (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No locations found</h3>
          <p className="text-muted-foreground mb-4">
            Create your first geofence location to start tracking attendance.
          </p>
          <Button onClick={() => setIsAddingLocation(true)} disabled={!isOnline}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Location
          </Button>
        </div>
      )}

      {editingLocation && (
        <Dialog open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Location</DialogTitle>
              <DialogDescription>Update location information and settings</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editName">Location Name</Label>
                <Input
                  id="editName"
                  value={editingLocation.name}
                  onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                  placeholder="e.g., Main Campus"
                  required
                />
              </div>
              <div>
                <Label htmlFor="editAddress">Address</Label>
                <Input
                  id="editAddress"
                  value={editingLocation.address}
                  onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })}
                  placeholder="Full address"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editLatitude">Latitude</Label>
                  <Input
                    id="editLatitude"
                    type="number"
                    step="any"
                    value={editingLocation.latitude}
                    onChange={(e) =>
                      setEditingLocation({ ...editingLocation, latitude: Number.parseFloat(e.target.value) })
                    }
                    placeholder="25.2854"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editLongitude">Longitude</Label>
                  <Input
                    id="editLongitude"
                    type="number"
                    step="any"
                    value={editingLocation.longitude}
                    onChange={(e) =>
                      setEditingLocation({ ...editingLocation, longitude: Number.parseFloat(e.target.value) })
                    }
                    placeholder="51.5310"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="editRadius">Radius (meters)</Label>
                <Input
                  id="editRadius"
                  type="number"
                  value={editingLocation.radius_meters}
                  onChange={(e) =>
                    setEditingLocation({ ...editingLocation, radius_meters: Number.parseInt(e.target.value) })
                  }
                  placeholder="50"
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={getCurrentLocation} className="w-full bg-transparent">
                <MapPin className="h-4 w-4 mr-2" />
                Use Current Location
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingLocation(null)}>
                Cancel
              </Button>
              <Button onClick={handleEditLocation} disabled={loading}>
                Update Location
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {qrCodeUrl && (
        <Dialog open={!!qrCodeUrl} onOpenChange={() => setQrCodeUrl(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Location QR Code</DialogTitle>
              <DialogDescription>QR code for {selectedLocation?.name}</DialogDescription>
            </DialogHeader>
            {qrCodeUrl && (
              <div className="text-center space-y-4">
                <img src={qrCodeUrl || "/placeholder.svg"} alt="Location QR Code" className="mx-auto" />
                <div className="bg-muted/50 p-4 rounded-lg text-left space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    How to Use QR Code Check-In/Out
                  </h4>
                  <ol className="text-sm space-y-2 text-muted-foreground list-decimal list-inside">
                    <li>Go to the Attendance page in your dashboard</li>
                    <li>
                      Click on the <strong>"Scan QR Code"</strong> button
                    </li>
                    <li>Allow camera access when prompted</li>
                    <li>Point your camera at this QR code</li>
                    <li>
                      The system will verify you're within <strong>40 meters</strong> of the location
                    </li>
                    <li>If verified, you'll be checked in/out automatically</li>
                  </ol>
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      <strong>Note:</strong> You must be within 40 meters of {selectedLocation?.name} to use this QR
                      code. Location services must be enabled on your device.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    const link = document.createElement("a")
                    link.download = `${selectedLocation?.name}-qr-code.png`
                    link.href = qrCodeUrl
                    link.click()
                  }}
                >
                  Download QR Code
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
