import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://ycglrckbxehwlcyxzqyv.supabase.co"
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljZ2xyY2tieGVod2xjeXh6cXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY1MTE5NjYsImV4cCI6MjA1MjA4Nzk2Nn0.Cf3NKvWr8_WwXjLpemLc9MvE2F8LVXIwVZC1gMOlpkg"

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (
      request.nextUrl.pathname !== "/" &&
      !request.nextUrl.pathname.startsWith("/auth") &&
      !request.nextUrl.pathname.startsWith("/_next") &&
      !request.nextUrl.pathname.startsWith("/favicon")
    ) {
      const isV0Preview = request.nextUrl.hostname.includes("vusercontent.net")
      if (!isV0Preview && !user) {
        const url = request.nextUrl.clone()
        url.pathname = "/auth/login"
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[v0] Middleware error:", error)
    }
    return NextResponse.next({
      request,
    })
  }
}
