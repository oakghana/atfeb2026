"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin, QrCode, Download, Copy, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/components/ui/notification-system"

interface QREvent {
  id: string
  name: string
  description: string
  event_date: string
  start_time: string
  end_time: string
  location_id: string
  qr_code_data: string
  is_active: boolean
  created_at: string
  location_name?: string
}

interface Location {
  id: string
  name: string
  address: string
}

export function QRGenerator() {
  const [events, setEvents] = useState<QREvent[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    event_date: "",
    start_time: "",
    end_time: "",
    location_id: "",
  })

  const { showSuccess, showError } = useNotifications()
  const supabase = createClient()

  useEffect(() => {
    loadEvents()
    loadLocations()
  }, [])

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("qr_events")
        .select(`
          *,
          geofence_locations!inner(name)
        `)
        .order("created_at", { ascending: false })

      if (error) throw error

      const eventsWithLocation = data.map((event) => ({
        ...event,
        location_name: event.geofence_locations?.name,
      }))

      setEvents(eventsWithLocation)
    } catch (error) {
      console.error("Error loading events:", error)
      showError("Failed to load events")
    }
  }

  const loadLocations = async () => {
    try {
      const { data, error } = await supabase
        .from("geofence_locations")
        .select("id, name, address")
        .eq("is_active", true)
        .order("name")

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error("Error loading locations:", error)
      showError("Failed to load locations")
    }
  }

  const generateQRCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError || !user) {
        showError("Authentication required")
        return
      }

      // Generate unique QR code data
      const qrData = JSON.stringify({
        event_id: crypto.randomUUID(),
        name: formData.name,
        location_id: formData.location_id,
        date: formData.event_date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        created_at: new Date().toISOString(),
      })

      // Insert into database
      const { data, error } = await supabase
        .from("qr_events")
        .insert({
          name: formData.name,
          description: formData.description,
          event_date: formData.event_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          location_id: formData.location_id,
          qr_code_data: qrData,
          is_active: true,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) throw error

      showSuccess("QR code generated successfully!")
      setFormData({
        name: "",
        description: "",
        event_date: "",
        start_time: "",
        end_time: "",
        location_id: "",
      })
      loadEvents()
    } catch (error) {
      console.error("Error generating QR code:", error)
      showError("Failed to generate QR code")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleEventStatus = async (eventId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from("qr_events").update({ is_active: !currentStatus }).eq("id", eventId)

      if (error) throw error

      showSuccess(`Event ${!currentStatus ? "activated" : "deactivated"}`)
      loadEvents()
    } catch (error) {
      console.error("Error updating event status:", error)
      showError("Failed to update event status")
    }
  }

  const copyQRData = async (qrData: string) => {
    try {
      await navigator.clipboard.writeText(qrData)
      setCopied(true)
      showSuccess("QR data copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showError("Failed to copy QR data")
    }
  }

  const downloadQR = (eventName: string, qrData: string) => {
    const svg = document.getElementById(`qr-${eventName}`)?.innerHTML
    if (!svg) return

    const blob = new Blob([`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`], {
      type: "image/svg+xml",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${eventName}-qr-code.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* QR Code Generator Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Generate QR Code for Event
          </CardTitle>
          <CardDescription>Create a QR code for student attendance tracking at specific events</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={generateQRCode} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Morning Assembly"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Select
                  value={formData.location_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, location_id: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Event description (optional)"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event_date">Event Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, event_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time *</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData((prev) => ({ ...prev, start_time: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time *</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData((prev) => ({ ...prev, end_time: e.target.value }))}
                  required
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? "Generating..." : "Generate QR Code"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Generated QR Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Generated QR Codes</CardTitle>
          <CardDescription>Manage and download QR codes for your events</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No QR codes generated yet. Create your first event above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => (
                <Card key={event.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{event.name}</CardTitle>
                        <CardDescription className="text-sm">{event.location_name}</CardDescription>
                      </div>
                      <Badge variant={event.is_active ? "default" : "secondary"}>
                        {event.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* QR Code Display */}
                    <div className="flex justify-center p-4 bg-white rounded-lg">
                      <div id={`qr-${event.name}`}>
                        <QRCodeSVG value={event.qr_code_data} size={120} level="M" includeMargin={true} />
                      </div>
                    </div>

                    {/* Event Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(event.event_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {event.start_time} - {event.end_time}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {event.location_name}
                      </div>
                    </div>

                    {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadQR(event.name, event.qr_code_data)}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyQRData(event.qr_code_data)}
                        className="flex-1"
                      >
                        {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        Copy
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant={event.is_active ? "destructive" : "default"}
                      onClick={() => toggleEventStatus(event.id, event.is_active)}
                      className="w-full"
                    >
                      {event.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
