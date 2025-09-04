"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  Filter,
  Download,
  Eye,
  Calendar,
  User,
  Activity,
  Clock,
  MapPin,
  Settings,
  UserPlus,
  LogIn,
  LogOut,
} from "lucide-react"
import { format } from "date-fns"

interface AuditLog {
  id: string
  user_id: string
  action: string
  table_name: string
  record_id: string
  old_values: any
  new_values: any
  ip_address: string
  user_agent: string
  created_at: string
  user_profiles: {
    first_name: string
    last_name: string
    employee_id: string
    email: string
  }
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function AuditLogsClient() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  const [filters, setFilters] = useState({
    action: "all",
    user_id: "",
    start_date: "",
    end_date: "",
    search: "",
  })

  const actionIcons: Record<string, any> = {
    check_in: Clock,
    check_out: Clock,
    login: LogIn,
    logout: LogOut,
    create_staff: UserPlus,
    update_staff: User,
    delete_staff: User,
    create_location: MapPin,
    update_location: MapPin,
    delete_location: MapPin,
    update_settings: Settings,
    default: Activity,
  }

  const actionColors: Record<string, string> = {
    check_in: "bg-green-100 text-green-800",
    check_out: "bg-blue-100 text-blue-800",
    login: "bg-emerald-100 text-emerald-800",
    logout: "bg-gray-100 text-gray-800",
    create_staff: "bg-purple-100 text-purple-800",
    update_staff: "bg-yellow-100 text-yellow-800",
    delete_staff: "bg-red-100 text-red-800",
    create_location: "bg-indigo-100 text-indigo-800",
    update_location: "bg-orange-100 text-orange-800",
    delete_location: "bg-red-100 text-red-800",
    update_settings: "bg-cyan-100 text-cyan-800",
  }

  useEffect(() => {
    fetchAuditLogs()
  }, [pagination.page, filters])

  const fetchAuditLogs = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.action !== "all" && { action: filters.action }),
        ...(filters.user_id && { user_id: filters.user_id }),
        ...(filters.start_date && { start_date: filters.start_date }),
        ...(filters.end_date && { end_date: filters.end_date }),
      })

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch audit logs")
      }

      setAuditLogs(result.data)
      setPagination(result.pagination)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to fetch audit logs")
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
    setPagination({ ...pagination, page: 1 })
  }

  const clearFilters = () => {
    setFilters({
      action: "all",
      user_id: "",
      start_date: "",
      end_date: "",
      search: "",
    })
    setPagination({ ...pagination, page: 1 })
  }

  const exportAuditLogs = async () => {
    try {
      const params = new URLSearchParams({
        ...filters,
        export: "true",
      })

      const response = await fetch(`/api/admin/audit-logs/export?${params}`)
      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      setError("Failed to export audit logs")
    }
  }

  const getActionIcon = (action: string) => {
    const IconComponent = actionIcons[action] || actionIcons.default
    return <IconComponent className="h-4 w-4" />
  }

  const getActionColor = (action: string) => {
    return actionColors[action] || "bg-gray-100 text-gray-800"
  }

  const formatUserAgent = (userAgent: string) => {
    if (!userAgent) return "Unknown"

    // Extract browser and OS info
    const browser = userAgent.includes("Chrome")
      ? "Chrome"
      : userAgent.includes("Firefox")
        ? "Firefox"
        : userAgent.includes("Safari")
          ? "Safari"
          : "Unknown"

    const os = userAgent.includes("Windows")
      ? "Windows"
      : userAgent.includes("Mac")
        ? "macOS"
        : userAgent.includes("Linux")
          ? "Linux"
          : userAgent.includes("Android")
            ? "Android"
            : userAgent.includes("iOS")
              ? "iOS"
              : "Unknown"

    return `${browser} on ${os}`
  }

  if (loading && auditLogs.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          Loading audit logs...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor all system activities and user actions for security and compliance
          </p>
        </div>
        <Button onClick={exportAuditLogs} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="action">Action Type</Label>
              <Select value={filters.action} onValueChange={(value) => handleFilterChange("action", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="check_in">Check In</SelectItem>
                  <SelectItem value="check_out">Check Out</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="create_staff">Create Staff</SelectItem>
                  <SelectItem value="update_staff">Update Staff</SelectItem>
                  <SelectItem value="delete_staff">Delete Staff</SelectItem>
                  <SelectItem value="create_location">Create Location</SelectItem>
                  <SelectItem value="update_location">Update Location</SelectItem>
                  <SelectItem value="update_settings">Update Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange("start_date", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange("end_date", e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={clearFilters} variant="outline" className="w-full bg-transparent">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
          <CardDescription>
            Showing {auditLogs.length} of {pagination.total} audit entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className="flex-shrink-0">
                    <Badge className={`${getActionColor(log.action)} flex items-center gap-1`}>
                      {getActionIcon(log.action)}
                      {log.action.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {log.user_profiles?.first_name} {log.user_profiles?.last_name}
                      </span>
                      <span className="text-sm text-muted-foreground">({log.user_profiles?.employee_id})</span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-2">{log.user_profiles?.email}</p>

                    {log.table_name && (
                      <p className="text-sm">
                        Action performed on: <span className="font-medium">{log.table_name}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.created_at), "MMM dd, yyyy 'at' HH:mm:ss")}
                      </span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                      {log.user_agent && <span>{formatUserAgent(log.user_agent)}</span>}
                    </div>
                  </div>
                </div>

                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {auditLogs.length === 0 && !loading && (
              <div className="text-center py-8 text-muted-foreground">No audit logs found matching your criteria</div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
