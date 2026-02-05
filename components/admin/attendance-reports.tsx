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
  lateness_reason?: string
  notes?: string
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
  const [locations, setLocations] = useState([])
  const [districts, setDistricts] = useState([])
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [selectedDistrict, setSelectedDistrict] = useState("all")
  const [selectedStatus, setSelectedStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortKey, setSortKey] = useState<string>("check_in_time")
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(50)
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [reasonsPage, setReasonsPage] = useState<number>(1)
  const reasonsPageSize = 20
  const [earlyPage, setEarlyPage] = useState<number>(1)
  const earlyPageSize = 20
  const [activeTab, setActiveTab] = useState<string>("details")
  const [reasonsRecords, setReasonsRecords] = useState<AttendanceRecord[]>([])
  const [reasonsLoading, setReasonsLoading] = useState<boolean>(false)

  const visibleColumnCount = 9

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

  useEffect(() => {
    fetchReport()
    fetchDepartments()
    fetchLocations()
    fetchDistricts()
  }, [startDate, endDate, selectedDepartment, selectedLocation, selectedDistrict, selectedStatus, page, pageSize])

  useEffect(() => {
    // When the Reasons tab is opened, fetch a larger set that contains all reason entries
    if (activeTab === "reasons") {
      fetchReasons()
    }
  }, [activeTab, startDate, endDate, selectedLocation, selectedDepartment, selectedDistrict])

  const fetchReasons = async () => {
    setReasonsLoading(true)
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        page: "1",
        page_size: String(1000), // large page to capture many reason entries; adjust if dataset larger
      })

      if (selectedDepartment !== "all") params.append("department_id", selectedDepartment)
      if (selectedLocation !== "all") params.append("location_id", selectedLocation)
      if (selectedDistrict !== "all") params.append("district_id", selectedDistrict)

      const res = await fetch(`/api/admin/reports/attendance?${params}`)
      const json = await res.json()
      if (json.success) {
        // use the server-provided records (unpaged large set)
        setReasonsRecords(json.data.records || [])
      } else {
        console.error("Failed to fetch reasons:", json.error)
      }
    } catch (err) {
      console.error("Failed to fetch reasons:", err)
    } finally {
      setReasonsLoading(false)
    }
  }

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
      if (selectedLocation !== "all") params.append("location_id", selectedLocation)
      if (selectedDistrict !== "all") params.append("district_id", selectedDistrict)
      if (selectedStatus !== "all") params.append("status", selectedStatus)
      // Pagination params
      params.append("page", String(page))
      params.append("page_size", String(pageSize))

      console.log("[v0] API call URL:", `/api/admin/reports/attendance?${params}`)

      const response = await fetch(`/api/admin/reports/attendance?${params}`)
      const result = await response.json()

      console.log("[v0] API response:", result)

      if (result.success) {
        setRecords(result.data.records || [])
        setSummary(result.data.summary || null)
        setTotalRecords(result.data.summary?.totalRecords || 0)
        console.log("[v0] Successfully loaded", result.data.records?.length || 0, "records (page)")
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

  // users list removed — Employee filter omitted per requirements

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
            "Lateness Reason",
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
              `"${record.lateness_reason || "-"}"`,
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
    // employee filter removed

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

    // Status filter retained (if needed)
    if (selectedStatus !== "all") {
      filtered = filtered.filter((r) => r.status === selectedStatus)
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
  }, [records, selectedDepartment, selectedLocation, selectedDistrict, selectedStatus, searchQuery])

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

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedRecords = useMemo(() => {
    const arr = [...filteredRecords]
    arr.sort((a: any, b: any) => {
      const get = (r: any) => {
        switch (sortKey) {
          case 'check_in_time':
            return new Date(r.check_in_time).getTime() || 0
          case 'check_out_time':
            return r.check_out_time ? new Date(r.check_out_time).getTime() : 0
          case 'work_hours':
            return r.work_hours || 0
          case 'last_name':
            return (r.user_profiles.last_name || '').toLowerCase()
          case 'department':
            return (r.user_profiles.departments?.name || '').toLowerCase()
          case 'status':
            return (r.status || '').toLowerCase()
          default:
            return ''
        }
      }

      const va = get(a)
      const vb = get(b)

      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      }
      return 0
    })
    return arr
  }, [filteredRecords, sortKey, sortDir])

  // Derived paged lists for Reasons tab (computed here to avoid inline IIFEs in JSX)
  const latenessList = reasonsRecords.filter((r) => r.lateness_reason)
  const latenessStart = (reasonsPage - 1) * reasonsPageSize
  const latenessPageItems = latenessList.slice(latenessStart, latenessStart + reasonsPageSize)

  const earlyList = reasonsRecords.filter((r) => r.early_checkout_reason)
  const earlyStart = (earlyPage - 1) * earlyPageSize
  const earlyPageItems = earlyList.slice(earlyStart, earlyStart + earlyPageSize)

  return (
    <div className="space-y-8">
      {/* Advanced Filters - Modern Design */}
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8">
            {exportError && (
              <div className="bg-red-500/20 backdrop-blur-sm border border-red-400/30 rounded-xl p-4 mt-2">
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

          {/* Secondary Filters - simplified (search only) */}
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1 mb-8">
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

            {/* Quick Select Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-6 text-amber-800 shadow-md border border-amber-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <CalendarIcon className="h-6 w-6 text-amber-600" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-amber-800 text-sm font-medium">Quick Select</p>
                <div className="flex flex-col gap-3">
                  <Button variant="ghost" size="sm" onClick={() => setQuickDate('today')} className="text-amber-700 text-left">Today</Button>
                  <Button variant="ghost" size="sm" onClick={() => setQuickDate('week')} className="text-amber-700 text-left">This Week</Button>
                  <Button variant="ghost" size="sm" onClick={() => setQuickDate('month')} className="text-amber-700 text-left">This Month</Button>
                </div>
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

      {/* Column visibility controls removed per request */}

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100">
          <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="details" className="w-full">
            <div className="px-8 pt-6">
              <TabsList className="grid w-full grid-cols-4 bg-gray-100 p-1 rounded-2xl h-14">
                <TabsTrigger
                  value="details"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  📋 Details
                </TabsTrigger>
                <TabsTrigger
                  value="overview"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  📊 Overview
                </TabsTrigger>
                <TabsTrigger
                  value="departments"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  🏢 Departments
                </TabsTrigger>
                <TabsTrigger
                  value="reasons"
                  className="rounded-xl text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  📝 Reasons
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
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden dark:bg-slate-900 dark:border-slate-700">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">Detailed Records</h3>
                      <p className="text-gray-600 dark:text-slate-300 mt-1">
                        Showing {records.length} of {totalRecords.toLocaleString()} records
                      </p>
                    </div>
                      <Badge variant="secondary" className="px-4 py-2 dark:bg-slate-800 dark:text-slate-100">
                      {records.length} Records (page)
                    </Badge>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table className="min-w-full text-sm text-gray-800 dark:text-slate-200">
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4 cursor-pointer" onClick={() => toggleSort('check_in_time')}>Date</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4 cursor-pointer" onClick={() => toggleSort('last_name')}>Employee</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4 cursor-pointer" onClick={() => toggleSort('department')}>Department</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4 cursor-pointer" onClick={() => toggleSort('check_in_time')}>Check In</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4">Check In Location</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4 cursor-pointer" onClick={() => toggleSort('check_out_time')}>Check Out</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4">Check Out Location</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4 cursor-pointer" onClick={() => toggleSort('work_hours')}>Hours</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4 cursor-pointer" onClick={() => toggleSort('status')}>Status</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4">Comment</TableHead>
                        <TableHead className="font-semibold text-gray-700 dark:text-slate-200 py-4">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRecords.map((record) => (
                        <TableRow key={record.id} className="bg-white dark:bg-slate-900 even:bg-gray-50 dark:even:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                          <TableCell className="py-4 text-gray-800 dark:text-slate-200">{new Date(record.check_in_time).toLocaleDateString()}</TableCell>
                          <TableCell className="py-4 text-gray-800 dark:text-slate-200">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                {record.user_profiles.first_name[0]}{record.user_profiles.last_name[0]}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-slate-100">{record.user_profiles.first_name} {record.user_profiles.last_name}</p>
                                <p className="text-sm text-gray-600 dark:text-slate-300">{record.user_profiles.employee_id}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="py-4"><Badge variant="outline" className="font-medium text-gray-700 dark:text-slate-200">{record.user_profiles.departments?.name || 'N/A'}</Badge></TableCell>
                          <TableCell className="py-4 text-gray-800 dark:text-slate-200">{new Date(record.check_in_time).toLocaleTimeString()}</TableCell>
                          <TableCell className="py-4 text-gray-800 dark:text-slate-200"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500 dark:text-slate-400" /><span className="text-sm text-gray-700 dark:text-slate-300">{record.check_in_location_name || 'N/A'}</span></div></TableCell>
                          <TableCell className="py-4 text-gray-800 dark:text-slate-200">{record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : <span className="text-gray-400 dark:text-slate-400">-</span>}</TableCell>
                          <TableCell className="py-4 text-gray-800 dark:text-slate-200"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-500 dark:text-slate-400" /><span className="text-sm text-gray-700 dark:text-slate-300">{record.check_out_location_name || 'N/A'}</span></div></TableCell>
                          <TableCell className="py-4 text-gray-800 dark:text-slate-200"><span className="font-medium">{record.work_hours ? `${record.work_hours.toFixed(1)}h` : '-'}</span></TableCell>
                          <TableCell className="py-4"><Badge
                            variant={
                              record.status === 'present' ? 'default' :
                              record.status === 'late' ? 'secondary' :
                              record.status === 'absent' ? 'destructive' : 'outline'
                            }
                            className="font-medium"
                          >{record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}</Badge></TableCell>
                          <TableCell className="py-4">
                            <span className="text-sm text-gray-700 dark:text-slate-300">
                              {record.notes ? (
                                <span className="max-w-xs truncate block" title={record.notes}>
                                  {record.notes}
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-slate-400">-</span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="text-sm text-gray-700 dark:text-slate-300">
                              {record.lateness_reason || record.early_checkout_reason ? (
                                <div className="space-y-1">
                                  {record.lateness_reason && (
                                    <div className="text-orange-600">
                                      <span className="font-medium">Late:</span>
                                      <span className="max-w-xs truncate block ml-1" title={record.lateness_reason}>
                                        {record.lateness_reason}
                                      </span>
                                    </div>
                                  )}
                                  {record.early_checkout_reason && (
                                    <div className="text-blue-600">
                                      <span className="font-medium">Early:</span>
                                      <span className="max-w-xs truncate block ml-1" title={record.early_checkout_reason}>
                                        {record.early_checkout_reason}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-slate-400">-</span>
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                    <span className="text-sm text-gray-600">Page {page} of {Math.max(1, Math.ceil(totalRecords / pageSize))}</span>
                    <Button variant="ghost" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.max(1, Math.ceil(totalRecords / pageSize))}>Next</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPage(Math.max(1, Math.ceil(totalRecords / pageSize)))} disabled={page >= Math.max(1, Math.ceil(totalRecords / pageSize))}>Last</Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Page size:</span>
                    <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(parseInt(v, 10)); setPage(1); }}>
                      <SelectTrigger className="w-24 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reasons" className="px-8 py-8">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Attendance Reasons</h3>
                    <p className="text-gray-600 mt-1">Review lateness and early checkout explanations</p>
                  </div>
                  <Badge variant="secondary" className="px-4 py-2">
                      {reasonsRecords.filter(r => r.lateness_reason || r.early_checkout_reason).length} Records with Reasons
                  </Badge>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        Lateness Reasons
                      </CardTitle>
                      <CardDescription>Staff explanations for arriving after 9:00 AM</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {latenessPageItems.map((record) => (
                            <div key={record.id} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    {record.user_profiles.first_name} {record.user_profiles.last_name}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(record.check_in_time).toLocaleDateString()} at {new Date(record.check_in_time).toLocaleTimeString()}
                                  </p>
                                  <p className="text-sm text-orange-700 mt-2 font-medium">
                                    {record.lateness_reason}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="ml-2">
                                  {record.user_profiles.departments?.name}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        {latenessList.length === 0 && (
                          <p className="text-gray-500 text-center py-4">No lateness reasons recorded</p>
                        )}

                        {/* Lateness pagination controls */}
                        {reasonsRecords.filter(r => r.lateness_reason).length > reasonsPageSize && (
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setReasonsPage(1)} disabled={reasonsPage === 1}>First</Button>
                              <Button variant="ghost" size="sm" onClick={() => setReasonsPage((p) => Math.max(1, p - 1))} disabled={reasonsPage === 1}>Prev</Button>
                              <span className="text-sm text-gray-600">Page {reasonsPage} of {Math.max(1, Math.ceil(reasonsRecords.filter(r => r.lateness_reason).length / reasonsPageSize))}</span>
                              <Button variant="ghost" size="sm" onClick={() => setReasonsPage((p) => p + 1)} disabled={reasonsPage >= Math.max(1, Math.ceil(reasonsRecords.filter(r => r.lateness_reason).length / reasonsPageSize))}>Next</Button>
                              <Button variant="ghost" size="sm" onClick={() => setReasonsPage(Math.max(1, Math.ceil(reasonsRecords.filter(r => r.lateness_reason).length / reasonsPageSize)))} disabled={reasonsPage >= Math.max(1, Math.ceil(reasonsRecords.filter(r => r.lateness_reason).length / reasonsPageSize))}>Last</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-blue-500" />
                        Early Checkout Reasons
                      </CardTitle>
                      <CardDescription>Staff explanations for leaving before standard hours</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {earlyPageItems.map((record) => (
                            <div key={record.id} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">
                                    {record.user_profiles.first_name} {record.user_profiles.last_name}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(record.check_out_time!).toLocaleDateString()} at {new Date(record.check_out_time!).toLocaleTimeString()}
                                  </p>
                                  <p className="text-sm text-blue-700 mt-2 font-medium">
                                    {record.early_checkout_reason}
                                  </p>
                                </div>
                                <Badge variant="secondary" className="ml-2">
                                  {record.user_profiles.departments?.name}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        {earlyList.length === 0 && (
                          <p className="text-gray-500 text-center py-4">No early checkout reasons recorded</p>
                        )}

                        {/* Early checkout pagination controls */}
                        {reasonsRecords.filter(r => r.early_checkout_reason).length > earlyPageSize && (
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setEarlyPage(1)} disabled={earlyPage === 1}>First</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEarlyPage((p) => Math.max(1, p - 1))} disabled={earlyPage === 1}>Prev</Button>
                              <span className="text-sm text-gray-600">Page {earlyPage} of {Math.max(1, Math.ceil(reasonsRecords.filter(r => r.early_checkout_reason).length / earlyPageSize))}</span>
                              <Button variant="ghost" size="sm" onClick={() => setEarlyPage((p) => p + 1)} disabled={earlyPage >= Math.max(1, Math.ceil(reasonsRecords.filter(r => r.early_checkout_reason).length / earlyPageSize))}>Next</Button>
                              <Button variant="ghost" size="sm" onClick={() => setEarlyPage(Math.max(1, Math.ceil(reasonsRecords.filter(r => r.early_checkout_reason).length / earlyPageSize)))} disabled={earlyPage >= Math.max(1, Math.ceil(reasonsRecords.filter(r => r.early_checkout_reason).length / earlyPageSize))}>Last</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Reason Summary by Location</CardTitle>
                    <CardDescription>Overview of reasons provided across different locations</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                          {Object.entries(
                            reasonsRecords
                              .filter((r) => r.lateness_reason || r.early_checkout_reason)
                              .reduce((acc, record) => {
                                const location = record.check_in_location_name || 'Unknown'
                                if (!acc[location]) {
                                  acc[location] = { lateness: 0, earlyCheckout: 0 }
                                }
                                if (record.lateness_reason) acc[location].lateness++
                                if (record.early_checkout_reason) acc[location].earlyCheckout++
                                return acc
                              }, {} as Record<string, { lateness: number; earlyCheckout: number }>)
                          ).map(([location, counts]) => (
                        <div key={location} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <MapPin className="h-5 w-5 text-gray-400" />
                            <span className="font-medium">{location}</span>
                          </div>
                          <div className="flex gap-4">
                            <div className="text-center">
                              <p className="text-sm text-orange-600 font-medium">{counts.lateness}</p>
                              <p className="text-xs text-gray-500">Lateness</p>
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-blue-600 font-medium">{counts.earlyCheckout}</p>
                              <p className="text-xs text-gray-500">Early Checkout</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
