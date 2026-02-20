"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertTriangle,
  Database,
  Users,
  Shield,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Settings,
  Activity,
  Server,
  HardDrive,
  Wifi,
  WifiOff,
  Loader2
} from "lucide-react"
import { toast } from "sonner"

interface SystemStatus {
  database: boolean
  redis: boolean
  email: boolean
  storage: boolean
  lastBackup: string
  uptime: string
}

interface EmergencyAction {
  id: string
  type: 'lock_user' | 'unlock_user' | 'reset_password' | 'disable_feature' | 'enable_feature'
  target: string
  reason: string
  executedBy: string
  timestamp: string
  status: 'pending' | 'completed' | 'failed'
}

export default function EmergencyAdminPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [emergencyActions, setEmergencyActions] = useState<EmergencyAction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<string>('')
  const [actionTarget, setActionTarget] = useState('')
  const [actionReason, setActionReason] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)

  // backup/restore state
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null)

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", config: { frequency: "daily", retentionDays: 30, includeAuditLogs: true, notifyOnCompletion: false, adminEmails: [] } }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Backup failed")
      }
      // support both admin and settings API formats
      const returnedId = data.backupId || data.backup?.backupId
      if (returnedId) {
        alert("Backup completed successfully: " + returnedId)
      } else {
        alert("Backup completed, but no ID was returned")
      }

      // offer file download of the raw backup payload
      try {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${returnedId || 'backup'}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (downloadErr) {
        console.warn("Failed to trigger backup download:", downloadErr)
      }
    } catch (err) {
      console.error("Backup error:", err)
      alert("Backup failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleRestorePrompt = () => {
    const id = prompt("Enter backup ID to restore:")
    if (id) {
      handleRestoreBackup(id)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm("Restoring a backup will overwrite current data. Continue?")) return
    setRestoringBackup(backupId)
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", backupId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Restore failed")
      }
      alert("Restore completed successfully")
      window.location.reload()
    } catch (err) {
      console.error("Restore error:", err)
      alert("Restore failed: " + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRestoringBackup(null)
    }
  }

  const supabase = createClient()

  useEffect(() => {
    loadSystemStatus()
    loadEmergencyActions()
  }, [])

  const loadSystemStatus = async () => {
    try {
      // Check database connection
      const { data: dbTest, error: dbError } = await supabase.from('user_profiles').select('count').limit(1)

      // Check if we can get current user (auth system)
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      // Mock other system checks
      const mockStatus: SystemStatus = {
        database: !dbError,
        redis: true, // Assume Redis is working
        email: false, // Email service status
        storage: true, // Storage status
        lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        uptime: '5d 12h 30m' // Mock uptime
      }

      setSystemStatus(mockStatus)
    } catch (error) {
      console.error('Failed to load system status:', error)
      toast.error('Failed to load system status')
    } finally {
      setLoading(false)
    }
  }

  const loadEmergencyActions = async () => {
    // Mock emergency actions data
    const mockActions: EmergencyAction[] = [
      {
        id: '1',
        type: 'lock_user',
        target: 'user@example.com',
        reason: 'Suspicious activity detected',
        executedBy: 'admin@system.com',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: '2',
        type: 'reset_password',
        target: 'employee@company.com',
        reason: 'Password reset request',
        executedBy: 'admin@system.com',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        status: 'completed'
      }
    ]
    setEmergencyActions(mockActions)
  }

  const executeEmergencyAction = async () => {
    if (!selectedAction || !actionTarget || !actionReason) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsExecuting(true)
    try {
      // Here you would implement the actual emergency actions
      // For now, we'll just simulate the action

      const newAction: EmergencyAction = {
        id: Date.now().toString(),
        type: selectedAction as any,
        target: actionTarget,
        reason: actionReason,
        executedBy: 'current-admin@example.com', // Would get from auth
        timestamp: new Date().toISOString(),
        status: 'completed'
      }

      setEmergencyActions(prev => [newAction, ...prev])
      setSelectedAction('')
      setActionTarget('')
      setActionReason('')

      toast.success(`Emergency action "${selectedAction}" executed successfully`)
    } catch (error) {
      console.error('Failed to execute emergency action:', error)
      toast.error('Failed to execute emergency action')
    } finally {
      setIsExecuting(false)
    }
  }

  const getStatusIcon = (status: boolean) => {
    return status ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />
  }

  const getActionTypeLabel = (type: string) => {
    const labels = {
      lock_user: 'Lock User',
      unlock_user: 'Unlock User',
      reset_password: 'Reset Password',
      disable_feature: 'Disable Feature',
      enable_feature: 'Enable Feature'
    }
    return labels[type as keyof typeof labels] || type
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      completed: 'default',
      failed: 'destructive'
    } as const
    return <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-red-600 flex items-center gap-2">
            <AlertTriangle className="h-8 w-8" />
            Emergency Admin Panel
          </h1>
          <p className="text-muted-foreground mt-2">
            Critical system administration tools - Use with extreme caution
          </p>
        </div>
        <Badge variant="destructive" className="text-lg px-4 py-2">
          ADMIN ONLY
        </Badge>
      </div>

      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>
          This panel contains critical system functions that can affect user access and system stability.
          All actions are logged and audited. Use only when absolutely necessary.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="status" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="status">System Status</TabsTrigger>
          <TabsTrigger value="actions">Emergency Actions</TabsTrigger>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="backup">Backup & Recovery</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Database</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus?.database || false)}
                  <span className="text-2xl font-bold">
                    {systemStatus?.database ? 'Online' : 'Offline'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Authentication</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(true)}
                  <span className="text-2xl font-bold">Online</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Email Service</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus?.email || false)}
                  <span className="text-2xl font-bold">
                    {systemStatus?.email ? 'Online' : 'Offline'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Storage</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(systemStatus?.storage || false)}
                  <span className="text-2xl font-bold">
                    {systemStatus?.storage ? 'Online' : 'Offline'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Current system status and metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Last Backup</Label>
                  <p className="text-sm text-muted-foreground">
                    {systemStatus?.lastBackup ? new Date(systemStatus.lastBackup).toLocaleString() : 'Unknown'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">System Uptime</Label>
                  <p className="text-sm text-muted-foreground">{systemStatus?.uptime || 'Unknown'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Execute Emergency Action</CardTitle>
              <CardDescription>
                Perform critical administrative actions. These actions cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="action-type">Action Type</Label>
                  <Select value={selectedAction} onValueChange={setSelectedAction}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lock_user">Lock User Account</SelectItem>
                      <SelectItem value="unlock_user">Unlock User Account</SelectItem>
                      <SelectItem value="reset_password">Force Password Reset</SelectItem>
                      <SelectItem value="disable_feature">Disable Feature</SelectItem>
                      <SelectItem value="enable_feature">Enable Feature</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action-target">Target</Label>
                  <Input
                    id="action-target"
                    placeholder="User ID, email, or feature name"
                    value={actionTarget}
                    onChange={(e) => setActionTarget(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action-reason">Reason</Label>
                  <Input
                    id="action-reason"
                    placeholder="Reason for action"
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                  />
                </div>
              </div>

              <Button
                onClick={executeEmergencyAction}
                disabled={isExecuting || !selectedAction || !actionTarget || !actionReason}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Execute Emergency Action
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Emergency Actions</CardTitle>
              <CardDescription>History of emergency actions performed</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Executed By</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emergencyActions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="font-medium">
                        {getActionTypeLabel(action.type)}
                      </TableCell>
                      <TableCell>{action.target}</TableCell>
                      <TableCell>{action.reason}</TableCell>
                      <TableCell>{action.executedBy}</TableCell>
                      <TableCell>
                        {new Date(action.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{getStatusBadge(action.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Logs</CardTitle>
              <CardDescription>Critical system events and security logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4" />
                <p>Audit logs would be displayed here</p>
                <p className="text-sm">This feature requires additional implementation</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Backup & Recovery</CardTitle>
              <CardDescription>System backup and recovery operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  className="h-20 flex-col"
                  onClick={() => handleCreateBackup()}
                  disabled={creatingBackup}
                >
                  {creatingBackup ? <Loader2 className="animate-spin h-6 w-6 mb-2" /> : <Download className="h-6 w-6 mb-2" />}
                  {creatingBackup ? "Creating…" : "Create Backup"}
                </Button>
                <Button
                  variant="outline"
                  className="h-20 flex-col"
                  onClick={() => handleRestorePrompt()}
                  disabled={restoringBackup !== null}
                >
                  {restoringBackup ? <Loader2 className="animate-spin h-6 w-6 mb-2" /> : <Upload className="h-6 w-6 mb-2" />}
                  {restoringBackup ? "Restoring…" : "Restore from Backup"}
                </Button>
              </div>

              <div className="text-center py-4 text-muted-foreground">
                <Server className="h-8 w-8 mx-auto mb-2" />
                <p>Backup and recovery features require additional configuration</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}