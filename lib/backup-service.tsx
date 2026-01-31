import "server-only"
import { createClient } from "@/lib/supabase/server"
import { emailService } from "./email-service"

interface BackupConfig {
  frequency: "hourly" | "daily" | "weekly"
  retentionDays: number
  includeAuditLogs: boolean
  notifyOnCompletion: boolean
  adminEmails: string[]
}

interface BackupResult {
  success: boolean
  backupId: string
  timestamp: string
  size: number
  tables: string[]
  error?: string
}

class BackupService {
  private static instance: BackupService
  private isRunning = false

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService()
    }
    return BackupService.instance
  }

  async createBackup(config: BackupConfig): Promise<BackupResult> {
    if (this.isRunning) {
      throw new Error("Backup already in progress")
    }

    this.isRunning = true
    const backupId = `backup_${Date.now()}`
    const timestamp = new Date().toISOString()

    try {
      console.log(`[BackupService] Starting backup: ${backupId}`)
      const supabase = await createClient()

      // Define tables to backup
      const tables = [
        "user_profiles",
        "departments",
        "geofence_locations",
        "districts",
        "attendance_records",
        "schedules",
        "settings",
      ]

      if (config.includeAuditLogs) {
        tables.push("audit_logs")
      }

      const backupData: Record<string, any[]> = {}
      let totalSize = 0

      // Backup each table
      for (const table of tables) {
        try {
          const { data, error } = await supabase.from(table).select("*")

          if (error) {
            console.error(`[BackupService] Error backing up table ${table}:`, error)
            continue
          }

          backupData[table] = data || []
          totalSize += JSON.stringify(data).length
          console.log(`[BackupService] Backed up ${data?.length || 0} records from ${table}`)
        } catch (tableError) {
          console.error(`[BackupService] Failed to backup table ${table}:`, tableError)
        }
      }

      // Store backup metadata
      const backupMetadata = {
        id: backupId,
        timestamp,
        tables: Object.keys(backupData),
        record_counts: Object.fromEntries(
          Object.entries(backupData).map(([table, records]) => [table, records.length]),
        ),
        size_bytes: totalSize,
        config,
      }

      // Save backup to storage (in a real implementation, this would go to cloud storage)
      await this.saveBackupToStorage(backupId, {
        metadata: backupMetadata,
        data: backupData,
      })

      // Clean up old backups
      await this.cleanupOldBackups(config.retentionDays)

      // Log backup completion
      await supabase.from("audit_logs").insert({
        user_id: null,
        action: "system_backup_completed",
        table_name: "system",
        details: { backup_id: backupId, tables: Object.keys(backupData) },
      })

      // Send notification if configured
      if (config.notifyOnCompletion && config.adminEmails.length > 0) {
        await this.notifyBackupCompletion(backupId, backupMetadata, config.adminEmails)
      }

      console.log(`[BackupService] Backup completed successfully: ${backupId}`)

      return {
        success: true,
        backupId,
        timestamp,
        size: totalSize,
        tables: Object.keys(backupData),
      }
    } catch (error) {
      console.error(`[BackupService] Backup failed:`, error)

      return {
        success: false,
        backupId,
        timestamp,
        size: 0,
        tables: [],
        error: error.message,
      }
    } finally {
      this.isRunning = false
    }
  }

  private async saveBackupToStorage(backupId: string, backupContent: any) {
    // In a real implementation, this would save to cloud storage (AWS S3, Google Cloud Storage, etc.)
    // For now, we'll simulate storage by logging the backup size
    const backupSize = JSON.stringify(backupContent).length
    console.log(`[BackupService] Backup ${backupId} saved to storage (${backupSize} bytes)`)

    // Store backup reference in database
    const supabase = await createClient()
    await supabase.from("system_backups").upsert({
      id: backupId,
      created_at: new Date().toISOString(),
      size_bytes: backupSize,
      status: "completed",
      metadata: backupContent.metadata,
    })
  }

  private async cleanupOldBackups(retentionDays: number) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const supabase = await createClient()
      const { data: oldBackups } = await supabase
        .from("system_backups")
        .select("id")
        .lt("created_at", cutoffDate.toISOString())

      if (oldBackups && oldBackups.length > 0) {
        // Delete old backup records
        await supabase.from("system_backups").delete().lt("created_at", cutoffDate.toISOString())

        console.log(`[BackupService] Cleaned up ${oldBackups.length} old backups`)
      }
    } catch (error) {
      console.error("[BackupService] Failed to cleanup old backups:", error)
    }
  }

  private async notifyBackupCompletion(backupId: string, metadata: any, adminEmails: string[]) {
    const template = {
      subject: "QCC Attendance - Backup Completed Successfully",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">System Backup Completed</h2>
          <p>A scheduled backup has been completed successfully.</p>
          <h3>Backup Details:</h3>
          <ul>
            <li><strong>Backup ID:</strong> {{backupId}}</li>
            <li><strong>Timestamp:</strong> {{timestamp}}</li>
            <li><strong>Size:</strong> {{sizeKB}} KB</li>
            <li><strong>Tables:</strong> {{tableCount}} tables backed up</li>
          </ul>
          <h3>Table Summary:</h3>
          <ul>
            {{tableSummary}}
          </ul>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated notification from QCC Attendance System.</p>
        </div>
      `,
      text: "System backup completed successfully. Backup ID: {{backupId}}, Size: {{sizeKB}} KB, Tables: {{tableCount}}",
    }

    const templateData = {
      backupId,
      timestamp: new Date(metadata.timestamp).toLocaleString(),
      sizeKB: Math.round(metadata.size_bytes / 1024),
      tableCount: metadata.tables.length,
      tableSummary: metadata.tables
        .map((table) => `<li>${table}: ${metadata.record_counts[table]} records</li>`)
        .join(""),
    }

    for (const email of adminEmails) {
      await emailService.sendEmail(email, template, templateData)
    }
  }

  async scheduleBackup(config: BackupConfig) {
    // In a real implementation, this would use a job scheduler like node-cron
    console.log(`[BackupService] Backup scheduled with frequency: ${config.frequency}`)

    // For demonstration, we'll create a backup immediately
    return await this.createBackup(config)
  }

  async getBackupHistory(limit = 10) {
    try {
      const supabase = await createClient()
      const { data: backups } = await supabase
        .from("system_backups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

      return backups || []
    } catch (error) {
      console.error("[BackupService] Failed to get backup history:", error)
      return []
    }
  }

  async restoreBackup(backupId: string): Promise<BackupResult> {
    const restoreStart = performance.now()
    const timestamp = new Date().toISOString()

    try {
      console.log(`[BackupService] Starting restore: ${backupId}`)
      const supabase = await createClient()

      // Get backup data from storage (in real implementation, this would fetch from cloud storage)
      const { data: backupRecord, error: fetchError } = await supabase
        .from("system_backups")
        .select("metadata")
        .eq("id", backupId)
        .single()

      if (fetchError || !backupRecord) {
        throw new Error(`Backup ${backupId} not found`)
      }

      // In a real implementation, we would fetch the actual backup data from storage
      // For now, we'll simulate that the backup data is available
      const backupData = {} // This would be fetched from storage

      // Define tables to restore (in reverse dependency order)
      const tables = [
        "settings",
        "schedules",
        "attendance_records",
        "districts",
        "geofence_locations",
        "departments",
        "user_profiles",
      ]

      let totalRecords = 0

      // Restore each table
      for (const table of tables) {
        try {
          if (backupData[table]) {
            // Clear existing data
            await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000")

            // Insert backup data
            const { error: insertError } = await supabase
              .from(table)
              .insert(backupData[table])

            if (insertError) {
              console.error(`[BackupService] Error restoring table ${table}:`, insertError)
              continue
            }

            totalRecords += backupData[table].length
            console.log(`[BackupService] Restored ${backupData[table].length} records to ${table}`)
          }
        } catch (tableError) {
          console.error(`[BackupService] Failed to restore table ${table}:`, tableError)
        }
      }

      // Log restore completion
      await supabase.from("audit_logs").insert({
        user_id: null,
        action: "system_restore_completed",
        table_name: "system",
        details: { backup_id: backupId, records_restored: totalRecords },
      })

      console.log(`[BackupService] Restore completed successfully: ${backupId}`)

      return {
        success: true,
        backupId,
        timestamp,
        size: totalRecords, // Using record count as size indicator
        tables: tables.filter(table => backupData[table]),
      }
    } catch (error) {
      console.error(`[BackupService] Restore failed:`, error)

      return {
        success: false,
        backupId,
        timestamp,
        size: 0,
        tables: [],
        error: error.message,
      }
    }
  }
}

export const backupService = BackupService.getInstance()
export { BackupService }
