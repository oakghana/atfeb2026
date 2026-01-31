"use client"

import { useState, useCallback } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { validateSupabaseCRUDOperations, generateCRUDReport } from "@/lib/supabase-crud-validator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react"

interface CRUDTestResult {
  operation: string
  status: "pass" | "fail" | "warning"
  message: string
  duration: number
  details?: any
}

export default function DiagnosticsPage() {
  const [results, setResults] = useState<CRUDTestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [report, setReport] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  const runCRUDTests = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    setResults([])
    setReport("")

    try {
      const testResults = await validateSupabaseCRUDOperations()
      setResults(testResults)
      const generatedReport = generateCRUDReport(testResults)
      setReport(generatedReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error during CRUD tests")
      console.error("[v0] CRUD test error:", err)
    } finally {
      setIsRunning(false)
    }
  }, [])

  const getStatusIcon = (status: "pass" | "fail" | "warning") => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case "fail":
        return <XCircle className="h-5 w-5 text-red-500" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusBadgeVariant = (status: "pass" | "fail" | "warning") => {
    switch (status) {
      case "pass":
        return "default"
      case "fail":
        return "destructive"
      case "warning":
        return "secondary"
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-12">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">System Diagnostics</h1>
        <p className="text-muted-foreground">Test Supabase CRUD operations and system health</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Supabase CRUD Validator</CardTitle>
          <CardDescription>Run comprehensive tests on database operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runCRUDTests} disabled={isRunning} size="lg" className="w-full">
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run CRUD Tests
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border">
                  {getStatusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{result.operation}</span>
                      <Badge variant={getStatusBadgeVariant(result.status)}>{result.status}</Badge>
                      <span className="text-sm text-muted-foreground">{result.duration.toFixed(2)}ms</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                    {result.details && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {JSON.stringify(result.details)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {report && (
            <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96">
              {report}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>System and operation performance summary</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Execution Time</span>
                <span className="font-bold">{results.reduce((sum, r) => sum + r.duration, 0).toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Passed Tests</span>
                <span className="font-bold text-green-600">{results.filter((r) => r.status === "pass").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Failed Tests</span>
                <span className="font-bold text-red-600">{results.filter((r) => r.status === "fail").length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Warnings</span>
                <span className="font-bold text-yellow-600">{results.filter((r) => r.status === "warning").length}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Run tests to see metrics</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
