"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Calendar,
  Clock,
  Download,
  FileSpreadsheet,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Navigation,
} from "lucide-react"

interface AttendanceRecord {
  id: string
  check_in_time: string
  check_out_time?: string
  work_hours?: number
  status: string
  check_in_method?: string
  check_out_method?: string
  check_in_location_name?: string
  check_out_location_name?: string
  is_remote_location?: boolean
  geofence_locations?: {
    name: string
    address: string
  }
  checkout_location?: {
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

const COLORS = ["#4B8B3B", "#f97316", "#6b7280", "#8B5CF6", "#ea580c"]

export function PersonalAttendanceHistory() {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [summary, setSummary] = useState<AttendanceSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setMonth(date.getMonth() - 1)
    return date.toISOString().split("T")[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0]
  })

  useEffect(() => {
    fetchPersonalAttendance()
  }, [startDate, endDate])

  const fetchPersonalAttendance = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/attendance/personal?startDate=${startDate}&endDate=${endDate}`)

      if (!response.ok) {
        throw new Error("Failed to fetch attendance data")
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setRecords(data.records || [])

      if (data.summary) {
        setSummary({
          totalRecords: data.summary.totalDays,
          totalWorkHours: data.summary.totalHours,
          averageWorkHours: data.summary.averageHours,
          statusCounts: data.summary.statusCounts,
          monthlyStats: data.summary.monthlyStats,
        })
      } else {
        setSummary(null)
      }
    } catch (error) {
      console.error("Failed to fetch personal attendance:", error)
      setError("Failed to load attendance history")
    } finally {
      setLoading(false)
    }
  }

  const exportPersonalAttendance = async (format: "csv" | "excel") => {
    setExporting(true)
    setError(null)

    try {
      const response = await fetch("/api/attendance/personal-export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          format,
          startDate,
          endDate,
        }),
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `my-attendance-${startDate}-to-${endDate}.${format === "excel" ? "xlsx" : "csv"}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Export error:", error)
      setError("Failed to export attendance data")
    } finally {
      setExporting(false)
    }
  }

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

  const statusChartData = summary
    ? Object.entries(summary.statusCounts || {}).map(([status, count]) => ({
        name: status.replace("_", " "),
        value: count,
      }))
    : []

  const monthlyChartData = summary
    ? Object.entries(summary.monthlyStats || {}).map(([month, stats]) => ({
        month,
        records: stats.count,
        hours: Math.round(stats.totalHours * 100) / 100,
      }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">My Attendance History</h2>
        <p className="text-muted-foreground mt-1">
          View and export your personal attendance records with location tracking
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range Selection
          </CardTitle>
          <CardDescription>Select the date range for your attendance history</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-4">
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
              <Label>Quick Select</Label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setQuickDate("today")}>
                  Today
                </Button>
                <Button size="sm" variant="outline" onClick={() => setQuickDate("week")}>
                  Week
                </Button>
              </div>
            </div>
            <div>
              <Label>Actions</Label>
              <div className="flex gap-2">
                <Button onClick={fetchPersonalAttendance} disabled={loading} size="sm">
                  {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Calendar className="mr-1 h-3 w-3" />}
                  {loading ? "Loading..." : "Update"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button
              onClick={() => exportPersonalAttendance("csv")}
              variant="outline"
              disabled={exporting || records.length === 0}
              className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
            >
              {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export CSV
            </Button>
            <Button
              onClick={() => exportPersonalAttendance("excel")}
              variant="outline"
              disabled={exporting || records.length === 0}
              className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Days</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{summary.totalRecords}</div>
              <p className="text-xs text-muted-foreground">Attendance records</p>
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
              <CardTitle className="text-sm font-medium">Average Hours</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{summary.averageWorkHours.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Hours per day</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Days</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.statusCounts.present || 0}</div>
              <p className="text-xs text-muted-foreground">On-time attendance</p>
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
                <CardTitle>Attendance Status</CardTitle>
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

            <Card>
              <CardHeader>
                <CardTitle>Monthly Attendance</CardTitle>
                <CardDescription>Your attendance records by month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="records" fill="#4B8B3B" />
                  </BarChart>
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
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
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
              <CardTitle>Detailed Records</CardTitle>
              <CardDescription>Complete list of your attendance records with location tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check In Location</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Check Out Location</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Off-Premises Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Loading records...
                        </TableCell>
                      </TableRow>
                    ) : records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          No attendance records found for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.check_in_time).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{new Date(record.check_in_time).toLocaleTimeString()}</span>
                              <Badge variant="outline" className="text-xs w-fit">
                                {record.check_in_method || "GPS"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">
                              {record.check_in_location_name || record.geofence_locations?.name || "N/A"}
                            </span>
                            {record.is_remote_location && (
                              <Badge variant="outline" className="text-xs">
                                <Navigation className="h-3 w-3 mr-1" />
                                Remote
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.check_out_time ? (
                              <div className="flex flex-col">
                                <span>{new Date(record.check_out_time).toLocaleTimeString()}</span>
                                <Badge variant="outline" className="text-xs w-fit">
                                  {record.check_out_method || "GPS"}
                                </Badge>
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell>
                            {record.check_out_location_name || record.checkout_location?.name ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-sm">
                                  {record.check_out_location_name || record.checkout_location?.name}
                                </span>
                              </div>
                            ) : (
                              "N/A"
                            )}
                          </TableCell>
                          <TableCell>{record.work_hours?.toFixed(2) || "0"}</TableCell>
                          <TableCell>
                            <Badge variant={record.status === "present" ? "default" : "secondary"}>
                              {record.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {record.approval_status === "pending_supervisor_approval" && (
                                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                  ⏳ Pending Approval
                                </Badge>
                              )}
                              {record.approval_status === "approved_offpremises" && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                  ✓ Off-Premises Approved
                                </Badge>
                              )}
                              {record.on_official_duty_outside_premises && (
                                <div className="text-xs text-gray-600 mt-1 p-1 bg-blue-50 rounded">
                                  {record.supervisor_approval_remarks}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {record.is_remote_location && (
                                <Badge variant="outline" className="text-xs">
                                  Remote Location
                                </Badge>
                              )}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
