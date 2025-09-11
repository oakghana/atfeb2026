import type React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "./sidebar"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

interface DashboardLayoutProps {
  children: React.ReactNode
}

function DashboardErrorFallback({ error, resetError }: { error?: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-md">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-2">
          <div className="font-medium">Dashboard Error</div>
          <div className="text-sm">{error?.message || "Failed to load dashboard. Please try refreshing the page."}</div>
          <a href="/dashboard" className="text-sm underline hover:no-underline">
            Refresh Page
          </a>
        </AlertDescription>
      </Alert>
    </div>
  )
}

export async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Get user profile with department info
  const { data: profile } = await supabase
    .from("user_profiles")
    .select(`
      *,
      departments (
        name,
        code
      )
    `)
    .eq("id", data.user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <ErrorBoundary>
        <Sidebar user={data.user} profile={profile} />
      </ErrorBoundary>
      <div className="lg:pl-64">
        <ErrorBoundary fallback={DashboardErrorFallback}>
          <main className="p-6 lg:p-8">{children}</main>
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default DashboardLayout
