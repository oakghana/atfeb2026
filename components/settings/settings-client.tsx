"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Settings, MapPin, Shield, Save, Database, Bell, LogOut, AlertTriangle, Globe, Info } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PasswordManagement } from "@/components/admin/password-management"
import { useRouter } from "next/navigation"
import { useNotifications } from "@/components/ui/notification-system"
import { clearAppCache, clearCacheAndReload } from "@/lib/cache-manager"

interface UserProfile {
  id: string
  role: string
  first_name: string
  last_name: string
}

interface SettingsClientProps {
  initialSettings: any
}

export function SettingsClient({ initialSettings }: SettingsClientProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { showSuccess, showError, showInfo } = useNotifications()

  const [geoSettings, setGeoSettings] = useState({
    defaultRadius: "20",
    allowManualOverride: false,
    requireHighAccuracy: true,
    maxLocationAge: "300000",
    checkInProximityRange: "50",
    globalProximityDistance: "1000",
    enableBrowserSpecificTolerance: true,
    browserTolerances: {
      chrome: 1000,
      edge: 300,
      firefox: 1000,
      safari: 1000,
      opera: 1000,
      default: 1000,
    },
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
    sessionTimeout: "480",
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
    console.log("[v0] SettingsClient useEffect triggered")
    loadSettings()

    if (initialSettings.profile?.role !== "admin") {
      const supabase = createClient()

      // Listen for admin settings updates
      const channel = supabase
        .channel("system_notifications")
        .on("broadcast", { event: "admin_settings_updated" }, (payload) => {
          console.log("[v0] Received admin settings update:", payload)

          showInfo(
            `System settings have been updated by ${payload.payload.admin_name}. Changes will take effect immediately.`,
            "Settings Updated",
          )

          // Reload settings to get the latest changes
          loadSettings()
        })
        .subscribe()

      // Listen for direct database changes to system_settings table
      const settingsChannel = supabase
        .channel("settings_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "system_settings",
          },
          (payload) => {
            console.log("[v0] System settings database change detected:", payload)

            if (payload.eventType === "UPDATE") {
              showInfo("System settings have been updated. Refreshing your settings...", "Settings Refreshed")

              // Reload settings after a short delay to ensure consistency
              setTimeout(() => {
                loadSettings()
              }, 1000)
            }
          },
        )
        .subscribe()

      return () => {
        console.log("[v0] Cleaning up real-time subscriptions")
        supabase.removeChannel(channel)
        supabase.removeChannel(settingsChannel)
      }
    }
  }, [initialSettings.profile])

  const loadSettings = async () => {
    console.log("[v0] Loading settings...")
    try {
      const response = await fetch("/api/settings")
      console.log("[v0] Settings API response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Settings loaded from API:", data)

        if (data.userSettings) {
          setAppSettings({ ...appSettings, ...data.userSettings.app_settings })
          setNotificationSettings({ ...notificationSettings, ...data.userSettings.notification_settings })
        }

        if (data.systemSettings && data.isAdmin) {
          setSystemSettings({ ...systemSettings, ...data.systemSettings.settings })
          setGeoSettings({ ...geoSettings, ...data.systemSettings.geo_settings })
        }
      } else {
        throw new Error("Failed to load settings from API")
      }
    } catch (error) {
      console.error("[v0] Failed to load settings from API:", error)

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
        if (initialSettings.profile?.role === "admin") {
          const { data: systemConfig } = await supabase.from("system_settings").select("*").single()

          if (systemConfig) {
            setSystemSettings({ ...systemSettings, ...systemConfig.settings })
            setGeoSettings({ ...geoSettings, ...systemConfig.geo_settings })
          }
        }
      }

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
      console.log("[v0] Settings loading complete")
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userSettings: {
            app_settings: appSettings,
            notification_settings: notificationSettings,
          },
          systemSettings:
            initialSettings.profile?.role === "admin"
              ? {
                  settings: systemSettings,
                  geo_settings: geoSettings,
                }
              : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save settings")
      }

      const result = await response.json()
      console.log("[v0] Settings saved successfully:", result)

      if (initialSettings.profile?.role === "admin") {
        showSuccess(
          "Settings have been saved and will be applied to all staff members immediately.",
          "Admin Settings Saved",
        )

        const supabase = createClient()
        await supabase.channel("system_notifications").send({
          type: "broadcast",
          event: "admin_settings_updated",
          payload: {
            message: "System settings have been updated by administrator",
            timestamp: new Date().toISOString(),
            admin_name: `${initialSettings.profile.first_name} ${initialSettings.profile.last_name}`,
          },
        })
      } else {
        showSuccess("Your personal settings have been saved successfully.", "Settings Saved")
      }

      setSuccess("Settings saved successfully")
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      console.error("[v0] Failed to save settings:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      showError(`Failed to save settings: ${errorMessage}`, "Save Failed")
      setError(`Failed to save settings: ${errorMessage}`)

      localStorage.setItem("qcc-app-settings", JSON.stringify(appSettings))
      localStorage.setItem("qcc-notification-settings", JSON.stringify(notificationSettings))

      if (initialSettings.profile?.role === "admin") {
        localStorage.setItem("qcc-geo-settings", JSON.stringify(geoSettings))
        localStorage.setItem("qcc-system-settings", JSON.stringify(systemSettings))
      }
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setError(null)

    try {
      await clearAppCache()

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to logout from server")
      }

      const supabase = createClient()
      const { error: clientSignOutError } = await supabase.auth.signOut()

      if (clientSignOutError) {
        console.error("Client sign out error:", clientSignOutError)
      }

      window.location.href = "/auth/login"
    } catch (error) {
      console.error("Logout error:", error)
      setError(`Failed to logout: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setLoggingOut(false)
    }
  }

  const handleClearCache = async () => {
    setClearingCache(true)
    setError(null)

    try {
      await clearCacheAndReload()
    } catch (error) {
      console.error("Cache clearing error:", error)
      setError(`Failed to clear cache: ${error instanceof Error ? error.message : "Unknown error"}`)
      setClearingCache(false)
    }
  }

  if (loading) {
    console.log("[v0] SettingsClient showing loading state")
    return <div className="flex justify-center items-center h-64">Loading settings...</div>
  }

  console.log("[v0] SettingsClient rendering main content")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-primary">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your application preferences and system settings</p>
        </div>
        {/* Logout Button */}
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-2 bg-transparent"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out..." : "Sign Out"}
        </Button>
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

      {/* Password Management Component */}
      {initialSettings.profile && (
        <PasswordManagement
          userId={initialSettings.profile.id}
          userEmail={`${initialSettings.profile.first_name} ${initialSettings.profile.last_name}`}
          isAdmin={initialSettings.profile.role === "admin"}
        />
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

      {initialSettings.profile?.role === "admin" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                <Shield className="h-4 w-4 text-blue-500" />
                Browser-Specific GPS Tolerance (Admin Only)
              </CardTitle>
              <CardDescription>
                Configure different proximity tolerances for each browser to account for GPS accuracy variations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label htmlFor="enableBrowserSpecificTolerance" className="text-base font-semibold">
                    Enable Browser-Specific Tolerances
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically adjust GPS acceptance distance based on user's browser
                  </p>
                </div>
                <Switch
                  id="enableBrowserSpecificTolerance"
                  checked={geoSettings.enableBrowserSpecificTolerance}
                  onCheckedChange={(checked) =>
                    setGeoSettings({ ...geoSettings, enableBrowserSpecificTolerance: checked })
                  }
                />
              </div>

              {geoSettings.enableBrowserSpecificTolerance && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="chromeTolerance" className="flex items-center gap-2">
                        <span className="text-green-600">●</span> Chrome (meters)
                      </Label>
                      <Input
                        id="chromeTolerance"
                        type="number"
                        min="50"
                        max="5000"
                        value={geoSettings.browserTolerances.chrome}
                        onChange={(e) =>
                          setGeoSettings({
                            ...geoSettings,
                            browserTolerances: {
                              ...geoSettings.browserTolerances,
                              chrome: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">Good accuracy - Recommended: 1000m</p>
                    </div>

                    <div>
                      <Label htmlFor="edgeTolerance" className="flex items-center gap-2">
                        <span className="text-blue-600">●</span> Edge (meters)
                      </Label>
                      <Input
                        id="edgeTolerance"
                        type="number"
                        min="50"
                        max="5000"
                        value={geoSettings.browserTolerances.edge}
                        onChange={(e) =>
                          setGeoSettings({
                            ...geoSettings,
                            browserTolerances: {
                              ...geoSettings.browserTolerances,
                              edge: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">Better accuracy - Recommended: 300m</p>
                    </div>

                    <div>
                      <Label htmlFor="firefoxTolerance" className="flex items-center gap-2">
                        <span className="text-orange-600">●</span> Firefox (meters)
                      </Label>
                      <Input
                        id="firefoxTolerance"
                        type="number"
                        min="50"
                        max="5000"
                        value={geoSettings.browserTolerances.firefox}
                        onChange={(e) =>
                          setGeoSettings({
                            ...geoSettings,
                            browserTolerances: {
                              ...geoSettings.browserTolerances,
                              firefox: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">Good accuracy - Recommended: 1000m</p>
                    </div>

                    <div>
                      <Label htmlFor="safariTolerance" className="flex items-center gap-2">
                        <span className="text-purple-600">●</span> Safari (meters)
                      </Label>
                      <Input
                        id="safariTolerance"
                        type="number"
                        min="50"
                        max="5000"
                        value={geoSettings.browserTolerances.safari}
                        onChange={(e) =>
                          setGeoSettings({
                            ...geoSettings,
                            browserTolerances: {
                              ...geoSettings.browserTolerances,
                              safari: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">Variable - Recommended: 1000m</p>
                    </div>

                    <div>
                      <Label htmlFor="operaTolerance" className="flex items-center gap-2">
                        <span className="text-red-600">●</span> Opera (meters)
                      </Label>
                      <Input
                        id="operaTolerance"
                        type="number"
                        min="50"
                        max="5000"
                        value={geoSettings.browserTolerances.opera}
                        onChange={(e) =>
                          setGeoSettings({
                            ...geoSettings,
                            browserTolerances: {
                              ...geoSettings.browserTolerances,
                              opera: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground mt-1">Lower accuracy - Recommended: 1000m</p>
                    </div>
                  </div>

                  <div className="p-4 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-800 dark:text-blue-200">How Browser Tolerances Work</p>
                        <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                          <li>System automatically detects which browser the user is using</li>
                          <li>Applies the appropriate tolerance distance for that browser</li>
                          <li>Edge users only need to be within {geoSettings.browserTolerances.edge}m</li>
                          <li>Chrome users only need to be within {geoSettings.browserTolerances.chrome}m</li>
                          <li>Firefox users only need to be within {geoSettings.browserTolerances.firefox}m</li>
                          <li>Opera users only need to be within {geoSettings.browserTolerances.opera}m</li>
                          <li>All users still see "50m radius" in the UI for consistency</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Global Proximity Settings (Admin Only) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                <Shield className="h-4 w-4 text-orange-500" />
                Global Proximity Settings (Admin Only)
              </CardTitle>
              <CardDescription>
                {geoSettings.enableBrowserSpecificTolerance
                  ? "Reference distance shown to users (actual tolerance varies by browser)"
                  : "Configure proximity distance that applies to ALL staff members consistently"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-1">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <Label htmlFor="globalProximityDistance" className="text-base font-semibold">
                    Global Proximity Distance (meters)
                  </Label>
                  <Input
                    id="globalProximityDistance"
                    type="number"
                    min="50"
                    max="2000"
                    value={geoSettings.checkInProximityRange}
                    onChange={(e) =>
                      setGeoSettings({
                        ...geoSettings,
                        checkInProximityRange: e.target.value,
                        globalProximityDistance: e.target.value,
                      })
                    }
                    className="mt-2 text-lg font-medium"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    <strong>This distance applies to ALL staff members consistently.</strong>
                    <br />
                    Staff can check in when they are within this distance from any QCC location.
                    <br />
                    Recommended: 50-100m for strict control, 200-500m for general use.
                  </p>
                  <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      ✓ Current setting: {geoSettings.checkInProximityRange}m proximity for all users
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Individual location radius settings are now used for reference only
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="requireHighAccuracy">Require High Accuracy GPS</Label>
                    <Switch
                      id="requireHighAccuracy"
                      checked={geoSettings.requireHighAccuracy}
                      onCheckedChange={(checked) => setGeoSettings({ ...geoSettings, requireHighAccuracy: checked })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="allowManualOverride">Allow Manual Location Override</Label>
                    <Switch
                      id="allowManualOverride"
                      checked={geoSettings.allowManualOverride}
                      onCheckedChange={(checked) => setGeoSettings({ ...geoSettings, allowManualOverride: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800 dark:text-orange-200">Proximity Distance Consistency</p>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      The global proximity distance setting above will be applied to ALL staff members immediately when
                      saved. Individual location radius settings are maintained for reference but do not affect
                      attendance validation.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
        </>
      )}

      {/* Cache Management Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Cache Management
          </CardTitle>
          <CardDescription>
            Clear app cache to ensure you're running the latest version. This will reload the page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="space-y-1">
              <p className="text-sm font-medium">Clear Application Cache</p>
              <p className="text-xs text-muted-foreground">
                Removes stored data and forces the app to refresh with the latest version
              </p>
            </div>
            <Button variant="secondary" onClick={handleClearCache} disabled={clearingCache} className="ml-4">
              {clearingCache ? "Clearing..." : "Clear Cache"}
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">What gets cleared:</h4>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Cached pages and resources</li>
              <li>• Local storage data</li>
              <li>• Session storage</li>
              <li>• Service worker cache</li>
              <li>• IndexedDB data</li>
            </ul>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              Note: Clearing cache will log you out and reload the page
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-between items-center">
        <Button variant="destructive" onClick={handleLogout} disabled={loggingOut} className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out..." : "Sign Out"}
        </Button>

        <Button onClick={saveSettings} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  )
}
