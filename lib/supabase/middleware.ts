import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase environment variables - allowing request without auth")
    return NextResponse.next({ request })
  }

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
      global: {
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            signal: undefined,
          })
        },
      },
    })

    // Exclude static and PWA assets from auth redirects (service worker must be fetchable at /sw.js)
    // Also exclude if credentials are missing (deployment without Supabase)
    if (
      request.nextUrl.pathname !== "/" &&
      request.nextUrl.pathname !== "/sw.js" &&
      !request.nextUrl.pathname.startsWith("/auth") &&
      !request.nextUrl.pathname.startsWith("/_next") &&
      !request.nextUrl.pathname.startsWith("/favicon") &&
      !request.nextUrl.pathname.startsWith("/api")
    ) {
      const isV0Preview = request.nextUrl.hostname.includes("vusercontent.net")
      if (!isV0Preview) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            const url = request.nextUrl.clone()
            url.pathname = "/auth/login"
            return NextResponse.redirect(url)
          }
        } catch (authError: any) {
          if (authError.name === "AbortError") {
            // Request was aborted, just continue without redirect
            return supabaseResponse
          }
          // For other errors, redirect to login
          if (process.env.NODE_ENV === "development") {
            console.error("[v0] Auth error:", authError)
          }
          const url = request.nextUrl.clone()
          url.pathname = "/auth/login"
          return NextResponse.redirect(url)
        }
      }
    }

    return supabaseResponse
  } catch (error: any) {
    if (error.name !== "AbortError" && process.env.NODE_ENV === "development") {
      console.error("[v0] Middleware error:", error)
    }
    return NextResponse.next({
      request,
    })
  }
}
