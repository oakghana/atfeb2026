"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { User, Mail, Phone, MapPin, Building, Save, Camera, Lock, Key } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  employee_id: string
  position: string
  phone_number?: string
  role: string
  is_active: boolean
  profile_image_url?: string
  departments?: {
    id: string
    name: string
    code: string
  }
  districts?: {
    id: string
    name: string
  }
}

export function ProfileClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPasswordChange, setShowPasswordChange] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profileData, error } = await supabase
          .from("user_profiles")
          .select(`
            *,
            departments (
              id,
              name,
              code
            ),
            districts (
              id,
              name
            )
          `)
          .eq("id", user.id)
          .single()

        if (error) throw error

        setProfile(profileData)
        setEditForm({
          first_name: profileData.first_name || "",
          last_name: profileData.last_name || "",
        })
      }
    } catch (error) {
      setError("Failed to load profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("user_profiles")
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)

      if (error) throw error

      setSuccess("Profile updated successfully")
      setIsEditing(false)
      fetchProfile() // Refresh profile data
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      setError("Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("New passwords do not match")
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setError("Password must be at least 6 characters long")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      })

      if (error) throw error

      setSuccess("Password updated successfully")
      setShowPasswordChange(false)
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setTimeout(() => setSuccess(null), 3000)
    } catch (error) {
      setError("Failed to update password")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading profile...</div>
  }

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    )
  }

  const userInitials = `${profile.first_name[0]}${profile.last_name[0]}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-primary">Profile Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your personal information and account details</p>
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

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          <CardDescription>Your QCC account details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.profile_image_url || "/placeholder.svg"} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">{userInitials}</AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm">
                <Camera className="mr-2 h-4 w-4" />
                Change Photo
              </Button>
              <p className="text-sm text-muted-foreground mt-2">Upload a professional photo for your profile</p>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              {isEditing ? (
                <Input
                  id="firstName"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">{profile.first_name}</div>
              )}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              {isEditing ? (
                <Input
                  id="lastName"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">{profile.last_name}</div>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {profile.email}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Email cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="employeeId">Employee ID</Label>
              <div className="p-2 bg-muted rounded-md">{profile.employee_id}</div>
              <p className="text-sm text-muted-foreground mt-1">Employee ID cannot be changed</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="position">Position</Label>
              <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                {profile.position}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Only admin can change position</p>
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {profile.phone_number || "Not provided"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Only admin can change phone number</p>
            </div>
          </div>

          {/* Organization Information */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Department</Label>
              <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                {profile.departments?.name || "No department assigned"}
              </div>
            </div>
            <div>
              <Label>Location</Label>
              <div className="p-2 bg-muted rounded-md flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {profile.districts?.name || "No location assigned"}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Role</Label>
              <div className="p-2">
                <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
                  {profile.role.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
            </div>
            <div>
              <Label>Account Status</Label>
              <div className="p-2">
                <Badge variant={profile.is_active ? "default" : "destructive"}>
                  {profile.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            {isEditing ? (
              <>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
            )}
          </div>

          {/* Password Change Section */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">Password</h3>
                <p className="text-sm text-muted-foreground">Change your account password</p>
              </div>
              <Button variant="outline" onClick={() => setShowPasswordChange(!showPasswordChange)}>
                <Key className="mr-2 h-4 w-4" />
                Change Password
              </Button>
            </div>

            {showPasswordChange && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    placeholder="Confirm new password"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handlePasswordChange} disabled={saving}>
                    {saving ? "Updating..." : "Update Password"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowPasswordChange(false)
                      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
