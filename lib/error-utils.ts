export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public context?: Record<string, any>,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR", 400, { field })
    this.name = "ValidationError"
  }
}

export class NetworkError extends AppError {
  constructor(message = "Network request failed") {
    super(message, "NETWORK_ERROR", 0)
    this.name = "NetworkError"
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, "AUTH_ERROR", 401)
    this.name = "AuthenticationError"
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(message, "AUTHORIZATION_ERROR", 403)
    this.name = "AuthorizationError"
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "An unknown error occurred"
}

export function isNetworkError(error: unknown): boolean {
  if (error instanceof NetworkError) return true
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("network") ||
      error.message.toLowerCase().includes("fetch") ||
      error.message.toLowerCase().includes("connection")
    )
  }
  return false
}

export function shouldRetry(error: unknown, attempt = 1): boolean {
  if (attempt >= 3) return false

  if (isNetworkError(error)) return true
  if (error instanceof Error && error.name === "AbortError") return false

  return false
}

export function logError(error: unknown, context?: Record<string, any>) {
  console.error("[v0] Error:", {
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    context,
    timestamp: new Date(),
  })
}
