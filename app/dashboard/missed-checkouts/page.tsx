"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Download, Calendar, User, Clock, MapPin } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface MissedCheckout {
  id: string
  staff_name: string
  employee_id: string
  department: string
  check_in_time: string
  check_in_location_name: string
  attendance_date: string
}

export default function MissedCheckoutsPage() {
  const [missedCheckouts, setMissedCheckouts] = useState<MissedCheckout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7))
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")
  const [departments, setDepartments] = useState<string[]>([])

  useEffect(() => {
    fetchMissedCheckouts()
  }, [selectedMonth, selectedDepartment])

  const fetchMissedCheckouts = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()

      const startOfMonth = `${selectedMonth}-01`
      const endOfMonth = new Date(selectedMonth + "-01")
      endOfMonth.setMonth(endOfMonth.getMonth() + 1)
      const endDate = endOfMonth.toISOString().split("T")[0]

      const query = supabase
        .from("attendance_records")
        .select(`
          id,
          check_in_time,
          check_in_location_name,
          attendance_date,
          user_profiles!inner (
            first_name,
            last_name,
            employee_id,
            departments (
              name
            )
          )
        `)
        .gte("attendance_date", startOfMonth)
        .lt("attendance_date", endDate)
        .is("check_out_time", null)
        .order("attendance_date", { ascending: false })

      const { data, error } = await query

      if (error) throw error

      const formatted = data.map((record: any) => ({
        id: record.id,
        staff_name: `${record.user_profiles.first_name} ${record.user_profiles.last_name}`,
        employee_id: record.user_profiles.employee_id || "N/A",
        department: record.user_profiles.departments?.name || "N/A",
        check_in_time: record.check_in_time,
        check_in_location_name: record.check_in_location_name || "Unknown",
        attendance_date: record.attendance_date,
      }))

      const filtered =
        selectedDepartment === "all"
          ? formatted
          : formatted.filter((r: MissedCheckout) => r.department === selectedDepartment)

      setMissedCheckouts(filtered)

      const uniqueDepts = Array.from(new Set(formatted.map((r: MissedCheckout) => r.department)))
      setDepartments(uniqueDepts as string[])
    } catch (error) {
      console.error("Error fetching missed checkouts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = ["Date", "Employee ID", "Name", "Department", "Check-in Time", "Check-in Location"]
    const rows = missedCheckouts.map((mc) => [
      mc.attendance_date,
      mc.employee_id,
      mc.staff_name,
      mc.department,
      new Date(mc.check_in_time).toLocaleTimeString(),
      mc.check_in_location_name,
    ])

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `missed-checkouts-${selectedMonth}.csv`
    a.click()
  }

  const generateMonthOptions = () => {
    const months = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const value = date.toISOString().slice(0, 7)
      const label = date.toLocaleDateString("en-US", { year: "numeric", month: "long" })
      months.push({ value, label })
    }
    return months
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Missed Checkouts</h1>
          <p className="text-muted-foreground mt-1">Staff who checked in but did not check out</p>
        </div>
        <Button onClick={exportToCSV} disabled={missedCheckouts.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generateMonthOptions().map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Department</label>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Missed Checkouts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{missedCheckouts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Staff</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(missedCheckouts.map((mc) => mc.employee_id)).size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Selected Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Date(selectedMonth).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Missed Checkout Records</CardTitle>
          <CardDescription>Staff members who checked in but did not complete their check-out</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : missedCheckouts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No missed checkouts found for the selected period
            </div>
          ) : (
            <div className="space-y-3">
              {missedCheckouts.map((mc) => (
                <div
                  key={mc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold">{mc.staff_name}</p>
                      <Badge variant="outline">{mc.employee_id}</Badge>
                      <Badge variant="secondary">{mc.department}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(mc.attendance_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Checked in: {new Date(mc.check_in_time).toLocaleTimeString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {mc.check_in_location_name}
                      </span>
                    </div>
                  </div>
                  <Badge variant="destructive" className="ml-4">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    No Checkout
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
