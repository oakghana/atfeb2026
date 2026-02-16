export type DeptInfo = { code?: string | null; name?: string | null } | undefined | null

export function isWeekend(date: Date = new Date()): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

export function isSecurityDept(dept?: DeptInfo): boolean {
  if (!dept) return false
  const code = (dept.code || "").toString().toLowerCase()
  const name = (dept.name || "").toString().toLowerCase()
  return code === "security" || name.includes("security")
}

export function isResearchDept(dept?: DeptInfo): boolean {
  if (!dept) return false
  const code = (dept.code || "").toString().toLowerCase()
  const name = (dept.name || "").toString().toLowerCase()
  return code === "research" || name.includes("research")
}

export function isOperationalDept(dept?: DeptInfo): boolean {
  if (!dept) return false
  const code = (dept.code || "").toString().toLowerCase()
  const name = (dept.name || "").toString().toLowerCase()
  return code === "operations" || code === "operational" || name.includes("operations") || name.includes("operational")
}

export function isExemptFromTimeRestrictions(dept?: DeptInfo, role?: string | null): boolean {
  if (!dept && !role) return false
  // Operational and Security departments are exempt from time restrictions
  if (isOperationalDept(dept)) return true
  if (isSecurityDept(dept)) return true
  // Admin roles are also exempt
  const lowerRole = (role || "").toLowerCase()
  return lowerRole === "admin" || lowerRole === "department_head" || lowerRole === "regional_manager"
}

export function isExemptFromAttendanceReasons(role?: string | null): boolean {
  if (!role) return false
  const lowerRole = role.toLowerCase()
  return lowerRole === "department_head" || lowerRole === "regional_manager"
}

/**
 * Returns true when a lateness reason SHOULD be required.
 * - Requires reason only on weekdays (Mon-Fri)
 * - Security and Research departments are exempt
 * - Department heads and regional managers are exempt
 */
export function requiresLatenessReason(date: Date = new Date(), dept?: DeptInfo, role?: string | null): boolean {
  if (isWeekend(date)) return false
  if (isSecurityDept(dept)) return false
  if (isResearchDept(dept)) return false
  if (isExemptFromAttendanceReasons(role)) return false
  return true
}

/**
 * Returns true when an early-checkout reason should be enforced.
 * - Enforced only when location-level flag is true and it's not a weekend
 * - Department heads and regional managers are exempt
 */
export function requiresEarlyCheckoutReason(date: Date = new Date(), locationRequires: boolean = true, role?: string | null): boolean {
  if (!locationRequires) return false
  if (isWeekend(date)) return false
  if (isExemptFromAttendanceReasons(role)) return false
  return true
}

/**
 * Check if check-in time is allowed
 * - Admins, Regional Managers, Department Heads: can check in anytime
 * - Regular staff: can only check in before 3 PM (15:00)
 * - Operational and Security departments: can check in anytime
 */
export function canCheckInAtTime(date: Date = new Date(), dept?: DeptInfo, role?: string | null): boolean {
  // Exempt roles can check in anytime
  if (isExemptFromTimeRestrictions(dept, role)) return true
  const hours = date.getHours()
  return hours < 15 // Allow check-in only before 3 PM for regular staff
}

/**
 * Check if check-out time is allowed (before 6 PM / 18:00)
 * Operational and Security departments are exempt
 */
export function canCheckOutAtTime(date: Date = new Date(), dept?: DeptInfo, role?: string | null): boolean {
  if (isExemptFromTimeRestrictions(dept, role)) return true
  const hours = date.getHours()
  return hours < 18 // Allow check-out only before 6 PM
}

/**
 * Get check-in deadline time (3 PM for regular staff, anytime for admins/managers)
 */
export function getCheckInDeadline(): string {
  return "3:00 PM"
}

/**
 * Get check-out deadline time (6 PM)
 */
export function getCheckOutDeadline(): string {
  return "6:00 PM"
}
