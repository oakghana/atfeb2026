'use client'

export function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-3 sm:p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="animate-pulse space-y-6">
          {/* Logo skeleton */}
          <div className="flex justify-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-muted" />
          </div>

          {/* Title skeleton */}
          <div className="space-y-2 text-center">
            <div className="h-6 bg-muted rounded w-48 mx-auto" />
            <div className="h-4 bg-muted rounded w-56 mx-auto" />
          </div>

          {/* Tabs skeleton */}
          <div className="flex gap-2 bg-muted/50 p-1 rounded-lg h-11">
            <div className="flex-1 bg-muted rounded" />
            <div className="flex-1 bg-muted rounded" />
          </div>

          {/* Form skeleton */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="h-12 bg-muted rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-12 bg-muted rounded" />
            </div>
            <div className="h-12 bg-muted rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function AttendanceSkeleton() {
  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-4">
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-4 bg-muted rounded w-96" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 bg-muted/50 p-1 rounded-lg h-12 w-96">
        <div className="flex-1 bg-muted rounded" />
        <div className="flex-1 bg-muted rounded" />
      </div>

      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-40 bg-muted rounded" />
        <div className="h-32 bg-muted rounded" />
      </div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8 animate-pulse">
      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-80 bg-muted rounded-lg" />
        <div className="h-80 bg-muted rounded-lg" />
      </div>
    </div>
  )
}
