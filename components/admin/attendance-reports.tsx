"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
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
  FileDown,
  MapPin,
  Loader2,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time?: string
  work_hours?: number
  status: string
  user_profiles: {
    first_name: string
    last_name: string
    employee_id: string
    departments?: {
      name: string
      code: string
    }
    districts?: {
      name: string
    }
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
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [selectedDepartment, setSelectedDepartment] = useState("all")
  const [selectedUser, setSelectedUser] = useState("all")
  const [locations, setLocations] = useState([])
  const [districts, setDistricts] = useState([])
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [selectedDistrict, setSelectedDistrict] = useState("all")
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
  }, [startDate, endDate, selectedDepartment, selectedUser, selectedLocation, selectedDistrict])

  const fetchReport = async () => {
    setLoading(true)
    setExportError(null)
    try {
      console.log(
        "[v0] Fetching report with dates:",
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
      )

      const params = new URLSearchParams({
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      })

      if (selectedDepartment !== "all") params.append("department_id", selectedDepartment)
      if (selectedUser !== "all") params.append("user_id", selectedUser)
      if (selectedLocation !== "all") params.append("location_id", selectedLocation)
      if (selectedDistrict !== "all") params.append("district_id", selectedDistrict)

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
            "District",
            "Location",
            "Check In",
            "Check Out",
            "Work Hours",
            "Status",
          ].join(","),
          ...records.map((record) =>
            [
              new Date(record.check_in_time).toLocaleDateString(),
              `"${record.user_profiles.employee_id || "N/A"}"`,
              `"${record.user_profiles.first_name} ${record.user_profiles.last_name}"`,
              `"${record.user_profiles.departments?.name || "N/A"}"`,
              `"${record.user_profiles.districts?.name || "N/A"}"`,
              `"${record.geofence_locations?.name || "N/A"}"`,
              `"${new Date(record.check_in_time).toLocaleTimeString()}"`,
              `"${record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : "N/A"}"`,
              record.work_hours?.toFixed(2) || "0",
              `"${record.status}"`,
            ].join(","),
          ),
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `qcc-attendance-report-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.csv`
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
              startDate: startDate.toISOString().split("T")[0],
              endDate: endDate.toISOString().split("T")[0],
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
        a.download = `qcc-attendance-report-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : "pdf"}`
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

  const statusChartData = summary
    ? Object.entries(summary.statusCounts).map(([status, count]) => ({
        name: status.replace("_", " "),
        value: count,
      }))
    : []

  const departmentChartData = summary
    ? Object.entries(summary.departmentStats).map(([dept, stats]) => ({
        name: dept,
        records: stats.count,
        hours: Math.round(stats.totalHours * 100) / 100,
      }))
    : []

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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
              onClick={() => exportReport("pdf")}
              variant="outline"
              disabled={exporting || records.length === 0 || loading}
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
              {exporting ? "Exporting..." : "Export PDF"}
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
                  onClick={() => {
                    const today = new Date()
                    setStartDate(today)
                    setEndDate(today)
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-6 text-orange-700 hover:bg-orange-100"
                  onClick={() => {
                    const today = new Date()
                    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()))
                    setStartDate(weekStart)
                    setEndDate(new Date())
                  }}
                >
                  This Week
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-6 text-orange-700 hover:bg-orange-100"
                  onClick={() => {
                    const today = new Date()
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
                    setStartDate(monthStart)
                    setEndDate(new Date())
                  }}
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
              <div className="text-2xl font-bold text-green-600">{summary.statusCounts.present || 0}</div>
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
                    <Bar dataKey="records" fill="#4B8B3B" />
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
                    <Line type="monotone" dataKey="records" stroke="#4B8B3B" strokeWidth={2} />
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
              <CardDescription>Complete attendance entries for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Loading records...
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          No records found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.check_in_time).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {record.user_profiles.first_name} {record.user_profiles.last_name}
                              </div>
                              <div className="text-sm text-muted-foreground">{record.user_profiles.employee_id}</div>
                            </div>
                          </TableCell>
                          <TableCell>{record.user_profiles.departments?.name || "N/A"}</TableCell>
                          <TableCell>{new Date(record.check_in_time).toLocaleTimeString()}</TableCell>
                          <TableCell>
                            {record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : "N/A"}
                          </TableCell>
                          <TableCell>{record.work_hours?.toFixed(2) || "0"}</TableCell>
                          <TableCell>
                            <Badge variant={record.status === "present" ? "default" : "secondary"}>
                              {record.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.geofence_locations?.name || "N/A"}</TableCell>
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
