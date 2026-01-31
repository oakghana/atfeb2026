/**
 * Request deduplication and caching utility for optimizing API calls
 * Prevents duplicate requests and caches responses
 */

interface CacheEntry {
  data: any
  timestamp: number
  expiryMs: number
}

interface PendingRequest {
  promise: Promise<any>
  resolvePromise: (data: any) => void
  rejectPromise: (error: any) => void
}

class RequestManager {
  private cache = new Map<string, CacheEntry>()
  private pendingRequests = new Map<string, PendingRequest>()
  private defaultCacheMs = 30000 // 30 seconds

  private generateCacheKey(endpoint: string, options?: any): string {
    return `${endpoint}:${JSON.stringify(options || {})}`
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.expiryMs
  }

  async request<T>(
    endpoint: string,
    options: RequestInit & { cacheMs?: number; deduplicate?: boolean } = {}
  ): Promise<T> {
    const { cacheMs = this.defaultCacheMs, deduplicate = true, ...fetchOptions } = options
    const cacheKey = this.generateCacheKey(endpoint, fetchOptions.body)

    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached && this.isCacheValid(cached)) {
      console.log(`[v0] Using cached response for ${endpoint}`)
      return cached.data
    }

    // Check if request is already in progress (deduplication)
    if (deduplicate && this.pendingRequests.has(cacheKey)) {
      console.log(`[v0] Returning pending request for ${endpoint}`)
      return this.pendingRequests.get(cacheKey)!.promise
    }

    // Create new promise for the request
    let resolvePromise: (data: any) => void
    let rejectPromise: (error: any) => void

    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve
      rejectPromise = reject
    })

    // Store pending request
    this.pendingRequests.set(cacheKey, {
      promise,
      resolvePromise: resolvePromise!,
      rejectPromise: rejectPromise!,
    })

    try {
      console.log(`[v0] Making request to ${endpoint}`)
      const response = await fetch(endpoint, fetchOptions)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || "Request failed")
      }

      // Cache the response
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        expiryMs: cacheMs,
      })

      resolvePromise!(data)
      return data
    } catch (error) {
      console.error(`[v0] Request failed for ${endpoint}:`, error)
      rejectPromise!(error)
      throw error
    } finally {
      // Remove from pending requests
      this.pendingRequests.delete(cacheKey)
    }
  }

  invalidateCache(endpoint?: string): void {
    if (endpoint) {
      // Remove specific endpoint cache entries
      for (const key of this.cache.keys()) {
        if (key.startsWith(endpoint)) {
          this.cache.delete(key)
        }
      }
    } else {
      // Clear all cache
      this.cache.clear()
    }
  }

  clearPendingRequests(): void {
    this.pendingRequests.clear()
  }
}

// Export singleton instance
export const requestManager = new RequestManager()

/**
 * Hook for using request manager in React components
 */
export function useOptimizedRequest() {
  return {
    request: requestManager.request.bind(requestManager),
    invalidateCache: requestManager.invalidateCache.bind(requestManager),
  }
}
