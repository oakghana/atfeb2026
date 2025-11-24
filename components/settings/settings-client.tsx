"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { clearAllDataAndLogout } from "@/lib/cache-manager"

export function SettingsClient() {
  const [clearingCache, setClearingCache] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClearCache = async () => {
    setClearingCache(true)
    setError(null)

    try {
      // Show confirmation
      const confirmed = window.confirm(
        "This will clear all browsing data and log you out. You will need to log in again. Continue?",
      )

      if (!confirmed) {
        setClearingCache(false)
        return
      }

      // Create Supabase client
      const supabase = createClient()

      // Log the action
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }).catch(console.error)

      // Sign out from Supabase
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error("Sign out error:", signOutError)
      }

      // Clear all data, cache, cookies, and storage
      await clearAllDataAndLogout()

      // Force redirect to login with a clean slate
      window.location.href = "/auth/login"
    } catch (error) {
      console.error("Cache clearing error:", error)
      setError(`Failed to clear cache: ${error instanceof Error ? error.message : "Unknown error"}`)
      setClearingCache(false)
    }
  }

  return null // This is a placeholder - the actual component will be rendered by the settings page
}
