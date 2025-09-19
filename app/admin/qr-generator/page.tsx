import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { QRGenerator } from "@/components/qr-generator"

export default async function QRGeneratorPage() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    redirect("/auth/login")
  }

  // Check if user has admin privileges
  const { data: profile } = await supabase.from("user_profiles").select("role, is_active").eq("id", user.id).single()

  if (!profile?.is_active || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">QR Code Generator</h1>
        <p className="text-muted-foreground">Generate QR codes for student attendance tracking at events and classes</p>
      </div>
      <QRGenerator />
    </div>
  )
}
