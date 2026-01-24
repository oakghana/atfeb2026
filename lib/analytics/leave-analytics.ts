/**
 * Leave Analytics - Smart calculations for attendance excluding leave days
 */

export interface AttendanceSummary {
  totalWorkingDays: number
  presentDays: number
  absentDays: number
  leaveDays: number
  excusedDays: number
  attendancePercentage: number
  status: "good" | "warning" | "critical"
}

/**
 * Calculate attendance percentage excluding leave days
 */
export function calculateAttendancePercentage(params: {
  totalDays: number
  presentDays: number
  absentDays: number
  leaveDays: number
  excusedDays?: number
}): AttendanceSummary {
  const { totalDays, presentDays, absentDays, leaveDays, excusedDays = 0 } = params

  // Working days = Total days - Leave days - Excused days
  const workingDays = totalDays - leaveDays - excusedDays

  // Ensure working days don't go negative
  if (workingDays <= 0) {
    return {
      totalWorkingDays: 0,
      presentDays: 0,
      absentDays: 0,
      leaveDays,
      excusedDays,
      attendancePercentage: 100, // No working days = no absence
      status: "good",
    }
  }

  // Attendance percentage based on working days only
  const attendancePercentage = (presentDays / workingDays) * 100

  // Determine status
  let status: "good" | "warning" | "critical" = "good"
  if (attendancePercentage < 50) {
    status = "critical"
  } else if (attendancePercentage < 75) {
    status = "warning"
  }

  return {
    totalWorkingDays: workingDays,
    presentDays,
    absentDays,
    leaveDays,
    excusedDays,
    attendancePercentage: Math.round(attendancePercentage * 100) / 100,
    status,
  }
}

/**
 * Check if a date falls within a leave period
 */
export function isDateOnLeave(
  dateToCheck: Date,
  leaveStartDate: string | null,
  leaveEndDate: string | null,
  leaveStatus: string | null,
): boolean {
  if (!leaveStartDate || !leaveEndDate || leaveStatus !== "active") {
    return false
  }

  const date = new Date(dateToCheck)
  date.setHours(0, 0, 0, 0)

  const startDate = new Date(leaveStartDate)
  startDate.setHours(0, 0, 0, 0)

  const endDate = new Date(leaveEndDate)
  endDate.setHours(0, 0, 0, 0)

  return date >= startDate && date <= endDate
}

/**
 * Count leave days in a date range
 */
export function countLeaveDaysInRange(
  startDate: Date,
  endDate: Date,
  userLeaveStart: string | null,
  userLeaveEnd: string | null,
  leaveStatus: string | null,
): number {
  if (!userLeaveStart || !userLeaveEnd || leaveStatus !== "active") {
    return 0
  }

  let count = 0
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    if (isDateOnLeave(currentDate, userLeaveStart, userLeaveEnd, leaveStatus)) {
      count++
    }
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return count
}

/**
 * Get attendance status label with leave consideration
 */
export function getAttendanceStatusLabel(
  isPresent: boolean,
  isOnLeave: boolean,
  isExcused: boolean,
): "present" | "absent" | "on_leave" | "excused" {
  if (isOnLeave) return "on_leave"
  if (isExcused) return "excused"
  if (isPresent) return "present"
  return "absent"
}

/**
 * Format attendance data for analytics display
 */
export function formatAttendanceData(summary: AttendanceSummary) {
  return {
    workingDays: summary.totalWorkingDays,
    present: summary.presentDays,
    absent: summary.absentDays,
    leave: summary.leaveDays,
    excused: summary.excusedDays,
    percentage: `${summary.attendancePercentage}%`,
    status: summary.status,
    breakdown: [
      { label: "Present", value: summary.presentDays, percentage: Math.round((summary.presentDays / summary.totalWorkingDays) * 100) || 0 },
      { label: "Absent", value: summary.absentDays, percentage: Math.round((summary.absentDays / summary.totalWorkingDays) * 100) || 0 },
      { label: "Leave", value: summary.leaveDays, percentage: Math.round((summary.leaveDays / (summary.totalWorkingDays + summary.leaveDays)) * 100) || 0 },
      { label: "Excused", value: summary.excusedDays, percentage: Math.round((summary.excusedDays / (summary.totalWorkingDays + summary.excusedDays)) * 100) || 0 },
    ],
  }
}
