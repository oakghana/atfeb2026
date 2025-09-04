"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, MapPin, Shield, Save, Database, Bell } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface UserProfile {
  id: string
  role: string
  first_name: string
  last_name: string
}

interface SettingsClientProps {
  profile: UserProfile | null
}

export function SettingsClient({ profile }: SettingsClientProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [geoSettings, setGeoSettings] = useState({
    defaultRadius: "20",
    allowManualOverride: false,
    requireHighAccuracy: true,
    maxLocationAge: "300000", // 5 minutes
  })

  const [appSettings, setAppSettings] = useState({
    notifications: true,
    autoCheckOut: false,
    workingHours: {
      start: "08:00",
      end: "17:00",
    },
    theme: "system",
    language: "en",
  })

  const [systemSettings, setSystemSettings] = useState({
    maxAttendanceRadius: "20",
    sessionTimeout: "480", // 8 hours in minutes
    allowOfflineMode: false,
    requirePhotoVerification: false,
    enableAuditLog: true,
    backupFrequency: "daily",
  })

  const [notificationSettings, setNotificationSettings] = useState({
    checkInReminder: true,
    checkOutReminder: true,
    lateArrivalAlert: true,
    overtimeAlert: true,
    weeklyReport: true,
    reminderTime: "08:00",
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Load user-specific settings from database
        const { data: userSettings } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single()

        if (userSettings) {
          setAppSettings({ ...appSettings, ...userSettings.app_settings })
          setNotificationSettings({ ...notificationSettings, ...userSettings.notification_settings })
        }

        // Load system settings if admin
        if (profile?.role === "admin") {
          const { data: systemConfig } = await supabase.from("system_settings").select("*").single()

          if (systemConfig) {
            setSystemSettings({ ...systemSettings, ...systemConfig.settings })
            setGeoSettings({ ...geoSettings, ...systemConfig.geo_settings })
          }
        }
      }
    } catch (error) {
      console.error("Failed to load settings:", error)
      const savedSettings = localStorage.getItem("qcc-app-settings")
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        setAppSettings({ ...appSettings, ...parsed })
      }

      const savedSystemSettings = localStorage.getItem("qcc-system-settings")
      if (savedSystemSettings) {
        setSystemSettings({ ...systemSettings, ...JSON.parse(savedSystemSettings) })
      }

      const savedNotificationSettings = localStorage.getItem("qcc-notification-settings")
      if (savedNotificationSettings) {
        setNotificationSettings({ ...notificationSettings, ...JSON.parse(savedNotificationSettings) })
      }
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Save user settings
        const { error: userSettingsError } = await supabase.from("user_settings").upsert({
          user_id: user.id,
          app_settings: appSettings,
          notification_settings: notificationSettings,
          updated_at: new Date().toISOString(),
        })

        if (userSettingsError) throw userSettingsError

        // Save system settings if admin
        if (profile?.role === "admin") {
          const validatedRadius = Math.max(20, Number.parseInt(geoSettings.defaultRadius))
          const validatedGeoSettings = { ...geoSettings, defaultRadius: validatedRadius.toString() }

          const { error: systemSettingsError } = await supabase.from("system_settings").upsert({
            id: 1, // Single row for system settings
            settings: systemSettings,
            geo_settings: validatedGeoSettings,
            updated_at: new Date().toISOString(),
          })

          if (systemSettingsError) throw systemSettingsError

          // Update geofence locations with new default radius
          const { error: locationUpdateError } = await supabase
            .from("geofence_locations")
            .update({ radius_meters: validatedRadius })
            .eq("radius_meters", 20) // Update locations with default radius

          if (locationUpdateError) console.warn("Failed to update location radius:", locationUpdateError)
        }

        setSuccess("Settings saved successfully")
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (error) {
      console.error("Failed to save settings:", error)
      setError("Failed to save settings. Please try again.")

      // Fallback to localStorage
      localStorage.setItem("qcc-app-settings", JSON.stringify(appSettings))
      localStorage.setItem("qcc-notification-settings", JSON.stringify(notificationSettings))

      if (profile?.role === "admin") {
        localStorage.setItem("qcc-geo-settings", JSON.stringify(geoSettings))
        localStorage.setItem("qcc-system-settings", JSON.stringify(systemSettings))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your application preferences and system settings</p>
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

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>Configure your app preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={appSettings.theme}
                onValueChange={(value) => setAppSettings({ ...appSettings, theme: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="language">Language</Label>
              <Select
                value={appSettings.language}
                onValueChange={(value) => setAppSettings({ ...appSettings, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive notifications for attendance reminders</p>
              </div>
              <Switch
                id="notifications"
                checked={appSettings.notifications}
                onCheckedChange={(checked) => setAppSettings({ ...appSettings, notifications: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoCheckOut">Auto Check-out</Label>
                <p className="text-sm text-muted-foreground">Automatically check out at end of work day</p>
              </div>
              <Switch
                id="autoCheckOut"
                checked={appSettings.autoCheckOut}
                onCheckedChange={(checked) => setAppSettings({ ...appSettings, autoCheckOut: checked })}
              />
            </div>
          </div>

          <div>
            <Label>Working Hours</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <Label htmlFor="startTime" className="text-sm">
                  Start Time
                </Label>
                <Input
                  id="startTime"
                  type="time"
                  value={appSettings.workingHours.start}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      workingHours: { ...appSettings.workingHours, start: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="endTime" className="text-sm">
                  End Time
                </Label>
                <Input
                  id="endTime"
                  type="time"
                  value={appSettings.workingHours.end}
                  onChange={(e) =>
                    setAppSettings({
                      ...appSettings,
                      workingHours: { ...appSettings.workingHours, end: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>Configure your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="checkInReminder">Check-in Reminder</Label>
                <p className="text-sm text-muted-foreground">Daily reminder to check in</p>
              </div>
              <Switch
                id="checkInReminder"
                checked={notificationSettings.checkInReminder}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, checkInReminder: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="checkOutReminder">Check-out Reminder</Label>
                <p className="text-sm text-muted-foreground">Reminder to check out at end of day</p>
              </div>
              <Switch
                id="checkOutReminder"
                checked={notificationSettings.checkOutReminder}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, checkOutReminder: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="lateArrivalAlert">Late Arrival Alert</Label>
                <p className="text-sm text-muted-foreground">Alert when arriving late</p>
              </div>
              <Switch
                id="lateArrivalAlert"
                checked={notificationSettings.lateArrivalAlert}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, lateArrivalAlert: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="weeklyReport">Weekly Report</Label>
                <p className="text-sm text-muted-foreground">Receive weekly attendance summary</p>
              </div>
              <Switch
                id="weeklyReport"
                checked={notificationSettings.weeklyReport}
                onCheckedChange={(checked) =>
                  setNotificationSettings({ ...notificationSettings, weeklyReport: checked })
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reminderTime">Daily Reminder Time</Label>
            <Input
              id="reminderTime"
              type="time"
              value={notificationSettings.reminderTime}
              onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderTime: e.target.value })}
              className="mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {profile?.role === "admin" && (
        <>
          {/* System Settings - Admin Only */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                <Shield className="h-4 w-4 text-orange-500" />
                System Settings (Admin Only)
              </CardTitle>
              <CardDescription>Configure system-wide parameters and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="30"
                    max="720"
                    value={systemSettings.sessionTimeout}
                    onChange={(e) => setSystemSettings({ ...systemSettings, sessionTimeout: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground mt-1">Auto-logout after inactivity</p>
                </div>
                <div>
                  <Label htmlFor="backupFrequency">Data Backup Frequency</Label>
                  <Select
                    value={systemSettings.backupFrequency}
                    onValueChange={(value) => setSystemSettings({ ...systemSettings, backupFrequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="allowOfflineMode">Allow Offline Mode</Label>
                    <p className="text-sm text-muted-foreground">Enable attendance tracking without internet</p>
                  </div>
                  <Switch
                    id="allowOfflineMode"
                    checked={systemSettings.allowOfflineMode}
                    onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, allowOfflineMode: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requirePhotoVerification">Require Photo Verification</Label>
                    <p className="text-sm text-muted-foreground">Mandatory selfie for attendance</p>
                  </div>
                  <Switch
                    id="requirePhotoVerification"
                    checked={systemSettings.requirePhotoVerification}
                    onCheckedChange={(checked) =>
                      setSystemSettings({ ...systemSettings, requirePhotoVerification: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="enableAuditLog">Enable Audit Logging</Label>
                    <p className="text-sm text-muted-foreground">Track all system activities</p>
                  </div>
                  <Switch
                    id="enableAuditLog"
                    checked={systemSettings.enableAuditLog}
                    onCheckedChange={(checked) => setSystemSettings({ ...systemSettings, enableAuditLog: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Geolocation Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <Shield className="h-4 w-4 text-orange-500" />
                Advanced Geolocation Settings (Admin Only)
              </CardTitle>
              <CardDescription>Configure location tracking and geofencing parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="defaultRadius">Default Geofence Radius (meters)</Label>
                  <Input
                    id="defaultRadius"
                    type="number"
                    min="20"
                    max="500"
                    value={geoSettings.defaultRadius}
                    onChange={(e) => setGeoSettings({ ...geoSettings, defaultRadius: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Minimum distance for attendance scanning (minimum 20m)
                  </p>
                </div>
                <div>
                  <Label htmlFor="maxLocationAge">Max Location Age (milliseconds)</Label>
                  <Input
                    id="maxLocationAge"
                    type="number"
                    value={geoSettings.maxLocationAge}
                    onChange={(e) => setGeoSettings({ ...geoSettings, maxLocationAge: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground mt-1">Maximum age of cached location data</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requireHighAccuracy">Require High Accuracy GPS</Label>
                    <p className="text-sm text-muted-foreground">Force high accuracy location for attendance</p>
                  </div>
                  <Switch
                    id="requireHighAccuracy"
                    checked={geoSettings.requireHighAccuracy}
                    onCheckedChange={(checked) => setGeoSettings({ ...geoSettings, requireHighAccuracy: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="allowManualOverride">Allow Manual Location Override</Label>
                    <p className="text-sm text-muted-foreground">Permit manual attendance entry in emergencies</p>
                  </div>
                  <Switch
                    id="allowManualOverride"
                    checked={geoSettings.allowManualOverride}
                    onCheckedChange={(checked) => setGeoSettings({ ...geoSettings, allowManualOverride: checked })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
