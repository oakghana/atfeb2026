import { createBrowserClient } from "@supabase/ssr"

let clientInstance: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (clientInstance) {
    return clientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://vgtajtqxgczhjboatvol.supabase.co"
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndGFqdHF4Z2N6aGpib2F0dm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5NzUyNDgsImV4cCI6MjA3MjU1MTI0OH0.EuuTCRC-rDoz_WHl4pwpV6_fEqrqcgGroa4nTjAEn1k"

  clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)

  return clientInstance
}
