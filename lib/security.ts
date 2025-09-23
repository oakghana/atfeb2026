import type { NextRequest } from "next/server"

// Rate limiting store (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
}

export function rateLimit(identifier: string, config: RateLimitConfig): boolean {
  const now = Date.now()
  const key = identifier
  const existing = rateLimitStore.get(key)

  if (!existing || now > existing.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return true
  }

  if (existing.count >= config.maxRequests) {
    return false // Rate limit exceeded
  }

  existing.count++
  return true
}

export function getClientIdentifier(request: NextRequest): string {
  // Use IP address as identifier (in production, consider user ID for authenticated requests)
  return request.ip || request.headers.get("x-forwarded-for") || "unknown"
}

export function sanitizeInput(input: string): string {
  if (!input) return ""

  return input
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim()
}

export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long")
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter")
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter")
  }

  if (!/\d/.test(password)) {
    errors.push("Password must contain at least one number")
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function createSecurityHeaders() {
  return {
    "Cache-Control": "no-cache, no-store, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  }
}
