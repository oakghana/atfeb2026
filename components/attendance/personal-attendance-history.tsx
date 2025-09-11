"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
} from "recharts"
import {
  BarChart3,
  Download,
  CalendarIcon,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  MapPin,
  Loader2,
  User,
  TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time?: string
  work_hours?: number
  status: string
  geofence_locations?: {
    name: string
    address: string
  }
  check_out_location?: {
    name: string
    address: string
  }
}

interface AttendanceSummary {
  totalRecords: number
  totalWorkHours: number
  averageWorkHours: number
  statusCounts: Record<string, number>
  monthlyStats: Record<string, { count: number; totalHours: number }>
}

const COLORS = ["#4B8B3B", "#8B5CF6", "#6b7280", "#f97316", "#ea580c"]

export function PersonalAttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const [endDate, setEndDate] = useState<Date>(new Date())
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    fetchMyAttendance()
  }, [startDate, endDate])

  const fetchMyAttendance = async () => {
    setLoading(true)
    setExportError(null)
    try {
      console.log(
        "[v0] Fetching personal attendance with dates:",
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
      )

      const params = new URLSearchParams({
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      })

      console.log("[v0] API call URL:", `/api/admin/reports/attendance?${params}`)

      const response = await fetch(`/api/admin/reports/attendance?${params}`)
      const result = await response.json()

      console.log("[v0] API response:", result)

      if (result.success) {
        setRecords(result.data.records || [])
        setSummary(result.data.summary || null)
        console.log("[v0] Successfully loaded", result.data.records?.length || 0, "personal records")
      } else {
        console.error("[v0] API error:", result.error)
        setExportError(result.error || "Failed to fetch attendance data")
      }
    } catch (error) {
      console.error("[v0] Failed to fetch personal attendance:", error)
      setExportError("Failed to fetch attendance data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const exportMyAttendance = async (format: "excel" | "pdf" | "csv") => {
    setExporting(true)
    setExportError(null)

    try {
      console.log(`[v0] Starting ${format} export for personal attendance...`)

      if (format === "csv") {
        const csvContent = [
          ["Date", "Check In", "Check Out", "Work Hours", "Status", "Check-in Location", "Check-out Location"].join(
            ",",
          ),
          ...records.map((record) =>
            [
              new Date(record.check_in_time).toLocaleDateString(),
              `"${new Date(record.check_in_time).toLocaleTimeString()}"`,
              `"${record.check_out_time ? new Date(record.check_out_time).toLocaleTimeString() : "N/A"}"`,
              record.work_hours?.toFixed(2) || "0",
              `"${record.status}"`,
              `"${record.geofence_locations?.name || "N/A"}"`,
              `"${record.check_out_location?.name || record.geofence_locations?.name || "N/A"}"`,
            ].join(","),
          ),
        ].join("\n")

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `my-attendance-report-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        console.log("[v0] CSV export completed successfully")
      } else {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000)

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
              reportType: "personal_attendance",
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
        a.download = `my-attendance-report-${startDate.toISOString().split("T")[0]}-to-${endDate.toISOString().split("T")[0]}.${format === "excel" ? "xlsx" : "pdf"}`
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

  const statusChartData = summary?.statusCounts
    ? Object.entries(summary.statusCounts).map(([status, count]) => ({
        name: status.replace("_", " "),
        value: count,
      }))
    : []

  const monthlyChartData = summary?.monthlyStats
    ? Object.entries(summary.monthlyStats).map(([month, stats]) => ({
        name: month,
        records: stats?.count || 0,
        hours: Math.round((stats?.totalHours || 0) * 100) / 100,
      }))
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <User className="h-8 w-8" />
            My Attendance History
          </h1>
          <p className="text-muted-foreground mt-2">View your personal attendance records and export your reports</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Personal Attendance Report & Export
          </CardTitle>
          <CardDescription>
            Filter your attendance records by date range and export your personal reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exportError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{exportError}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-4">
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
            <div className="flex flex-col gap-2">
              <Label>Quick Select</Label>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs bg-transparent"
                  onClick={() => {
                    const today = new Date()
                    setStartDate(today)
                    setEndDate(today)
                  }}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs bg-transparent"
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
            </div>
            <div className="flex flex-col gap-2">
              <Label>Actions</Label>
              <Button onClick={fetchMyAttendance} size="sm" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <FileText className="mr-1 h-3 w-3" />
                    Refresh
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button
              onClick={() => exportMyAttendance("excel")}
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
              onClick={() => exportMyAttendance("csv")}
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
                No attendance records found for the selected date range. Try adjusting your date filters.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Records</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{summary?.totalRecords || 0}</div>
              <p className="text-xs text-muted-foreground">Attendance entries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Days</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary?.statusCounts?.present || 0}</div>
              <p className="text-xs text-muted-foreground">On time arrivals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{Math.round(summary?.totalWorkHours || 0)}</div>
              <p className="text-xs text-muted-foreground">Work hours logged</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Hours</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{(summary?.averageWorkHours || 0).toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Per day average</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Attendance</CardTitle>
                <CardDescription>Your attendance records by month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyChartData}>
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
                <CardDescription>Breakdown of your attendance statuses</CardDescription>
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
          <Card>
            <CardHeader>
              <CardTitle>Work Hours Trend</CardTitle>
              <CardDescription>Your work hours over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="hours" stroke="#4B8B3B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
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
                        <TableCell colSpan={6} className="text-center py-8">
                          Loading records...
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          No records found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.check_in_time).toLocaleDateString()}</TableCell>
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
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{record.geofence_locations?.name || "N/A"}</span>
                            </div>
                          </TableCell>
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
