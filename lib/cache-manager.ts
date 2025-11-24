/**
 * Cache Manager Utility
 * Provides functions to clear browser cache, storage, and force app refresh
 */

export async function clearAppCache(): Promise<void> {
  try {
    console.log("[v0] Starting cache clearing process...")

    // 1. Clear all localStorage
    localStorage.clear()
    console.log("[v0] Cleared localStorage")

    // 2. Clear all sessionStorage
    sessionStorage.clear()
    console.log("[v0] Cleared sessionStorage")

    // 3. Clear IndexedDB
    if (window.indexedDB) {
      const databases = await window.indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name)
          console.log(`[v0] Deleted IndexedDB: ${db.name}`)
        }
      }
    }

    // 4. Clear Service Worker caches
    if ("caches" in window) {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          await caches.delete(cacheName)
          console.log(`[v0] Deleted cache: ${cacheName}`)
        }),
      )
    }

    // 5. Unregister Service Workers
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(
        registrations.map(async (registration) => {
          await registration.unregister()
          console.log("[v0] Unregistered service worker")
        }),
      )
    }

    console.log("[v0] Cache clearing completed successfully")
  } catch (error) {
    console.error("[v0] Error clearing cache:", error)
    throw error
  }
}

export function forceReload(): void {
  // Use location.reload with forceGet to bypass cache
  window.location.reload()
}

export async function clearCacheAndReload(): Promise<void> {
  await clearAppCache()
  // Small delay to ensure cache clearing completes
  setTimeout(() => {
    forceReload()
  }, 500)
}

/**
 * Clear all cookies related to the attendance system
 */
export function clearAllCookies(): void {
  try {
    console.log("[v0] Clearing all cookies...")

    // Get all cookies
    const cookies = document.cookie.split(";")

    // Delete each cookie
    for (const cookie of cookies) {
      const eqPos = cookie.indexOf("=")
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim()

      // Delete cookie for current domain
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`

      // Delete cookie for root domain
      const domain = window.location.hostname
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${domain}`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain}`

      console.log(`[v0] Cleared cookie: ${name}`)
    }

    console.log("[v0] All cookies cleared")
  } catch (error) {
    console.error("[v0] Error clearing cookies:", error)
  }
}

/**
 * Clear all browser storage and logout user completely
 */
export async function clearAllDataAndLogout(): Promise<void> {
  try {
    console.log("[v0] Starting complete data clearing and logout...")

    // Clear all caches and storage
    await clearAppCache()

    // Clear all cookies
    clearAllCookies()

    // Clear browser history (only works in some contexts)
    try {
      window.history.replaceState(null, "", "/auth/login")
    } catch (error) {
      console.log("[v0] Could not clear history:", error)
    }

    console.log("[v0] Complete data clearing and logout finished")
  } catch (error) {
    console.error("[v0] Error in clearAllDataAndLogout:", error)
    throw error
  }
}
