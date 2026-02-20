import { createClient } from "@supabase/supabase-js"

async function addReasonColumn() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("[v0] Missing Supabase credentials")
      return
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log("[v0] Adding reason column to pending_offpremises_checkins table...")

    // Execute the raw SQL query
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        ALTER TABLE public.pending_offpremises_checkins
        ADD COLUMN IF NOT EXISTS reason TEXT;
        
        CREATE INDEX IF NOT EXISTS idx_pending_offpremises_reason
          ON public.pending_offpremises_checkins(reason);
      `,
    })

    if (error) {
      // Try alternative approach - use alter table directly through Supabase
      console.log(
        "[v0] First approach failed, trying alternative method...",
        error
      )

      // Check if column already exists by trying a select
      const { data: testData, error: testError } = await supabase
        .from("pending_offpremises_checkins")
        .select("reason")
        .limit(1)

      if (testError && testError.message.includes("column")) {
        console.log("[v0] Column does not exist yet")
        console.log("[v0] Please add the reason column manually in Supabase UI or use SQL Editor")
        return
      }

      if (!testError) {
        console.log("[v0] SUCCESS: reason column already exists!")
        return
      }
    }

    console.log("[v0] SUCCESS: reason column has been added to the table!")
  } catch (error) {
    console.error("[v0] Error:", error)
  }
}

addReasonColumn()
