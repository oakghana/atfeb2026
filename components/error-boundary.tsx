'use client'

import React, { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full space-y-4">
              <div className="flex justify-center">
                <div className="p-3 bg-destructive/10 rounded-full">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold">Something went wrong</h2>
                <p className="text-sm text-muted-foreground">
                  Please try refreshing the page or contact support if the problem persists.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="w-full h-12 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}
