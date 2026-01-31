"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Database, Download, Upload, AlertTriangle, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react"

interface BackupRecord {
  id: string
  created_at: string
  size_bytes: number
  status: string
  metadata: any
  error_message?: string
  completed_at?: string
}

export default function BackupSettingsPage() {
  const [backups, setBackups] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoringBackup, setRestoringBackup] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    fetchBackups()
  }, [])

  const fetchBackups = async () => {
    try {
      const response = await fetch("/api/settings/backup")
      if (response.ok) {
        const data = await response.json()
        setBackups(data.backups)
      }
    } catch (error) {
      console.error("Error fetching backups:", error)
      toast.error("Failed to load backup history")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBackup = async (config: any) => {
    setCreatingBackup(true)
    try {
      const response = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", config }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Backup created successfully")
        setShowCreateDialog(false)
        fetchBackups()
      } else {
        toast.error(data.error || "Failed to create backup")
      }
    } catch (error) {
      console.error("Error creating backup:", error)
      toast.error("Failed to create backup")
    } finally {
      setCreatingBackup(false)
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm("Are you sure you want to restore this backup? This will overwrite current data.")) {
      return
    }

    setRestoringBackup(backupId)
    try {
      const response = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", backupId }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success("Database restored successfully")
        // Refresh the page to reflect restored data
        window.location.reload()
      } else {
        toast.error(data.error || "Failed to restore backup")
      }
    } catch (error) {
      console.error("Error restoring backup:", error)
      toast.error("Failed to restore backup")
    } finally {
      setRestoringBackup(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "pending":
        return <Badge variant="secondary">Pending</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Database Backup & Restore</h1>
            <p className="text-muted-foreground mt-2">
              Create backups of your system data and restore from previous backups when needed
            </p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Database className="h-4 w-4 mr-2" />
                Create Backup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Database Backup</DialogTitle>
                <DialogDescription>
                  Create a backup of your current system data. This process may take several minutes.
                </DialogDescription>
              </DialogHeader>
              <BackupConfigForm
                onSubmit={handleCreateBackup}
                loading={creatingBackup}
                onCancel={() => setShowCreateDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Backup History</CardTitle>
            <CardDescription>
              View and manage your system backups. Recent backups are shown first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {backups.length === 0 ? (
              <div className="text-center py-8">
                <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No backups found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first backup to get started
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Tables</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backups.map((backup) => (
                    <TableRow key={backup.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(backup.status)}
                          {getStatusBadge(backup.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(backup.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{formatFileSize(backup.size_bytes)}</TableCell>
                      <TableCell>
                        {backup.metadata?.tables?.length || 0} tables
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {backup.status === "completed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreBackup(backup.id)}
                              disabled={restoringBackup === backup.id}
                            >
                              {restoringBackup === backup.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Upload className="h-4 w-4 mr-2" />
                              )}
                              Restore
                            </Button>
                          )}
                          {backup.error_message && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toast.error(`Backup Error: ${backup.error_message}`)}
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-5 w-5" />
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
            <p>• Backups contain all system data including user profiles, attendance records, and settings</p>
            <p>• Restore operations will completely replace current data with backup data</p>
            <p>• Always create a backup before performing major system changes</p>
            <p>• Restored data cannot be undone - proceed with caution</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

function BackupConfigForm({
  onSubmit,
  loading,
  onCancel
}: {
  onSubmit: (config: any) => void
  loading: boolean
  onCancel: () => void
}) {
  const [config, setConfig] = useState({
    frequency: "daily",
    retentionDays: 30,
    includeAuditLogs: true,
    notifyOnCompletion: false,
    adminEmails: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submitConfig = {
      ...config,
      adminEmails: config.adminEmails.split(",").map(email => email.trim()).filter(email => email),
    }
    onSubmit(submitConfig)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="frequency">Backup Frequency</Label>
        <Select
          value={config.frequency}
          onValueChange={(value) => setConfig({ ...config, frequency: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hourly">Hourly</SelectItem>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="retention">Retention Period (days)</Label>
        <Input
          id="retention"
          type="number"
          value={config.retentionDays}
          onChange={(e) => setConfig({ ...config, retentionDays: parseInt(e.target.value) })}
          min="1"
          max="365"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="auditLogs"
          checked={config.includeAuditLogs}
          onCheckedChange={(checked) => setConfig({ ...config, includeAuditLogs: !!checked })}
        />
        <Label htmlFor="auditLogs">Include audit logs</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="notify"
          checked={config.notifyOnCompletion}
          onCheckedChange={(checked) => setConfig({ ...config, notifyOnCompletion: !!checked })}
        />
        <Label htmlFor="notify">Send notification on completion</Label>
      </div>

      {config.notifyOnCompletion && (
        <div>
          <Label htmlFor="emails">Admin Email Addresses (comma-separated)</Label>
          <Input
            id="emails"
            type="email"
            value={config.adminEmails}
            onChange={(e) => setConfig({ ...config, adminEmails: e.target.value })}
            placeholder="admin@example.com, manager@example.com"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating...
            </>
          ) : (
            <>
              <Database className="h-4 w-4 mr-2" />
              Create Backup
            </>
          )}
        </Button>
      </div>
    </form>
  )
}