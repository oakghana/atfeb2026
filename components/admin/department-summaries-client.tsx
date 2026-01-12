"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Calendar,
  Download,
  TrendingUp,
  Users,
  AlertTriangle,
  ArrowLeft,
  Clock,
  LogIn,
  LogOut,
  User,
  Search,
  Filter,
} from "lucide-react"
import Link from "next/link"

interface Summary {
  userId: string
  name: string
  email: string
  employeeId: string
  department: string
  daysWorked: number
  daysAbsent: number
  totalWorkHours: string
  daysOnTime: number
  daysLate: number
  attendanceRate: string
  status: string
  hasCheckedOutToday: boolean
}

interface DepartmentSummariesClientProps {
  userRole: string
  departmentId?: string
}

export function DepartmentSummariesClient({ userRole, departmentId }: DepartmentSummariesClientProps) {
  const [period, setPeriod] = useState<"weekly" | "monthly" | "yearly">("weekly")
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ start: "", end: "" })
  const [totalStaff, setTotalStaff] = useState(0)

  const [searchQuery, setSearchQuery] = useState("")
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [weekFilter, setWeekFilter] = useState<string>("current")
  const [monthFilter, setMonthFilter] = useState<string>(new Date().getMonth().toString())

  const [selectedStaff, setSelectedStaff] = useState<Summary | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    fetchDepartments()
  }, [])

  useEffect(() => {
    fetchSummaries()
  }, [period, selectedDepartment, weekFilter, monthFilter])

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/admin/departments")
      if (response.ok) {
        const data = await response.json()
        setDepartments(data.departments || [])
      }
    } catch (error) {
      console.error("Error fetching departments:", error)
    }
  }

  const fetchSummaries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (selectedDepartment !== "all" && userRole === "admin") {
        params.append("departmentId", selectedDepartment)
      }

      const response = await fetch(`/api/admin/department-summaries?${params}`)
      if (response.ok) {
        const data = await response.json()
        setSummaries(data.summaries)
        setDateRange({ start: data.startDate, end: data.endDate })
        setTotalStaff(data.totalStaff)
      }
    } catch (error) {
      console.error("Error fetching summaries:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSummaries = useMemo(() => {
    let filtered = summaries

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.email.toLowerCase().includes(query) ||
          s.employeeId.toLowerCase().includes(query) ||
          s.department.toLowerCase().includes(query),
      )
    }

    return filtered
  }, [summaries, searchQuery])

  const getWeekOptions = () => {
    const weeks = []
    const today = new Date()
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay() - i * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      weeks.push({
        value: i.toString(),
        label:
          i === 0
            ? "Current Week"
            : i === 1
              ? "Last Week"
              : `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      })
    }
    return weeks
  }

  const getMonthOptions = () => {
    const months = []
    const today = new Date()
    for (let i = 0; i < 12; i++) {
      const month = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push({
        value: month.getMonth().toString(),
        label: month.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      })
    }
    return months
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "excellent":
        return <Badge className="bg-green-500">Excellent</Badge>
      case "good":
        return <Badge className="bg-blue-500">Good</Badge>
      default:
        return <Badge className="bg-orange-500">Needs Attention</Badge>
    }
  }

  const handleStaffClick = (summary: Summary) => {
    setSelectedStaff(summary)
    setShowDetailModal(true)
  }

  const exportToCSV = () => {
    const headers = [
      "Name",
      "Employee ID",
      "Department",
      "Days Worked",
      "Days Absent",
      "Total Hours",
      "On Time",
      "Late",
      "Attendance Rate",
      "Status",
    ]
    const rows = filteredSummaries.map((s) => [
      s.name,
      s.employeeId,
      s.department,
      s.daysWorked,
      s.daysAbsent,
      s.totalWorkHours,
      s.daysOnTime,
      s.daysLate,
      `${s.attendanceRate}%`,
      s.status,
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `department-summary-${period}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
  }

  const totalDaysWorked = filteredSummaries.reduce((sum, s) => sum + s.daysWorked, 0)
  const totalAbsences = filteredSummaries.reduce((sum, s) => sum + s.daysAbsent, 0)
  const avgAttendanceRate =
    filteredSummaries.length > 0
      ? (
          filteredSummaries.reduce((sum, s) => sum + Number.parseFloat(s.attendanceRate), 0) / filteredSummaries.length
        ).toFixed(1)
      : "0.0"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Department Attendance Summaries</h1>
            <p className="text-muted-foreground">
              {dateRange.start &&
                `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
          <CardDescription>Filter by department, time period, or search for specific staff</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Staff</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Name, email, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {userRole === "admin" && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger id="department">
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
            )}

            {period === "weekly" && (
              <div className="space-y-2">
                <Label htmlFor="week">Week</Label>
                <Select value={weekFilter} onValueChange={setWeekFilter}>
                  <SelectTrigger id="week">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getWeekOptions().map((week) => (
                      <SelectItem key={week.value} value={week.value}>
                        {week.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {period === "monthly" && (
              <div className="space-y-2">
                <Label htmlFor="month">Month</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger id="month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getMonthOptions().map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedDepartment("all")
                  setWeekFilter("current")
                  setMonthFilter(new Date().getMonth().toString())
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Staff</p>
                <p className="text-2xl font-bold">{filteredSummaries.length}</p>
                {searchQuery && <p className="text-xs text-muted-foreground">of {totalStaff} total</p>}
              </div>
              <Users className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-2xl font-bold">{avgAttendanceRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Days Worked</p>
                <p className="text-2xl font-bold">{totalDaysWorked}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Absences</p>
                <p className="text-2xl font-bold">{totalAbsences}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff Attendance Details</CardTitle>
          <CardDescription>
            {filteredSummaries.length === summaries.length
              ? "Click on any staff member to view detailed summary"
              : `Showing ${filteredSummaries.length} of ${summaries.length} staff members`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : filteredSummaries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "No staff found matching your search" : "No data available for this period"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-center">Days Worked</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">On Time</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Total Hours</TableHead>
                  <TableHead className="text-center">Attendance Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSummaries.map((summary) => (
                  <TableRow
                    key={summary.userId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleStaffClick(summary)}
                  >
                    <TableCell className="font-medium">{summary.name}</TableCell>
                    <TableCell>{summary.employeeId}</TableCell>
                    <TableCell>{summary.department}</TableCell>
                    <TableCell className="text-center">{summary.daysWorked}</TableCell>
                    <TableCell className="text-center">
                      <span className={summary.daysAbsent > 0 ? "text-orange-600 font-semibold" : ""}>
                        {summary.daysAbsent}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-green-600">{summary.daysOnTime}</TableCell>
                    <TableCell className="text-center">
                      <span className={summary.daysLate > 0 ? "text-orange-600 font-semibold" : ""}>
                        {summary.daysLate}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{summary.totalWorkHours}h</TableCell>
                    <TableCell className="text-center">{summary.attendanceRate}%</TableCell>
                    <TableCell>{getStatusBadge(summary.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedStaff && (
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-2">
                <User className="h-6 w-6 text-primary" />
                Staff Attendance Summary
              </DialogTitle>
              <DialogDescription>
                {dateRange.start &&
                  `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Staff Member</p>
                  <p className="text-2xl font-bold">{selectedStaff.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedStaff.email}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">Employee ID:</span> {selectedStaff.employeeId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Department:</span> {selectedStaff.department}
                  </p>
                </div>
                {getStatusBadge(selectedStaff.status)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Calendar className="h-5 w-5 text-green-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-green-600">{selectedStaff.daysWorked}</div>
                      <p className="text-xs text-muted-foreground mt-1">Days Worked</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Clock className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-blue-600">{selectedStaff.totalWorkHours}h</div>
                      <p className="text-xs text-muted-foreground mt-1">Total Hours</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <TrendingUp className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-purple-600">{selectedStaff.attendanceRate}%</div>
                      <p className="text-xs text-muted-foreground mt-1">Attendance Rate</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <LogIn className="h-5 w-5 text-emerald-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-emerald-600">{selectedStaff.daysOnTime}</div>
                      <p className="text-xs text-muted-foreground mt-1">On Time</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <LogOut className="h-5 w-5 text-orange-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-orange-600">{selectedStaff.daysLate}</div>
                      <p className="text-xs text-muted-foreground mt-1">Late Arrivals</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <AlertTriangle className="h-5 w-5 text-red-600 mx-auto mb-2" />
                      <div className="text-3xl font-bold text-red-600">{selectedStaff.daysAbsent}</div>
                      <p className="text-xs text-muted-foreground mt-1">Days Absent</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedStaff.daysAbsent > 0 && (
                <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="font-semibold text-orange-900">Attendance Alert</p>
                    <p className="text-sm text-orange-700">
                      This staff member was absent {selectedStaff.daysAbsent} day(s) during this period
                    </p>
                  </div>
                </div>
              )}

              {selectedStaff.status === "excellent" && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">Excellent Performance</p>
                    <p className="text-sm text-green-700">This staff member has maintained excellent attendance</p>
                  </div>
                </div>
              )}

              <Button onClick={() => setShowDetailModal(false)} className="w-full">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
