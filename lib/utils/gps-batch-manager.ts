/**
 * GPS Caching and Batching System
 * Optimizes GPS requests by caching, batching, and deduplicating
 */

export interface GPSLocation {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
}

interface GPSBatch {
  locations: GPSLocation[]
  timestamp: number
}

class GPSBatchManager {
  private batch: GPSLocation[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private batchSize = 5
  private batchIntervalMs = 3000 // 3 seconds
  private onBatchReady: ((batch: GPSLocation[]) => Promise<void>) | null = null
  private lastLocationCache: GPSLocation | null = null
  private cacheExpiryMs = 30000 // 30 seconds

  private minDistanceMeters = 10 // Only add to batch if moved 10+ meters

  addLocation(location: GPSLocation, callback?: (batch: GPSLocation[]) => Promise<void>): void {
    // Skip if location hasn't moved significantly
    if (this.lastLocationCache) {
      const distance = this.calculateDistance(
        this.lastLocationCache.latitude,
        this.lastLocationCache.longitude,
        location.latitude,
        location.longitude
      )

      if (distance < this.minDistanceMeters && Date.now() - this.lastLocationCache.timestamp < this.cacheExpiryMs) {
        console.log(`[v0] Location change too small (${distance.toFixed(2)}m), skipping`)
        return
      }
    }

    this.lastLocationCache = location
    this.batch.push(location)

    if (callback) {
      this.onBatchReady = callback
    }

    // Send batch if size reached
    if (this.batch.length >= this.batchSize) {
      this.flushBatch()
    } else {
      // Set timer if not already set
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.flushBatch()
        }, this.batchIntervalMs)
      }
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000 // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLon = ((lon2 - lon1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    if (this.batch.length === 0) {
      return
    }

    const batchToSend = [...this.batch]
    this.batch = []

    console.log(`[v0] Flushing GPS batch with ${batchToSend.length} locations`)

    if (this.onBatchReady) {
      try {
        await this.onBatchReady(batchToSend)
      } catch (error) {
        console.error("[v0] Error processing GPS batch:", error)
      }
    }
  }

  getCurrentLocation(): GPSLocation | null {
    if (this.lastLocationCache && Date.now() - this.lastLocationCache.timestamp < this.cacheExpiryMs) {
      return this.lastLocationCache
    }
    return null
  }

  clear(): void {
    this.batch = []
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
  }

  setBatchSize(size: number): void {
    this.batchSize = size
  }

  setBatchInterval(intervalMs: number): void {
    this.batchIntervalMs = intervalMs
  }

  setMinDistance(meters: number): void {
    this.minDistanceMeters = meters
  }
}

export const gpsBatchManager = new GPSBatchManager()

/**
 * Hook for using GPS batch manager
 */
export function useGPSBatching(onBatchReady?: (batch: GPSLocation[]) => Promise<void>) {
  return {
    addLocation: (location: GPSLocation) => {
      gpsBatchManager.addLocation(location, onBatchReady)
    },
    getCurrentLocation: () => gpsBatchManager.getCurrentLocation(),
    flushBatch: () => gpsBatchManager.clear(),
    configureBatching: (config: { batchSize?: number; batchIntervalMs?: number; minDistanceMeters?: number }) => {
      if (config.batchSize) gpsBatchManager.setBatchSize(config.batchSize)
      if (config.batchIntervalMs) gpsBatchManager.setBatchInterval(config.batchIntervalMs)
      if (config.minDistanceMeters) gpsBatchManager.setMinDistance(config.minDistanceMeters)
    },
  }
}
