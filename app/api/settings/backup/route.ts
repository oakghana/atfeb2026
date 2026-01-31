import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { backupService } from "@/lib/backup-service"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    // Get backup history
    const backups = await backupService.getBackupHistory(20)

    return NextResponse.json({ backups })
  } catch (error) {
    console.error("Error fetching backup history:", error)
    return NextResponse.json(
      { error: "Failed to fetch backup history" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Admin role required." }, { status: 403 })
    }

    const { action, backupId, config } = await request.json()

    if (action === "create") {
      if (!config) {
        return NextResponse.json({ error: "Backup configuration required" }, { status: 400 })
      }

      const result = await backupService.createBackup(config)

      if (result.success) {
        return NextResponse.json({
          success: true,
          backup: result,
          message: "Backup created successfully"
        })
      } else {
        return NextResponse.json({
          error: result.error || "Backup failed"
        }, { status: 500 })
      }
    }

    if (action === "restore") {
      if (!backupId) {
        return NextResponse.json({ error: "Backup ID required" }, { status: 400 })
      }

      const result = await backupService.restoreBackup(backupId)

      if (result.success) {
        return NextResponse.json({
          success: true,
          restore: result,
          message: "Database restored successfully"
        })
      } else {
        return NextResponse.json({
          error: result.error || "Restore failed"
        }, { status: 500 })
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error processing backup request:", error)
    return NextResponse.json(
      { error: "Failed to process backup request" },
      { status: 500 }
    )
  }
}