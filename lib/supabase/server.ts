import { createServerClient } from "@supabase/ssr"

/**
 * Especially important if using Fluid compute: Don't put this client in a
 * global variable. Always create a new client within each function when using
 * it.
 */
export async function createClient() {
  try {
    console.log("[v0] Creating Supabase server client")

    console.log("[v0] Environment variable check:", {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "present" : "missing",
      SUPABASE_URL: process.env.SUPABASE_URL ? "present" : "missing",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "present" : "missing",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? "present" : "missing",
      allEnvKeys: Object.keys(process.env).filter((key) => key.includes("SUPABASE")),
    })

    // Validate environment variables with fallback values
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://vgtajtqxgczhjboatvol.supabase.co" // Added fallback URL from provided config

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzUyNDgsImV4cCI6MjA3MjU1MTI0OH0.EuuTCRC-rDoz_WHl4pwpV6_fEqrqcgGroa4nTjAEn1k" // Added fallback key from provided config

    console.log("[v0] Using Supabase URL:", supabaseUrl)
    console.log("[v0] Using Supabase Key:", supabaseKey ? "present" : "missing")

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase environment variables after fallback:", {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        nextPublicUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        regularUrl: !!process.env.SUPABASE_URL,
        nextPublicKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        regularKey: !!process.env.SUPABASE_ANON_KEY,
      })
      throw new Error("Missing Supabase environment variables")
    }

    let cookieStore
    try {
      // Only import cookies when we're in a server context
      if (typeof window === "undefined") {
        const { cookies } = await import("next/headers")
        cookieStore = await cookies()
        console.log("[v0] Cookie store obtained successfully")
      } else {
        // We're in a client context, provide a no-op cookie store
        cookieStore = {
          getAll: () => [],
          set: () => {},
          get: () => undefined,
        }
        console.log("[v0] Using client-side fallback cookie store")
      }
    } catch (cookieError) {
      console.error("[v0] Failed to get cookie store:", cookieError)
      // Create a fallback cookie store that doesn't throw errors
      cookieStore = {
        getAll: () => [],
        set: () => {},
        get: () => undefined,
      }
    }

    const client = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          try {
            return cookieStore.getAll ? cookieStore.getAll() : []
          } catch {
            return []
          }
        },
        setAll(cookiesToSet) {
          try {
            if (cookieStore.set) {
              cookiesToSet.forEach(({ name, value, options }) => {
                try {
                  cookieStore.set(name, value, options)
                } catch {
                  // Ignore cookie setting errors in server components
                }
              })
            }
          } catch {
            // The "setAll" method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    })

    console.log("[v0] Supabase server client created successfully")
    return client
  } catch (error) {
    console.error("[v0] Failed to create Supabase server client:", error)
    throw error
  }
}
