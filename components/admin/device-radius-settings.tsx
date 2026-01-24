"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Smartphone, Tablet, Laptop, Monitor, Save, Info, MapPin } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface DeviceRadiusSetting {
  id: string
  device_type: string
  check_in_radius_meters: number
  check_out_radius_meters: number
  description: string
  is_active: boolean
}

interface DeviceRadiusSettingsProps {
  initialSettings: DeviceRadiusSetting[]
}

const deviceIcons = {
  mobile: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  desktop: Monitor,
}

const deviceLabels = {
  mobile: "Mobile Phones",
  tablet: "Tablets",
  laptop: "Laptops",
  desktop: "Desktop Computers",
}

export function DeviceRadiusSettings({ initialSettings }: DeviceRadiusSettingsProps) {
  const [settings, setSettings] = useState<DeviceRadiusSetting[]>(initialSettings)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleUpdate = (deviceType: string, field: "check_in_radius_meters" | "check_out_radius_meters", value: number) => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.device_type === deviceType
          ? {
              ...setting,
              [field]: value,
            }
          : setting,
      ),
    )
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/device-radius-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error("Failed to update settings")
      }

      toast({
        title: "Settings Updated",
        description: "Device radius settings have been updated successfully.",
      })
    } catch (error) {
      console.error("[v0] Error updating device radius settings:", error)
      toast({
        title: "Error",
        description: "Failed to update device radius settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 dark:bg-blue-900/60 border-blue-200 dark:border-blue-500/50">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-300" />
        <AlertDescription className="text-blue-800 dark:text-blue-100">
          <strong>Important:</strong> These settings define how close users must be to a QCC location to check in or
          check out. Larger values allow more flexibility but may reduce accuracy. These radiuses override any
          individual location radius settings.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {settings.map((setting) => {
          const Icon = deviceIcons[setting.device_type as keyof typeof deviceIcons]
          const label = deviceLabels[setting.device_type as keyof typeof deviceLabels]

          return (
            <Card key={setting.id} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-lg p-3">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{label}</CardTitle>
                      <CardDescription>{setting.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${setting.device_type}-check-in`} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Check-In Radius (meters)
                  </Label>
                  <Input
                    id={`${setting.device_type}-check-in`}
                    type="number"
                    min="50"
                    max="5000"
                    step="50"
                    value={setting.check_in_radius_meters}
                    onChange={(e) =>
                      handleUpdate(setting.device_type, "check_in_radius_meters", parseInt(e.target.value) || 0)
                    }
                    className="font-mono text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Range: 50m - 5000m. Currently: {setting.check_in_radius_meters}m
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${setting.device_type}-check-out`} className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-red-600" />
                    Check-Out Radius (meters)
                  </Label>
                  <Input
                    id={`${setting.device_type}-check-out`}
                    type="number"
                    min="50"
                    max="5000"
                    step="50"
                    value={setting.check_out_radius_meters}
                    onChange={(e) =>
                      handleUpdate(setting.device_type, "check_out_radius_meters", parseInt(e.target.value) || 0)
                    }
                    className="font-mono text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Range: 50m - 5000m. Currently: {setting.check_out_radius_meters}m
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={loading} size="lg" className="gap-2">
          <Save className="h-5 w-5" />
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
