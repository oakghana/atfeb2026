"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts"
import {
  BarChart3,
  Download,
  CalendarIcon,
  Users,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  MapPin,
  Loader2,
  Search,
  Eye,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time?: string
  work_hours?: number
  status: string
  check_in_location_name?: string
  check_out_location_name?: string
  is_check_in_outside_location?: boolean
  is_check_out_outside_location?: boolean
  early_checkout_reason?: string
  user_profiles: {
    first_name: string
    last_name: string
    employee_id: string
    departments?: {
      name: string
      code: string
    }
    assigned_location?: {
      name: string
      address: string
    }
    districts?: {
      name: string
    }
  }
  check_in_location?: {
    name: string
    address: string
  }
  check_out_location?: {
    name: string
    address: string
  }
  geofence_locations?: {
    name: string
    address: string
  }
}

interface ReportSummary {
  totalRecords: number
  totalWorkHours: number
  averageWorkHours: number
  statusCounts: Record<string, number>
  departmentStats: Record<string, { count: number; totalHours: number }>
}

const COLORS = ["#4B8B3B", "#8B5CF6", "#6b7280", "#f97316", "#ea580c"]

export function AttendanceReports() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedUser, setSelectedUser] = useState("all")
  const [locations, setLocations] = useState([])
  const [districts, setDistricts] = useState([])
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [selectedDistrict, setSelectedDistrict] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [selectedLocationStatus, setSelectedLocationStatus] = useState("all")
  const [minHours, setMinHours] = useState("")
  const [maxHours, setMaxHours] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [visibleColumns, setVisibleColumns] = useState({
    date: true,
    employee: true,
    department: true,
    checkIn: true,
    checkInLocation: true,
    checkOut: true,
    checkOutLocation: true,
    earlyCheckoutReason: true,
    hours: true,
    status: true,
    locationStatus: true,
  })

  const visibleColumnCount = useMemo(() => Object.values(visibleColumns).filter(Boolean).length, [visibleColumns])

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const [analyticsData, setAnalyticsData] = useState({
    dailyTrends: [],
    departmentComparison: [],
    lateArrivals: [],
    overtime: [],
    absenteeism: [],
  })

  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetchReport()
    fetchDepartments()
    fetchUsers()
    fetchLocations()
    fetchDistricts()
  }, [startDate, endDate, selectedDepartment, selectedUser, selectedLocation, selectedDistrict, selectedStatus, selectedLocationStatus, minHours, maxHours])

  const fetchReport = async () => {
    setLoading(true)
    setExportError(null)
    try {
      console.log("[v0] Fetching report with dates:", startDate, endDate)

      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      })

      if (selectedDepartment !== "all") params.append("department_id", selectedDepartment)
      if (selectedUser !== "all") params.append("user_id", selectedUser)
      if (selectedLocation !== "all") params.append("location_id", selectedLocation)
      if (selectedDistrict !== "all") params.append("district_id", selectedDistrict)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      if (selectedLocationStatus !== "all") params.append("location_status", selectedLocationStatus)
      if (minHours) params.append("min_hours", minHours)
      if (maxHours) params.append("max_hours", maxHours)

      console.log("[v0] API call URL:", `/api/admin/reports/attendance?${params}`)

      const response = await fetch(`/api/admin/reports/attendance?${params}`)
      const result = await response.json()

      console.log("[v0] API response:", result)

      if (result.success) {
        setRecords(result.data.records || [])
        setSummary(result.data.summary || null)
        console.log("[v0] Successfully loaded", result.data.records?.length || 0, "records")
      } else {
        console.error("[v0] API error:", result.error)
        setExportError(result.error || "Failed to fetch report data")
      }
    } catch (error) {
      console.error("[v0] Failed to fetch report:", error)
      setExportError("Failed to fetch report data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      console.log("[v0] Fetching departments...")
      const response = await fetch("/api/admin/departments")
      const result = await response.json()
      console.log("[v0] Departments response:", result)

      if (result.success) {
        setDepartments(result.data || [])
      } else {
        console.error("[v0] Departments error:", result.error)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch departments:", error)
    }
  }

  const fetchUsers = async () => {
    try {
      console.log("[v0] Fetching users...")
      const response = await fetch("/api/admin/users")
      const result = await response.json()
      console.log("[v0] Users response:", result)

      if (result.success) {
        setUsers(result.data || [])
      } else {
        console.error("[v0] Users error:", result.error)
      }
    } catch (error) {
      console.error("[v0] Failed to fetch users:", error)
    }
  }

  const fetchLocations = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("geofence_locations")
        .select("id, name, address")
        .eq("is_active", true)
        .order("name")

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error("Failed to fetch locations:", error)
    }
  }

  const fetchDistricts = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("districts").select("id, name").eq("is_active", true).order("name")

      if (error) throw error
      setDistricts(data || [])
    } catch (error) {
      console.error("Failed to fetch districts:", error)
    }
  }

  const exportReport = async (format: "excel" | "pdf" | "csv") => {
    setExporting(true)
    setExportError(null)

    try {
      console.log(`[v0] Starting ${format} export...`)

      if (format === "csv") {
        const csvContent = [
          [
            "Date",
            "Employee ID",
            "Name",
            "Department",
            "Assigned Location",
            "Check In Time",
            "Check In Location",
            "Check In Status",
            "Check Out Time",
            "Check Out Location",
            "Check Out Status",
            "Early Checkout Reason",
            "Work Hours",
            "Status",
            "Location Status",
          ].join(","),
          ...records.map((record) =>
            [
              new Date(record.check_in_time).toLocaleDateString(),
              `"${record.user_profiles.employee_id || "N/A"}"`,
              `"${record.user_profiles.first_name} ${record.user_profiles.last_name}"`,
              `"${record.user_profiles.departments?.name || "N/A"}"`,
              `"${record.user_profiles.assigned_location?.name || "N/A"}"`,
              `"${new Date(record.check_in_time).toLocaleTimeString()}"`,
              `"${record.check_in_location?.name || record.check_in_location_name || "N/A"}"`,
              `"${record.is_check_in_outside_location ? "Outside Assigned Location" : "On-site"}"`,
              `"${record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : "N/A"}"`,
              `"${record.check_out_location?.name || record.check_out_location_name || "N/A"}"`,
              `"${record.is_check_out_outside_location ? "Outside Assigned Location" : "On-site"}"`,
              `"${record.early_checkout_reason || "-"}"`,
              record.work_hours?.toFixed(2) || "0",
              `"${record.status}"`,
              `"${record.is_check_in_outside_location || record.is_check_out_outside_location ? "Remote Work" : "On-site"}"`,
            ].join(","),
          ),
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `qcc-attendance-report-${startDate}-to-${endDate}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        console.log("[v0] CSV export completed successfully")
      } else {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        const response = await fetch("/api/admin/reports/export", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            format,
            data: records,
            summary,
            filters: {
              startDate,
              endDate,
              locationId: selectedLocation !== "all" ? selectedLocation : null,
              districtId: selectedDistrict !== "all" ? selectedDistrict : null,
              departmentId: selectedDepartment !== "all" ? selectedDepartment : null,
              userId: selectedUser !== "all" ? selectedUser : null,
              reportType: "attendance",
            },
          }),
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[v0] Export API error:`, errorText)
          throw new Error(`Export failed: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        if (blob.size === 0) {
          throw new Error("Export returned empty file")
        }

        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `qcc-attendance-report-${startDate}-to-${endDate}.${format === "excel" ? "xlsx" : "pdf"}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        console.log(`[v0] ${format} export completed successfully`)
      }
    } catch (error) {
      console.error("[v0] Export error:", error)
      if (error.name === "AbortError") {
        setExportError("Export timed out. Please try again with a smaller date range.")
      } else {
        setExportError(`Failed to export ${format.toUpperCase()} report: ${error.message}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const statusChartData = useMemo(
    () =>
      summary?.statusCounts
        ? Object.entries(summary.statusCounts).map(([status, count]) => ({
            name: status.charAt(0).toUpperCase() + status.slice(1),
            value: count,
          }))
        : [],
    [summary?.statusCounts],
  )

  const departmentChartData = useMemo(
    () =>
      summary?.departmentStats
        ? Object.entries(summary.departmentStats).map(([dept, stats]) => ({
            name: dept,
            count: stats.count,
            hours: stats.totalHours,
          }))
        : [],
    [summary?.departmentStats],
  )

  const filteredRecords = useMemo(() => {
    let filtered = records

    // Department filter
    if (selectedDepartment !== "all") {
      filtered = filtered.filter((r) => r.user_profiles?.departments?.id === selectedDepartment)
    }

    // User filter
    if (selectedUser !== "all") {
      filtered = filtered.filter((r) => r.id === selectedUser)
    }

    // Location filter
    if (selectedLocation !== "all") {
      filtered = filtered.filter(
        (r) => r.check_in_location?.id === selectedLocation || r.check_out_location?.id === selectedLocation,
      )
    }

    // District filter
    if (selectedDistrict !== "all") {
      filtered = filtered.filter((r) => r.user_profiles?.assigned_location?.districts?.id === selectedDistrict)
    }

    // Status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((r) => r.status === selectedStatus)
    }

    // Location status filter
    if (selectedLocationStatus !== "all") {
      const isRemote = selectedLocationStatus === "remote"
      filtered = filtered.filter((r) =>
        isRemote
          ? r.is_check_in_outside_location || r.is_check_out_outside_location
          : !r.is_check_in_outside_location && !r.is_check_out_outside_location
      )
    }

    // Hours range filter
    if (minHours) {
      const min = parseFloat(minHours)
      filtered = filtered.filter((r) => (r.work_hours || 0) >= min)
    }
    if (maxHours) {
      const max = parseFloat(maxHours)
      filtered = filtered.filter((r) => (r.work_hours || 0) <= max)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((r) => {
        const fullName = `${r.user_profiles.first_name} ${r.user_profiles.last_name}`.toLowerCase()
        const employeeId = r.user_profiles.employee_id?.toLowerCase() || ""
        const department = r.user_profiles.departments?.name?.toLowerCase() || ""
        const assignedLocation = r.user_profiles.assigned_location?.name?.toLowerCase() || ""
        const district = r.user_profiles.assigned_location?.districts?.name?.toLowerCase() || ""

        return (
          fullName.includes(query) ||
          employeeId.includes(query) ||
          department.includes(query) ||
          assignedLocation.includes(query) ||
          district.includes(query)
        )
      })
    }

    return filtered
  }, [records, selectedDepartment, selectedUser, selectedLocation, selectedDistrict, selectedStatus, selectedLocationStatus, minHours, maxHours, searchQuery])

  const presentCount = useMemo(() => records.filter((r) => r.status === "present" || r.check_in_time).length, [records])

  const setQuickDate = (preset: "today" | "week" | "month" | "quarter") => {
    const today = new Date()
    const todayStr = today.toISOString().split("T")[0]

    switch (preset) {
      case "today":
        setStartDate(todayStr)
        setEndDate(todayStr)
        break
      case "week":
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        setStartDate(weekStart.toISOString().split("T")[0])
        setEndDate(todayStr)
        break
      case "month":
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        setStartDate(monthStart.toISOString().split("T")[0])
        setEndDate(todayStr)
        break
      case "quarter":
        const quarterStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1)
        setStartDate(quarterStart.toISOString().split("T")[0])
        setEndDate(todayStr)
        break
    }
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Advanced Attendance Analytics & Export
          </CardTitle>
          <CardDescription>
            Comprehensive attendance reports with location and district filtering, plus Excel/PDF export
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exportError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-7">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="district">District</Label>
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder="All Districts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {districts.map((district) => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
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
            </div>
            <div>
              <Label htmlFor="user">Employee</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Actions</Label>
              <div className="flex gap-1">
                <Button onClick={fetchReport} size="sm" className="flex-1" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-1 h-3 w-3" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Advanced Filters Row */}
          <div className="grid gap-4 md:grid-cols-6 pt-4 border-t">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="early_checkout">Early Checkout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="locationStatus">Location Status</Label>
              <Select value={selectedLocationStatus} onValueChange={setSelectedLocationStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Location Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Location Statuses</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                  <SelectItem value="remote">Remote Work</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="minHours">Min Hours</Label>
              <input
                id="minHours"
                type="number"
                step="0.5"
                min="0"
                value={minHours}
                onChange={(e) => setMinHours(e.target.value)}
                placeholder="0"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <Label htmlFor="maxHours">Max Hours</Label>
              <input
                id="maxHours"
                type="number"
                step="0.5"
                min="0"
                value={maxHours}
                onChange={(e) => setMaxHours(e.target.value)}
                placeholder="24"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, department..."
                  className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <Label>Quick Date Selection</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => setQuickDate("today")}>
                Today
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDate("week")}>
                This Week
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDate("month")}>
                This Month
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDate("quarter")}>
                This Quarter
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button
              onClick={() => exportReport("excel")}
              variant="outline"
              disabled={exporting || records.length === 0 || loading}
              className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              {exporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button
              onClick={() => exportReport("csv")}
              variant="outline"
              disabled={exporting || records.length === 0 || loading}
              className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>

          {/* Column Visibility Controls */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4" />
              <Label className="text-sm font-medium">Visible Columns</Label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(visibleColumns).map(([key, isVisible]) => (
                <div key={key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`col-${key}`}
                    checked={isVisible}
                    onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor={`col-${key}`} className="text-xs capitalize">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {!loading && records.length === 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No attendance records found for the selected criteria. Try adjusting your filters or date range.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Locations</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{locations.length}</div>
              <p className="text-xs text-muted-foreground">Active locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{summary.totalRecords}</div>
              <p className="text-xs text-muted-foreground">Attendance entries</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Quick Select</CardTitle>
              <CalendarIcon className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-6 text-orange-700 hover:bg-orange-100"
                  onClick={() => setQuickDate("today")}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-6 text-orange-700 hover:bg-orange-100"
                  onClick={() => setQuickDate("week")}
                >
                  This Week
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-6 text-orange-700 hover:bg-orange-100"
                  onClick={() => setQuickDate("month")}
                >
                  This Month
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{presentCount}</div>
              <p className="text-xs text-muted-foreground">On time arrivals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Late</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{summary.statusCounts.late || 0}</div>
              <p className="text-xs text-muted-foreground">Late arrivals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{Math.round(summary.totalWorkHours)}</div>
              <p className="text-xs text-muted-foreground">Work hours logged</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Departments</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{Object.keys(summary.departmentStats).length}</div>
              <p className="text-xs text-muted-foreground">Active departments</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Attendance by Department</CardTitle>
                <CardDescription>Total attendance records per department</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={departmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4B8B3B" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>Breakdown of attendance statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily Attendance Trend</CardTitle>
                <CardDescription>Attendance patterns over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={departmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#4B8B3B" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Work Hours Distribution</CardTitle>
                <CardDescription>Average work hours by department</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={departmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="hours" stroke="#ea580c" fill="#ea580c" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="departments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Department Performance</CardTitle>
              <CardDescription>Detailed breakdown by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(summary?.departmentStats || {}).map(([dept, stats]) => (
                  <div key={dept} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{dept}</h4>
                      <p className="text-sm text-muted-foreground">{stats.count} attendance records</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{Math.round(stats.totalHours)}h</div>
                      <p className="text-sm text-muted-foreground">Total hours</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Attendance Records</CardTitle>
              <CardDescription>
                Complete attendance entries for the selected period with location tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {visibleColumns.date && <TableHead>Date</TableHead>}
                      {visibleColumns.employee && <TableHead>Employee</TableHead>}
                      {visibleColumns.department && <TableHead>Department</TableHead>}
                      {visibleColumns.checkIn && <TableHead>Check In</TableHead>}
                      {visibleColumns.checkInLocation && <TableHead>Check In Location</TableHead>}
                      {visibleColumns.checkOut && <TableHead>Check Out</TableHead>}
                      {visibleColumns.checkOutLocation && <TableHead>Check Out Location</TableHead>}
                      {visibleColumns.earlyCheckoutReason && <TableHead>Early Checkout Reason</TableHead>}
                      {visibleColumns.hours && <TableHead>Hours</TableHead>}
                      {visibleColumns.status && <TableHead>Status</TableHead>}
                      {visibleColumns.locationStatus && <TableHead>Location Status</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumnCount} className="text-center py-8">
                          Loading records...
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={visibleColumnCount} className="text-center py-8">
                          No records found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          {visibleColumns.date && <TableCell>{new Date(record.check_in_time).toLocaleDateString()}</TableCell>}
                          {visibleColumns.employee && (
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {record.user_profiles.first_name} {record.user_profiles.last_name}
                                </div>
                                <div className="text-sm text-muted-foreground">{record.user_profiles.employee_id}</div>
                                {record.user_profiles.assigned_location && (
                                  <div className="text-xs text-blue-600">
                                    Assigned: {record.user_profiles.assigned_location.name}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.department && <TableCell>{record.user_profiles.departments?.name || "N/A"}</TableCell>}
                          {visibleColumns.checkIn && <TableCell>{new Date(record.check_in_time).toLocaleTimeString()}</TableCell>}
                          {visibleColumns.checkInLocation && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{record.check_in_location?.name || record.check_in_location_name || "N/A"}</span>
                                {record.is_check_in_outside_location && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    Outside
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.checkOut && (
                            <TableCell>
                              {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : "N/A"}
                            </TableCell>
                          )}
                          {visibleColumns.checkOutLocation && (
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{record.check_out_location?.name || record.check_out_location_name || "N/A"}</span>
                                {record.is_check_out_outside_location && (
                                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                                    <MapPin className="h-3 w-3 mr-1" />
                                    Outside
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.earlyCheckoutReason && (
                            <TableCell>
                              {record.early_checkout_reason ? (
                                <div className="max-w-xs">
                                  <Badge
                                    variant="outline"
                                    className="text-orange-600 border-orange-300 bg-orange-50 mb-1"
                                  >
                                    Early Checkout
                                  </Badge>
                                  <p className="text-sm text-muted-foreground">{record.early_checkout_reason}</p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )}
                          {visibleColumns.hours && <TableCell>{record.work_hours?.toFixed(2) || "0"}</TableCell>}
                          {visibleColumns.status && (
                            <TableCell>
                              <Badge variant={record.status === "present" ? "default" : "secondary"}>
                                {record.status.replace("_", " ")}
                              </Badge>
                            </TableCell>
                          )}
                          {visibleColumns.locationStatus && (
                            <TableCell>
                              {record.is_check_in_outside_location || record.is_check_out_outside_location ? (
                                <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Remote Work
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  On-site
                                </Badge>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {records.length > 50 && (
                <p className="text-sm text-muted-foreground mt-4">
                  Showing first 50 records. Export CSV for complete data.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
