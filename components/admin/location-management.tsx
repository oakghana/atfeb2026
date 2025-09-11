"use client"

import type React from "react"
import { safeParseFloat, safeParseInt, createAbortController } from "@/lib/safe-utils"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MapPin, Plus, QrCode, Edit } from "lucide-react"
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

  const [newLocation, setNewLocation] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius_meters: "100",
  })

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    try {
      const response = await fetch("/api/admin/locations")
      if (!response.ok) throw new Error("Failed to fetch locations")
      const data = await response.json()
      setLocations(data)
    } catch (err) {
      setError("Failed to load locations")
    } finally {
      setLoading(false)
    }
  }

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const latitude = safeParseFloat(newLocation.latitude)
    const longitude = safeParseFloat(newLocation.longitude)
    const radiusMeters = safeParseInt(newLocation.radius_meters)

    if (latitude === null || longitude === null || radiusMeters === null) {
      setError("Please enter valid numeric values for coordinates and radius")
      setLoading(false)
      return
    }

    if (latitude < -90 || latitude > 90) {
      setError("Latitude must be between -90 and 90 degrees")
      setLoading(false)
      return
    }

    if (longitude < -180 || longitude > 180) {
      setError("Longitude must be between -180 and 180 degrees")
      setLoading(false)
      return
    }

    if (radiusMeters < 1 || radiusMeters > 10000) {
      setError("Radius must be between 1 and 10,000 meters")
      setLoading(false)
      return
    }

    const controller = createAbortController(10000)

    try {
      const response = await fetch("/api/admin/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newLocation,
          latitude,
          longitude,
          radius_meters: radiusMeters,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to add location" }))
        throw new Error(errorData.error || "Failed to add location")
      }

      setSuccess("Location added successfully")
      await fetchLocations()
      setIsAddingLocation(false)
      setNewLocation({ name: "", address: "", latitude: "", longitude: "", radius_meters: "100" })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. Please try again.")
      } else {
        setError(err instanceof Error ? err.message : "Failed to add location")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEditLocation = async () => {
    if (!editingLocation) return

    setLoading(true)
    setError(null)

    console.log("[v0] Updating location:", editingLocation)

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

      console.log("[v0] Location update response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Location update failed:", errorData)
        throw new Error(errorData.error || "Failed to update location")
      }

      const result = await response.json()
      console.log("[v0] Location update successful:", result)

      setSuccess("Location updated successfully")
      await fetchLocations()
      setEditingLocation(null)
    } catch (err) {
      console.error("[v0] Location update error:", err)
      setError(err instanceof Error ? err.message : "Failed to update location")
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
      },
      (error) => {
        let message = "Failed to get current location"
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location access denied by user"
            break
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable"
            break
          case error.TIMEOUT:
            message = "Location request timed out"
            break
        }
        setError(message)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    )
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading locations...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Location Management</h2>
          <p className="text-muted-foreground">Manage geofence locations and QR codes</p>
        </div>
        <Dialog open={isAddingLocation} onOpenChange={setIsAddingLocation}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>Create a new geofence location for attendance tracking</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddLocation} className="space-y-4">
              <div>
                <Label htmlFor="name">Location Name</Label>
                <Input
                  id="name"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Main Campus"
                  required
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Full address"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={newLocation.latitude}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, latitude: e.target.value }))}
                    placeholder="25.2854"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={newLocation.longitude}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, longitude: e.target.value }))}
                    placeholder="51.5310"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="radius">Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={newLocation.radius_meters}
                  onChange={(e) => setNewLocation((prev) => ({ ...prev, radius_meters: e.target.value }))}
                  placeholder="100"
                  required
                />
              </div>
              <Button type="button" variant="outline" onClick={getCurrentLocation} className="w-full bg-transparent">
                <MapPin className="h-4 w-4 mr-2" />
                Use Current Location
              </Button>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>
                  Add Location
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsAddingLocation(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
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
                  placeholder="100"
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <Card key={location.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{location.name}</CardTitle>
                <Badge variant={location.is_active ? "default" : "secondary"}>
                  {location.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardDescription>{location.address}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>Lat: {location.latitude}</div>
                <div>Lng: {location.longitude}</div>
                <div>Radius: {location.radius_meters}m</div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" onClick={() => generateLocationQR(location)}>
                  <QrCode className="h-4 w-4 mr-1" />
                  QR Code
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingLocation(location)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* QR Code Display Dialog */}
      <Dialog open={!!qrCodeUrl} onOpenChange={() => setQrCodeUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Location QR Code</DialogTitle>
            <DialogDescription>QR code for {selectedLocation?.name}</DialogDescription>
          </DialogHeader>
          {qrCodeUrl && (
            <div className="text-center space-y-4">
              <img src={qrCodeUrl || "/placeholder.svg"} alt="Location QR Code" className="mx-auto" />
              <p className="text-sm text-muted-foreground">Staff can scan this QR code to check in at this location</p>
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
    </div>
  )
}
