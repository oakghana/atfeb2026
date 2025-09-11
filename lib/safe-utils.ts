export function safeParseFloat(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = typeof value === "string" ? Number.parseFloat(value) : value
  return isNaN(parsed) ? null : parsed
}

export function safeParseInt(value: string | number | undefined | null): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Math.floor(value)
  return isNaN(parsed) ? null : parsed
}

export function safeArrayAccess<T>(array: T[] | undefined | null, index: number): T | undefined {
  if (!array || !Array.isArray(array) || index < 0 || index >= array.length) {
    return undefined
  }
  return array[index]
}

export function safeObjectAccess<T>(obj: any, path: string): T | undefined {
  if (!obj || typeof obj !== "object") {
    return undefined
  }

  const keys = path.split(".")
  let current = obj

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined
    }
    current = current[key]
  }

  return current
}

export function createAbortController(timeoutMs = 30000): AbortController {
  const controller = new AbortController()

  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  // Clear timeout if request completes normally
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId)
  })

  return controller
}

export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  fallback: T,
  onError?: (error: Error) => void,
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error")
    console.error("[v0] Safe async operation failed:", err)
    onError?.(err)
    return fallback
  }
}

export function isBrowserAPIAvailable(api: string): boolean {
  switch (api) {
    case "geolocation":
      return "geolocation" in navigator
    case "mediaDevices":
      return "mediaDevices" in navigator && "getUserMedia" in navigator.mediaDevices
    case "fileReader":
      return typeof FileReader !== "undefined"
    default:
      return false
  }
}
