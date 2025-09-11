"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserCheck, UserX, Search, Filter, Clock, CheckCircle, XCircle } from "lucide-react"
import { safeObjectAccess, createAbortController, safeAsyncOperation } from "@/lib/safe-utils"

interface PendingUser {
  id: string
  email: string
  first_name: string
  last_name: string
  employee_id: string
  position: string
  region: string
  department_name: string
  created_at: string
  approval_status: "pending" | "approved" | "rejected"
}

export function UserApprovalsClient() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [filteredUsers, setFilteredUsers] = useState<PendingUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [processingUsers, setProcessingUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPendingUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [pendingUsers, searchTerm, statusFilter])

  const fetchPendingUsers = async () => {
    const controller = createAbortController(15000)

    try {
      console.log("[v0] Fetching pending users...")
      const supabase = createClient()

      const { data, error } = await supabase
        .from("user_profiles")
        .select(`
          id,
          email,
          first_name,
          last_name,
          employee_id,
          position,
          created_at,
          is_active,
          department_id,
          departments:department_id(name)
        `)
        .eq("is_active", false)
        .order("created_at", { ascending: false })
        .abortSignal(controller.signal)

      console.log("[v0] Query result:", { data, error })

      if (error) {
        console.error("[v0] Supabase error:", error)
        throw error
      }

      const formattedUsers =
        data?.map((user) => ({
          ...user,
          first_name: user.first_name || "Unknown",
          last_name: user.last_name || "User",
          email: user.email || "No email",
          employee_id: user.employee_id || "No ID",
          position: user.position || "No position",
          department_name: safeObjectAccess(user, "departments.name") || "No Department",
          region: "Ghana", // Default region since it's not in user_profiles
          approval_status: "pending" as const,
        })) || []

      console.log("[v0] Formatted users:", formattedUsers)
      setPendingUsers(formattedUsers)
    } catch (error) {
      console.error("[v0] Error fetching pending users:", error)
      if (error instanceof Error && error.name === "AbortError") {
        setError("Request timed out. Please refresh the page.")
      } else {
        const message = error instanceof Error ? error.message : "Unknown error"
        setError(`Failed to load pending users: ${message}`)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = pendingUsers

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.first_name?.toLowerCase().includes(searchLower) ||
          user.last_name?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.employee_id?.toLowerCase().includes(searchLower),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((user) => user.approval_status === statusFilter)
    }

    setFilteredUsers(filtered)
  }

  const handleApproval = async (userId: string, approve: boolean) => {
    if (processingUsers.has(userId)) {
      return
    }

    setProcessingUsers((prev) => new Set(prev).add(userId))

    const controller = createAbortController(10000)

    try {
      console.log(`[v0] ${approve ? "Approving" : "Rejecting"} user:`, userId)
      const supabase = createClient()

      const { error } = await supabase
        .from("user_profiles")
        .update({
          is_active: approve,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .abortSignal(controller.signal)

      if (error) {
        console.error("[v0] Error updating user:", error)
        throw error
      }

      await safeAsyncOperation(
        async () => {
          await supabase.from("audit_logs").insert({
            user_id: userId,
            action: approve ? "user_approved" : "user_rejected",
            table_name: "user_profiles",
            new_values: { is_active: approve },
            ip_address: "admin_action",
            user_agent: "admin_dashboard",
          })
        },
        undefined,
        (auditError) => {
          console.warn("[v0] Failed to log audit entry:", auditError)
          // Don't fail the main operation if audit logging fails
        },
      )

      // Refresh the list
      await fetchPendingUsers()

      setError(null)
      console.log(`[v0] User ${approve ? "approved" : "rejected"} successfully`)
    } catch (error) {
      console.error(`[v0] Error ${approve ? "approving" : "rejecting"} user:`, error)
      if (error instanceof Error && error.name === "AbortError") {
        setError("Request timed out. Please try again.")
      } else {
        const message = error instanceof Error ? error.message : "Unknown error"
        setError(`Failed to ${approve ? "approve" : "reject"} user: ${message}`)
      }
    } finally {
      setProcessingUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 animate-spin" />
          <span>Loading pending approvals...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Approvals</h1>
          <p className="text-muted-foreground">Manage pending user registrations and account approvals</p>
        </div>
        <Badge variant="secondary" className="text-lg px-3 py-1">
          {filteredUsers.length} Pending
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Pending User Registrations
          </CardTitle>
          <CardDescription>Review and approve new user accounts to grant system access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or employee ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                maxLength={100}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No pending approvals</h3>
              <p className="text-muted-foreground">All user registrations have been processed</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User Details</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Registration Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const isProcessing = processingUsers.has(user.id)
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {user.employee_id} • {user.position}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.department_name}</TableCell>
                      <TableCell>{user.region}</TableCell>
                      <TableCell>
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApproval(user.id, true)}
                            className="bg-green-600 hover:bg-green-700"
                            disabled={isProcessing}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            {isProcessing ? "Processing..." : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleApproval(user.id, false)}
                            disabled={isProcessing}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            {isProcessing ? "Processing..." : "Reject"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
