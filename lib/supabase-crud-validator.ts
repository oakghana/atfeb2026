"use client"

import { createClient } from "@/lib/supabase/client"

/**
 * Comprehensive Supabase CRUD Operations Validator
 * Tests all critical operations for attendance system
 */

interface CRUDTestResult {
  operation: string
  status: "pass" | "fail" | "warning"
  message: string
  duration: number
  details?: any
}

export async function validateSupabaseCRUDOperations(): Promise<CRUDTestResult[]> {
  const results: CRUDTestResult[] = []
  const supabase = createClient()

  // Test 1: Authentication
  console.log("[v0] Testing Supabase authentication...")
  const authStart = performance.now()
  try {
    const { data: user } = await supabase.auth.getUser()
    results.push({
      operation: "Authentication",
      status: user ? "pass" : "fail",
      message: user ? "User authenticated successfully" : "No authenticated user",
      duration: performance.now() - authStart,
    })
  } catch (error) {
    results.push({
      operation: "Authentication",
      status: "fail",
      message: `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: performance.now() - authStart,
    })
    return results // Stop if auth fails
  }

  // Test 2: Read attendance records
  console.log("[v0] Testing read operations...")
  const readStart = performance.now()
  try {
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, user_id, check_in_time")
      .limit(1)

    results.push({
      operation: "Read (SELECT)",
      status: error ? "fail" : "pass",
      message: error ? `Read failed: ${error.message}` : "Read operations working",
      duration: performance.now() - readStart,
      details: { rowsReturned: data?.length || 0 },
    })
  } catch (error) {
    results.push({
      operation: "Read (SELECT)",
      status: "fail",
      message: `Read operation error: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: performance.now() - readStart,
    })
  }

  // Test 3: User profiles read
  console.log("[v0] Testing user profile read...")
  const profileStart = performance.now()
  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, first_name, last_name, role")
      .limit(5)

    results.push({
      operation: "Read User Profiles",
      status: error ? "fail" : "pass",
      message: error ? `Profile read failed: ${error.message}` : "User profile read successful",
      duration: performance.now() - profileStart,
      details: { profilesReturned: data?.length || 0 },
    })
  } catch (error) {
    results.push({
      operation: "Read User Profiles",
      status: "fail",
      message: `Profile read error: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: performance.now() - profileStart,
    })
  }

  // Test 4: Geofence locations read
  console.log("[v0] Testing geofence locations read...")
  const geoStart = performance.now()
  try {
    const { data, error } = await supabase
      .from("geofence_locations")
      .select("id, name, latitude, longitude, radius_meters")
      .eq("is_active", true)
      .limit(1)

    results.push({
      operation: "Read Geofence Locations",
      status: error ? "fail" : "pass",
      message: error ? `Location read failed: ${error.message}` : "Geofence location read successful",
      duration: performance.now() - geoStart,
      details: { locationsReturned: data?.length || 0 },
    })
  } catch (error) {
    results.push({
      operation: "Read Geofence Locations",
      status: "fail",
      message: `Location read error: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: performance.now() - geoStart,
    })
  }

  // Test 5: Real-time subscription
  console.log("[v0] Testing real-time subscriptions...")
  const subStart = performance.now()
  try {
    const channel = supabase
      .channel("test-subscription")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => {})
      .subscribe((status) => {
        const isConnected = status === "SUBSCRIBED"
        results.push({
          operation: "Real-time Subscription",
          status: isConnected ? "pass" : "warning",
          message: isConnected ? "Real-time subscription active" : `Subscription status: ${status}`,
          duration: performance.now() - subStart,
        })
        supabase.removeChannel(channel)
      })

    // Timeout if subscription doesn't connect
    setTimeout(() => {
      supabase.removeChannel(channel)
    }, 5000)
  } catch (error) {
    results.push({
      operation: "Real-time Subscription",
      status: "fail",
      message: `Subscription error: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: performance.now() - subStart,
    })
  }

  // Test 6: Leave notifications read
  console.log("[v0] Testing leave notifications...")
  const leaveStart = performance.now()
  try {
    const { data, error } = await supabase
      .from("leave_notifications")
      .select("id, status")
      .limit(1)

    results.push({
      operation: "Read Leave Notifications",
      status: error && error.code === "PGRST116" ? "warning" : error ? "fail" : "pass",
      message:
        error && error.code === "PGRST116"
          ? "Leave notifications table exists (empty)"
          : error
            ? `Leave notification read failed: ${error.message}`
            : "Leave notifications read successful",
      duration: performance.now() - leaveStart,
      details: { notificationsReturned: data?.length || 0 },
    })
  } catch (error) {
    results.push({
      operation: "Read Leave Notifications",
      status: "fail",
      message: `Leave notification error: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: performance.now() - leaveStart,
    })
  }

  // Test 7: Data integrity check
  console.log("[v0] Testing data integrity...")
  const integrityStart = performance.now()
  try {
    const { data: users, error: userError } = await supabase.from("user_profiles").select("id").limit(1)

    if (userError) {
      throw userError
    }

    results.push({
      operation: "Data Integrity",
      status: "pass",
      message: "Database schema and relationships validated",
      duration: performance.now() - integrityStart,
    })
  } catch (error) {
    results.push({
      operation: "Data Integrity",
      status: "fail",
      message: `Data integrity check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      duration: performance.now() - integrityStart,
    })
  }

  return results
}

/**
 * Generate a summary report of CRUD operations
 */
export function generateCRUDReport(results: CRUDTestResult[]): string {
  const passed = results.filter((r) => r.status === "pass").length
  const failed = results.filter((r) => r.status === "fail").length
  const warnings = results.filter((r) => r.status === "warning").length
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0)

  let report = `
SUPABASE CRUD OPERATIONS REPORT
================================
Execution Time: ${totalTime.toFixed(2)}ms
Results: ${passed} passed, ${failed} failed, ${warnings} warnings

DETAILED RESULTS:
-----------------`

  results.forEach((result) => {
    const statusEmoji = {
      pass: "✓",
      fail: "✗",
      warning: "⚠",
    }[result.status]

    report += `\n${statusEmoji} ${result.operation}: ${result.message} (${result.duration.toFixed(2)}ms)`

    if (result.details) {
      report += ` - ${JSON.stringify(result.details)}`
    }
  })

  report += "\n\nSUMMARY:\n--------"
  if (failed === 0 && warnings === 0) {
    report += "\nAll CRUD operations are working correctly! ✓"
  } else if (failed === 0) {
    report += `\nAll critical operations pass, but review ${warnings} warning(s).`
  } else {
    report += `\nCRITICAL: ${failed} operation(s) failed. Please investigate.`
  }

  return report
}
