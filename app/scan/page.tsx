import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QRScanner } from "@/components/qr-scanner"

export default async function ScanPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  // Check if user profile is active
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_active, first_name, last_name")
    .eq("id", user.id)
    .single()

  if (!profile?.is_active) {
    redirect("/auth/pending-approval")
  }

  const { data: locations } = await supabase
    .from("geofence_locations")
    .select("id, name, location_code")
    .eq("is_active", true)
    .order("name")

  return (
    <div className="container mx-auto py-4 px-4 sm:py-6">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">QR Code Scanner</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Scan QR codes to record your attendance at events and classes
        </p>
      </div>
      <div className="flex justify-center">
        <QRScanner locations={locations || []} />
      </div>
    </div>
  )
}
