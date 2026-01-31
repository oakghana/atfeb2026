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
  User,
  AlertCircle,
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
    <div className="space-y-8">
      {/* Advanced Filters - Modern Design */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-8 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              <BarChart3 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Advanced Analytics Dashboard</h2>
              <p className="text-blue-100">Comprehensive attendance reports with intelligent filtering</p>
            </div>
          </div>

          {exportError && (
            <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl p-4 mt-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-300" />
                <p className="text-red-200 font-medium">{exportError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-8">
          {/* Primary Filters */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                Location
              </label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white">
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

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-600" />
                Department
              </label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white">
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
          </div>

          {/* Secondary Filters */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-600" />
                Employee
              </label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white">
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

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                Status
              </label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white">
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

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-600" />
                Hours Range
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={minHours}
                  onChange={(e) => setMinHours(e.target.value)}
                  placeholder="Min"
                  className="flex-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white text-sm"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={maxHours}
                  onChange={(e) => setMaxHours(e.target.value)}
                  placeholder="Max"
                  className="flex-1 px-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Search className="h-4 w-4 text-pink-600" />
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, department..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                />
              </div>
            </div>
          </div>

          {!loading && records.length === 0 && (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Found</h3>
              <p className="text-gray-500">Try adjusting your filters or date range to see attendance records.</p>
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {/* Total Records Card - Primary */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <FileText className="w-3 h-3 mr-1" />
                Primary
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <FileText className="h-6 w-6" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-white/80 text-sm font-medium">Total Records</p>
              <p className="text-3xl font-bold">{summary.totalRecords.toLocaleString()}</p>
              <p className="text-white/60 text-xs">Attendance entries</p>
            </div>
          </div>

          {/* Present Count Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <CheckCircle className="w-3 h-3 mr-1" />
                On Time
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-white/80 text-sm font-medium">Present</p>
              <p className="text-3xl font-bold">{presentCount.toLocaleString()}</p>
              <p className="text-white/60 text-xs">On time arrivals</p>
            </div>
          </div>

          {/* Late Arrivals Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Attention
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-white/80 text-sm font-medium">Late</p>
              <p className="text-3xl font-bold">{summary.statusCounts.late || 0}</p>
              <p className="text-white/60 text-xs">Late arrivals</p>
            </div>
          </div>

          {/* Total Hours Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <Clock className="w-3 h-3 mr-1" />
                Productivity
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Clock className="h-6 w-6" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-white/80 text-sm font-medium">Total Hours</p>
              <p className="text-3xl font-bold">{Math.round(summary.totalWorkHours).toLocaleString()}</p>
              <p className="text-white/60 text-xs">Work hours logged</p>
            </div>
          </div>

          {/* Departments Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <Users className="w-3 h-3 mr-1" />
                Teams
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-white/80 text-sm font-medium">Departments</p>
              <p className="text-3xl font-bold">{Object.keys(summary.departmentStats).length}</p>
              <p className="text-white/60 text-xs">Active departments</p>
            </div>
          </div>

          {/* Locations Card */}
          <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="absolute top-4 right-4">
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <MapPin className="w-3 h-3 mr-1" />
                Locations
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <MapPin className="h-6 w-6" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-white/80 text-sm font-medium">Locations</p>
              <p className="text-3xl font-bold">{locations.length}</p>
              <p className="text-white/60 text-xs">Active locations</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4 items-center justify-between pt-6 border-t border-gray-100">
        <div className="flex gap-3">
          <Button
            onClick={fetchReport}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-5 w-5" />
                Generate Report
              </>
            )}
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={() => exportReport("excel")}
              variant="outline"
              disabled={exporting || records.length === 0 || loading}
              className="border-green-200 text-green-700 hover:bg-green-50 px-6 py-3 rounded-xl transition-all duration-200"
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Excel
            </Button>
            <Button
              onClick={() => exportReport("csv")}
              variant="outline"
              disabled={exporting || records.length === 0 || loading}
              className="border-blue-200 text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-xl transition-all duration-200"
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              CSV
            </Button>
          </div>
        </div>

        {/* Quick Date Select */}
        <div className="flex gap-2">
          <span className="text-sm font-medium text-gray-600 self-center mr-2">Quick:</span>
          {[
            { label: "Today", value: "today" },
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
            { label: "Quarter", value: "quarter" }
          ].map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              onClick={() => setQuickDate(option.value as any)}
              className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-all duration-200"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Column Visibility */}
      <div className="pt-6 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <Eye className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-semibold text-gray-700">Visible Columns</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(visibleColumns).map(([key, isVisible]) => (
            <label key={key} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={isVisible}
                onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm text-gray-700 capitalize">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <Tabs defaultValue="overview" className="w-full">
            <div className="px-8 pt-6">
              <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-1 rounded-2xl h-14">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  📊 Overview
                </TabsTrigger>
                <TabsTrigger
                  value="trends"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  📈 Trends
                </TabsTrigger>
                <TabsTrigger
                  value="departments"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  🏢 Departments
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  📋 Details
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="px-8 py-8 space-y-8">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <BarChart3 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Attendance by Department</h3>
                      <p className="text-gray-600">Distribution of attendance records</p>
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(summary?.departmentStats || {}).map(([dept, stats]: [string, any]) => ({
                            name: dept,
                            value: stats.count,
                            hours: stats.totalHours,
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.entries(summary?.departmentStats || {}).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [
                            `${value} records`,
                            name
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Attendance Status</h3>
                      <p className="text-gray-600">Breakdown of attendance statuses</p>
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(summary?.statusCounts || {}).map(([status, count]) => ({
                        status: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
                        count,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="status"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                          }}
                        />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="px-8 py-8 space-y-8">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <BarChart3 className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Attendance Trends</h3>
                    <p className="text-gray-600">Daily attendance patterns over time</p>
                  </div>
                </div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData.dailyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="present"
                        stroke="#8b5cf6"
                        strokeWidth={3}
                        dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="late"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="departments" className="px-8 py-8 space-y-8">
              <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 border border-indigo-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-indigo-100 rounded-xl">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Department Performance</h3>
                    <p className="text-gray-600">Comparative analysis across departments</p>
                  </div>
                </div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Object.entries(summary?.departmentStats || {}).map(([dept, stats]: [string, any]) => ({
                      department: dept,
                      attendance: stats.count,
                      hours: Math.round(stats.totalHours),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="department"
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        }}
                      />
                      <Bar dataKey="attendance" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="px-8 py-8">
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Detailed Records</h3>
                      <p className="text-gray-600 mt-1">
                        Showing {filteredRecords.length} of {records.length} records
                      </p>
                    </div>
                    <Badge variant="secondary" className="px-4 py-2">
                      {filteredRecords.length} Records
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 hover:bg-gray-50">
                        {visibleColumns.date && (
                          <TableHead className="font-semibold text-gray-700 py-4">Date</TableHead>
                        )}
                        {visibleColumns.employee && (
                          <TableHead className="font-semibold text-gray-700 py-4">Employee</TableHead>
                        )}
                        {visibleColumns.department && (
                          <TableHead className="font-semibold text-gray-700 py-4">Department</TableHead>
                        )}
                        {visibleColumns.checkIn && (
                          <TableHead className="font-semibold text-gray-700 py-4">Check In</TableHead>
                        )}
                        {visibleColumns.checkInLocation && (
                          <TableHead className="font-semibold text-gray-700 py-4">Check In Location</TableHead>
                        )}
                        {visibleColumns.checkOut && (
                          <TableHead className="font-semibold text-gray-700 py-4">Check Out</TableHead>
                        )}
                        {visibleColumns.checkOutLocation && (
                          <TableHead className="font-semibold text-gray-700 py-4">Check Out Location</TableHead>
                        )}
                        {visibleColumns.hours && (
                          <TableHead className="font-semibold text-gray-700 py-4">Hours</TableHead>
                        )}
                        {visibleColumns.status && (
                          <TableHead className="font-semibold text-gray-700 py-4">Status</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.slice(0, 100).map((record) => (
                        <TableRow key={record.id} className="hover:bg-gray-50 transition-colors">
                          {visibleColumns.date && (
                            <TableCell className="py-4">
                              {new Date(record.check_in_time).toLocaleDateString()}
                            </TableCell>
                          )}
                          {visibleColumns.employee && (
                            <TableCell className="py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                  {record.user_profiles.first_name[0]}{record.user_profiles.last_name[0]}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {record.user_profiles.first_name} {record.user_profiles.last_name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {record.user_profiles.employee_id}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.department && (
                            <TableCell className="py-4">
                              <Badge variant="outline" className="font-medium">
                                {record.user_profiles.departments?.name || 'N/A'}
                              </Badge>
                            </TableCell>
                          )}
                          {visibleColumns.checkIn && (
                            <TableCell className="py-4">
                              {new Date(record.check_in_time).toLocaleTimeString()}
                            </TableCell>
                          )}
                          {visibleColumns.checkInLocation && (
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">
                                  {record.check_in_location_name || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.checkOut && (
                            <TableCell className="py-4">
                              {record.check_out_time
                                ? new Date(record.check_out_time).toLocaleTimeString()
                                : <span className="text-gray-400">-</span>
                              }
                            </TableCell>
                          )}
                          {visibleColumns.checkOutLocation && (
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">
                                  {record.check_out_location_name || 'N/A'}
                                </span>
                              </div>
                            </TableCell>
                          )}
                          {visibleColumns.hours && (
                            <TableCell className="py-4">
                              <span className="font-medium">
                                {record.work_hours ? `${record.work_hours.toFixed(1)}h` : '-'}
                              </span>
                            </TableCell>
                          )}
                          {visibleColumns.status && (
                            <TableCell className="py-4">
                              <Badge
                                variant={
                                  record.status === 'present' ? 'default' :
                                  record.status === 'late' ? 'secondary' :
                                  record.status === 'absent' ? 'destructive' : 'outline'
                                }
                                className="font-medium"
                              >
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}
                              </Badge>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {filteredRecords.length > 100 && (
                  <div className="p-6 border-t border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-600 text-center">
                      Showing first 100 records. Use filters to narrow down results or export for full data.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
