/**
 * Attendance Cache Management Utilities
 * Ensures fresh attendance data on new day login
 */

const ATTENDANCE_CACHE_KEY = "qcc_attendance_cache"
const CACHE_DATE_KEY = "qcc_attendance_cache_date"

interface AttendanceCacheData {
  date: string
  data: any
}

/**
 * Clears all attendance-related cache data
 * Called on login and when date changes
 */
export function clearAttendanceCache(): void {
  try {
    // Clear localStorage cache
    if (typeof window !== "undefined") {
      localStorage.removeItem(ATTENDANCE_CACHE_KEY)
      localStorage.removeItem(CACHE_DATE_KEY)

      // Clear any other attendance-related keys
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.includes("attendance")) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key))

      console.log("[v0] Attendance cache cleared successfully")
    }
  } catch (error) {
    console.error("[v0] Error clearing attendance cache:", error)
  }
}

/**
 * Gets the cached date to check if cache is stale
 */
export function getCachedDate(): string | null {
  try {
    if (typeof window !== "undefined") {
      return localStorage.getItem(CACHE_DATE_KEY)
    }
    return null
  } catch (error) {
    console.error("[v0] Error getting cached date:", error)
    return null
  }
}

/**
 * Sets the current date in cache
 */
export function setCachedDate(date: string): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(CACHE_DATE_KEY, date)
    }
  } catch (error) {
    console.error("[v0] Error setting cached date:", error)
  }
}

/**
 * Checks if cache is valid for today
 * Returns true if cache should be cleared
 */
export function shouldClearCache(): boolean {
  try {
    const today = new Date().toISOString().split("T")[0]
    const cachedDate = getCachedDate()

    // If no cached date or different date, clear cache
    if (!cachedDate || cachedDate !== today) {
      console.log("[v0] Cache is stale. Cached date:", cachedDate, "Today:", today)
      return true
    }

    return false
  } catch (error) {
    console.error("[v0] Error checking cache validity:", error)
    return true // Clear cache on error to be safe
  }
}
