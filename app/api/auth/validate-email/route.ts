import { type NextRequest, NextResponse } from "next/server"
import { rateLimit, getClientIdentifier, sanitizeInput, createSecurityHeaders } from "@/lib/security"

const JSON_HEADERS = {
  ...createSecurityHeaders(),
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: JSON_HEADERS,
  })
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json(
    { error: "Processing request...", exists: false },
    { status: 200, headers: JSON_HEADERS },
  )

  try {
    const clientId = getClientIdentifier(request)
    const isAllowed = rateLimit(clientId, {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10, // Max 10 email validation attempts per 5 minutes
    })

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Too many validation attempts. Please try again later.", exists: false },
        { status: 429, headers: JSON_HEADERS },
      )
    }

    console.log("[v0] Email validation API called")

    let email: string
    try {
      const body = await request.json()
      email = sanitizeInput(body.email?.trim()?.toLowerCase())
      console.log("[v0] Parsed and sanitized email from request:", email)
    } catch (parseError) {
      console.error("[v0] Failed to parse request body:", parseError)
      return NextResponse.json({ error: "Invalid request body", exists: false }, { status: 400, headers: JSON_HEADERS })
    }

    if (!email) {
      console.log("[v0] No email provided")
      return NextResponse.json({ error: "Email is required", exists: false }, { status: 400, headers: JSON_HEADERS })
    }

    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(email)) {
      console.log("[v0] Invalid email format:", email)
      return NextResponse.json({ error: "Invalid email format", exists: false }, { status: 400, headers: JSON_HEADERS })
    }

    console.log("[v0] Validating email:", email)

    let createClient
    try {
      const supabaseModule = await import("@/lib/supabase/server")
      createClient = supabaseModule.createClient
      console.log("[v0] Supabase module imported successfully")
    } catch (importError) {
      console.error("[v0] Failed to import Supabase module:", importError)
      return NextResponse.json(
        {
          error: "Server configuration error",
          exists: false,
          details: "Failed to load database module",
        },
        { status: 500, headers: JSON_HEADERS },
      )
    }

    let supabase
    try {
      supabase = await createClient()
      console.log("[v0] Supabase client created successfully")
    } catch (clientError) {
      console.error("[v0] Failed to create Supabase client:", clientError)
      return NextResponse.json(
        {
          error: "Database connection failed",
          exists: false,
          details: clientError instanceof Error ? clientError.message : "Unknown client error",
        },
        { status: 500, headers: JSON_HEADERS },
      )
    }

    try {
      console.log("[v0] Querying user_profiles table for email:", email)
      const { data: user, error: queryError } = await supabase
        .from("user_profiles")
        .select("id, email, is_active, first_name, last_name")
        .ilike("email", email)
        .maybeSingle()

      if (queryError) {
        console.error("[v0] Database error during email validation:", queryError)
        return NextResponse.json(
          {
            error: "Database error during validation",
            exists: false,
            details: queryError.message || "Unknown database error",
          },
          { status: 500, headers: JSON_HEADERS },
        )
      }

      if (!user) {
        console.log("[v0] Email not found in user_profiles:", email)
        return NextResponse.json(
          {
            error:
              "This email is not registered in the QCC system. Please contact your administrator or use a registered email address.",
            exists: false,
          },
          { status: 404, headers: JSON_HEADERS },
        )
      }

      if (!user.is_active) {
        console.log("[v0] User account not active but allowing OTP:", email)
        return NextResponse.json(
          {
            exists: true,
            approved: false,
            message: "Account pending approval - OTP will be sent but login may be restricted",
          },
          { headers: JSON_HEADERS },
        )
      }

      console.log("[v0] Email validation successful:", email)
      return NextResponse.json(
        {
          exists: true,
          approved: true,
          message: "Email validated successfully",
        },
        { headers: JSON_HEADERS },
      )
    } catch (dbError) {
      console.error("[v0] Database operation failed:", dbError)
      return NextResponse.json(
        {
          error: "Database operation failed",
          exists: false,
          details: dbError instanceof Error ? dbError.message : "Unknown database error",
        },
        { status: 500, headers: JSON_HEADERS },
      )
    }
  } catch (topLevelError) {
    console.error("[v0] Top-level API error:", topLevelError)
    return NextResponse.json(
      {
        error: "Critical server error",
        exists: false,
        details: topLevelError instanceof Error ? topLevelError.message : "Unknown critical error",
      },
      { status: 500, headers: JSON_HEADERS },
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to validate email." },
    { status: 405, headers: JSON_HEADERS },
  )
}
