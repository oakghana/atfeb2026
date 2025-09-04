"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { QrCode, Calendar, MapPin, Users, Plus, Search } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { QRScanner } from "@/components/qr/qr-scanner"

interface QREvent {
  id: string
  title: string
  description: string
  location: string
  event_date: string
  qr_code: string
  is_active: boolean
  created_at: string
  attendees_count?: number
}

export function QREventsClient() {
  const [events, setEvents] = useState<QREvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    location: "",
    event_date: "",
  })

  const supabase = createClient()

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase.from("qr_events").select("*").order("event_date", { ascending: false })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error("Error fetching events:", error)
    } finally {
      setLoading(false)
    }
  }

  const createEvent = async () => {
    try {
      const qrCode = `QCC-EVENT-${Date.now()}`

      const { data, error } = await supabase
        .from("qr_events")
        .insert([
          {
            ...newEvent,
            qr_code: qrCode,
            is_active: true,
          },
        ])
        .select()

      if (error) throw error

      setEvents([...events, data[0]])
      setNewEvent({ title: "", description: "", location: "", event_date: "" })
      setShowCreateForm(false)
    } catch (error) {
      console.error("Error creating event:", error)
    }
  }

  const handleQRScan = (result: string) => {
    console.log("QR Code scanned:", result)
    // Handle QR code scan result
    setShowScanner(false)
  }

  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading QR events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">QR Events</h1>
          <p className="text-muted-foreground">Manage QR code-based event attendance</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowScanner(true)} variant="outline">
            <QrCode className="h-4 w-4 mr-2" />
            Scan QR
          </Button>
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Events</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by title or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Event Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New QR Event</CardTitle>
            <CardDescription>Set up a new event with QR code attendance tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  placeholder="Enter event title"
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  placeholder="Event location"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Event description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="event_date">Event Date & Time</Label>
              <Input
                id="event_date"
                type="datetime-local"
                value={newEvent.event_date}
                onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createEvent}>Create Event</Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Scan QR Code</CardTitle>
              <CardDescription>Position the QR code within the camera frame</CardDescription>
            </CardHeader>
            <CardContent>
              <QRScanner onScan={handleQRScan} />
              <Button variant="outline" onClick={() => setShowScanner(false)} className="w-full mt-4">
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events List */}
      <div className="grid gap-4">
        {filteredEvents.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No QR Events Found</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "No events match your search criteria." : "Create your first QR event to get started."}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Event
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{event.title}</h3>
                      <Badge variant={event.is_active ? "default" : "secondary"}>
                        {event.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mb-3">{event.description}</p>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(event.event_date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {event.location}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {event.attendees_count || 0} attendees
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <QrCode className="h-4 w-4 mr-2" />
                      View QR
                    </Button>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
