"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Users, Plus, Search, Edit, Trash2, UserCheck, UserX, Key, MapPin } from "lucide-react"
import { PasswordManagement } from "./password-management"

interface StaffMember {
  id: string
  first_name: string
  last_name: string
  email: string
  employee_id: string
  position: string
  role: string
  is_active: boolean
  department_id?: string
  assigned_location_id?: string
  departments?: {
    id: string
    name: string
    code: string
  }
  assigned_location?: {
    id: string
    name: string
    address: string
  }
}

interface Department {
  id: string
  name: string
  code: string
}

interface Location {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
}

export function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedRole, setSelectedRole] = useState("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false)
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: "success" | "error" }>>(
    [],
  )

  const [newStaff, setNewStaff] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    employee_id: "",
    department_id: "",
    position: "",
    role: "staff",
    assigned_location_id: "",
  })

  useEffect(() => {
    fetchStaff()
    fetchDepartments()
    fetchLocations()
  }, [searchTerm, selectedDepartment, selectedRole])

  const fetchStaff = async () => {
    try {
      console.log("[v0] Fetching staff with filters:", { searchTerm, selectedDepartment, selectedRole })
      const params = new URLSearchParams()
      if (searchTerm) params.append("search", searchTerm)
      if (selectedDepartment !== "all") params.append("department", selectedDepartment)
      if (selectedRole !== "all") params.append("role", selectedRole)

      const response = await fetch(`/api/admin/staff?${params}`)
      const result = await response.json()
      console.log("[v0] Staff fetch result:", result)

      if (result.success) {
        setStaff(result.data)
      } else {
        console.error("[v0] Failed to fetch staff:", result.error)
        setError(result.error)
      }
    } catch (error) {
      console.error("[v0] Staff fetch exception:", error)
      setError("Failed to fetch staff")
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      console.log("[v0] Fetching departments...")
      const response = await fetch("/api/admin/departments")
      const result = await response.json()
      console.log("[v0] Departments fetch result:", result)

      if (result.success) {
        setDepartments(result.departments || result.data || [])
      } else {
        console.error("[v0] Failed to fetch departments:", result.error)
      }
    } catch (error) {
      console.error("[v0] Departments fetch exception:", error)
    }
  }

  const fetchLocations = async () => {
    try {
      console.log("[v0] Fetching locations...")
      const response = await fetch("/api/attendance/locations")
      const result = await response.json()
      console.log("[v0] Locations fetch result:", result)

      if (result.success) {
        setLocations(result.data || [])
      } else {
        console.error("[v0] Failed to fetch locations:", result.error)
      }
    } catch (error) {
      console.error("[v0] Locations fetch exception:", error)
    }
  }

  const handleAddStaff = async () => {
    try {
      setError(null)
      console.log("[v0] Adding new staff:", newStaff)
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaff),
      })

      const result = await response.json()
      console.log("[v0] Add staff result:", result)

      if (result.success) {
        addNotification("Staff member added successfully", "success")
        setSuccess("Staff member added successfully")
        setIsAddDialogOpen(false)
        setNewStaff({
          email: "",
          password: "",
          first_name: "",
          last_name: "",
          employee_id: "",
          department_id: "",
          position: "",
          role: "staff",
          assigned_location_id: "",
        })
        fetchStaff()
      } else {
        addNotification(result.error || "Failed to add staff member", "error")
        setError(result.error)
      }
    } catch (error) {
      console.error("[v0] Add staff exception:", error)
      const errorMessage = "Failed to add staff member"
      addNotification(errorMessage, "error")
      setError(errorMessage)
    }
  }

  const handleUpdateStaff = async (staffId: string, updates: Partial<StaffMember>) => {
    try {
      setError(null)
      console.log("[v0] Updating staff member:", staffId, updates)
      const response = await fetch(`/api/admin/staff/${staffId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      const result = await response.json()
      console.log("[v0] Update staff result:", result)

      if (result.success) {
        addNotification("Staff member updated successfully", "success")
        setSuccess("Staff member updated successfully")
        fetchStaff()
      } else {
        addNotification(result.error || "Failed to update staff member", "error")
        setError(result.error)
      }
    } catch (error) {
      console.error("[v0] Update exception:", error)
      const errorMessage = "Failed to update staff member"
      addNotification(errorMessage, "error")
      setError(errorMessage)
    }
  }

  const handleDeactivateStaff = async (staffId: string) => {
    if (!confirm("Are you sure you want to deactivate this staff member?")) return

    try {
      setError(null)
      const response = await fetch(`/api/admin/staff/${staffId}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        addNotification("Staff member deactivated successfully", "success")
        setSuccess("Staff member deactivated successfully")
        fetchStaff()
      } else {
        addNotification(result.error || "Failed to deactivate staff member", "error")
        setError(result.error)
      }
    } catch (error) {
      const errorMessage = "Failed to deactivate staff member"
      addNotification(errorMessage, "error")
      setError(errorMessage)
    }
  }

  const handleEditStaff = async () => {
    if (!editingStaff) return

    try {
      setError(null)

      if (!editingStaff.assigned_location_id || editingStaff.assigned_location_id === "none") {
        const headOfficeLocation = locations.find((loc) => loc.name.toLowerCase().includes("head office"))
        if (!headOfficeLocation) {
          addNotification("Please assign a location to this staff member", "error")
          return
        }
      }

      const updateData = {
        first_name: editingStaff.first_name,
        last_name: editingStaff.last_name,
        email: editingStaff.email,
        employee_id: editingStaff.employee_id,
        position: editingStaff.position,
        role: editingStaff.role,
        department_id: editingStaff.department_id || editingStaff.departments?.id,
        is_active: editingStaff.is_active,
        assigned_location_id: editingStaff.assigned_location_id,
      }

      console.log("[v0] Updating staff member:", editingStaff.id, updateData)

      const response = await fetch(`/api/admin/staff/${editingStaff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      })

      console.log("[v0] Update response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[v0] Update response error:", errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log("[v0] Update response data:", result)

      if (result.success) {
        addNotification("Staff member updated successfully", "success")
        setSuccess("Staff member updated successfully")
        setEditingStaff(null)
        fetchStaff()
      } else {
        console.error("[v0] Update failed:", result.error)
        const errorMessage = result.error || "Failed to update staff member"
        addNotification(errorMessage, "error")
        setError(errorMessage)
      }
    } catch (error) {
      console.error("[v0] Update exception:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to update staff member"
      addNotification(errorMessage, "error")
      setError(errorMessage)
    }
  }

  const addNotification = (message: string, type: "success" | "error") => {
    const id = crypto.randomUUID()
    setNotifications((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, 5000)
  }

  return (
    <div className="space-y-6">
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <Alert
            key={notification.id}
            variant={notification.type === "error" ? "destructive" : "default"}
            className="w-80 shadow-lg"
          >
            <AlertDescription>{notification.message}</AlertDescription>
          </Alert>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Management
          </CardTitle>
          <CardDescription>Manage QCC staff members, roles, and location assignments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Removed error and success alerts as they are now handled by notifications */}
          {/* Filters and Actions */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="department_head">Department Head</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Key className="mr-2 h-4 w-4" />
                    Reset Passwords
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Password Management</DialogTitle>
                    <DialogDescription>Reset passwords for staff members</DialogDescription>
                  </DialogHeader>
                  <PasswordManagement isAdmin={true} />
                </DialogContent>
              </Dialog>

              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Staff
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Staff Member</DialogTitle>
                    <DialogDescription>Create a new staff account for QCC</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={newStaff.first_name}
                          onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={newStaff.last_name}
                          onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newStaff.email}
                        onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newStaff.password}
                        onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="employeeId">Employee ID</Label>
                      <Input
                        id="employeeId"
                        value={newStaff.employee_id}
                        onChange={(e) => setNewStaff({ ...newStaff, employee_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        value={newStaff.position}
                        onChange={(e) => setNewStaff({ ...newStaff, position: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="department">Department</Label>
                      <Select
                        value={newStaff.department_id}
                        onValueChange={(value) => setNewStaff({ ...newStaff, department_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={newStaff.role}
                        onValueChange={(value) => setNewStaff({ ...newStaff, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="department_head">Department Head</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="assignedLocation">Assigned Location</Label>
                      <Select
                        value={newStaff.assigned_location_id}
                        onValueChange={(value) => setNewStaff({ ...newStaff, assigned_location_id: value })}
                        required
                      >
                        <SelectTrigger className="border-2 border-secondary/50">
                          <SelectValue placeholder="Select Location (Required)" />
                        </SelectTrigger>
                        <SelectContent>
                          {locations
                            .filter((location) => !location.name.toLowerCase().includes("head office"))
                            .map((location) => (
                              <SelectItem key={location.id} value={location.id}>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-3 w-3" />
                                  {location.name} - {location.address}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Each staff member must be assigned to their actual work location for accurate attendance
                        tracking
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddStaff}>Add Staff</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Edit Dialog */}
          {editingStaff && (
            <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Staff Member</DialogTitle>
                  <DialogDescription>Update staff member information and assignments</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="editFirstName">First Name</Label>
                      <Input
                        id="editFirstName"
                        value={editingStaff.first_name}
                        onChange={(e) => setEditingStaff({ ...editingStaff, first_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="editLastName">Last Name</Label>
                      <Input
                        id="editLastName"
                        value={editingStaff.last_name}
                        onChange={(e) => setEditingStaff({ ...editingStaff, last_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="editEmail">Email</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={editingStaff.email}
                      onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editEmployeeId">Employee ID</Label>
                    <Input
                      id="editEmployeeId"
                      value={editingStaff.employee_id}
                      onChange={(e) => setEditingStaff({ ...editingStaff, employee_id: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPosition">Position</Label>
                    <Input
                      id="editPosition"
                      value={editingStaff.position}
                      onChange={(e) => setEditingStaff({ ...editingStaff, position: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="editDepartment">Department</Label>
                    <Select
                      value={editingStaff.department_id || editingStaff.departments?.id || "none"}
                      onValueChange={(value) =>
                        setEditingStaff({
                          ...editingStaff,
                          department_id: value,
                          departments: departments.find((d) => d.id === value),
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="editRole">Role</Label>
                    <Select
                      value={editingStaff.role}
                      onValueChange={(value) => setEditingStaff({ ...editingStaff, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="department_head">Department Head</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="editAssignedLocation">Assigned Location</Label>
                    <Select
                      value={editingStaff.assigned_location_id || "none"}
                      onValueChange={(value) => setEditingStaff({ ...editingStaff, assigned_location_id: value })}
                      required
                    >
                      <SelectTrigger className="border-2 border-secondary/50">
                        <SelectValue placeholder="Select Location (Required)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>
                          <span className="text-muted-foreground">Select a location</span>
                        </SelectItem>
                        {locations
                          .filter((location) => !location.name.toLowerCase().includes("head office"))
                          .map((location) => (
                            <SelectItem key={location.id} value={location.id}>
                              <div className="flex items-center gap-1 text-sm">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="truncate max-w-32" title={location.address}>
                                  {location.name}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Staff must be assigned to their actual work location
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingStaff(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleEditStaff}>Update Staff</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Staff Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Assigned Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading staff...
                    </TableCell>
                  </TableRow>
                ) : staff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No staff members found
                    </TableCell>
                  </TableRow>
                ) : (
                  staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.first_name} {member.last_name}
                      </TableCell>
                      <TableCell>{member.employee_id}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>{member.departments?.name || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                          {member.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {member.assigned_location ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate max-w-32" title={member.assigned_location.address}>
                              {member.assigned_location.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No location</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.is_active ? "default" : "destructive"}>
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditingStaff(member)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStaff(member.id, { is_active: !member.is_active })}
                          >
                            {member.is_active ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDeactivateStaff(member.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
