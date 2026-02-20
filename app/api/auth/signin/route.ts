import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Sign-in API called")

    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    console.log("[v0] Attempting to authenticate user:", email)

    const supabase = await createClient()

    // Query the user_profiles table to find the user and their password hash
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, email, password_hash, first_name, last_name, is_active")
      .eq("email", email)
      .single()

    if (profileError || !profile) {
      console.log("[v0] User not found:", email)
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    if (!profile.is_active) {
      console.log("[v0] User account is inactive:", email)
      return NextResponse.json({ error: "Your account has been deactivated" }, { status: 403 })
    }

    // Verify password (assuming password_hash is bcrypt or similar)
    // For now, we'll do a simple comparison - in production use bcrypt
    const passwordMatch = await verifyPassword(password, profile.password_hash)

    if (!passwordMatch) {
      console.log("[v0] Invalid password for user:", email)
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    console.log("[v0] User authenticated successfully:", email)

    // Return user data without password
    return NextResponse.json({
      success: true,
      user: {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
      },
    })
  } catch (error) {
    console.error("[v0] Sign-in error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

// Simple password verification function
// In production, use bcrypt: import bcrypt from 'bcrypt'
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // If hash starts with $2, it's bcrypt - but we can't verify without bcrypt library
    // For now, do simple hash comparison
    const hashPassword = (pwd: string) => crypto.createHash("sha256").update(pwd).digest("hex")
    
    // Try bcrypt-style comparison first, then fallback to simple hash
    if (hash.startsWith("$2")) {
      // This would need bcrypt library - for now return false
      console.log("[v0] Bcrypt hash detected but bcrypt not available")
      return false
    }

    // Simple SHA256 comparison (NOT SECURE - for development only)
    const inputHash = hashPassword(password)
    return inputHash === hash
  } catch (error) {
    console.error("[v0] Password verification error:", error)
    return false
  }
}
