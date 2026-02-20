import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  const { email, password } = await request.json()

  console.log("[v0] Mock sign-in API called for:", email)

  // Mock test user for development/testing
  const testUsers = {
    "ohemengappiah@qccgh.com": {
      password: "password123",
      id: "mock-user-001",
      email: "ohemengappiah@qccgh.com",
    },
    "test@qccgh.com": {
      password: "password",
      id: "mock-user-002",
      email: "test@qccgh.com",
    },
  }

  const userKey = email.toLowerCase()
  const testUser = testUsers[userKey as keyof typeof testUsers]

  if (!testUser) {
    console.log("[v0] User not found:", email)
    return new Response(
      JSON.stringify({
        error: "User not found",
      }),
      { status: 401 },
    )
  }

  if (testUser.password !== password) {
    console.log("[v0] Password mismatch for:", email)
    return new Response(
      JSON.stringify({
        error: "Invalid password",
      }),
      { status: 401 },
    )
  }

  // Create a mock session
  const mockSession = {
    user: {
      id: testUser.id,
      email: testUser.email,
      user_metadata: {
        email: testUser.email,
      },
    },
    session: {
      access_token: "mock-jwt-token-" + testUser.id,
      refresh_token: "mock-refresh-token-" + testUser.id,
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
    },
  }

  console.log("[v0] Mock authentication successful for:", email)

  return new Response(JSON.stringify(mockSession), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}
