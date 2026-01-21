"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Shield, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react"

interface TestResult {
  attempt: number
  status: "success" | "error" | "pending"
  message: string
  timestamp: string
  details?: string
}

export default function TestDuplicateCheckIn() {
  const [results, setResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const simulateCheckIn = async (attemptNumber: number): Promise<TestResult> => {
    console.log(`[v0] Test Attempt ${attemptNumber}: Starting check-in simulation`)
    
    const timestamp = new Date().toISOString()
    
    try {
      // Simulate check-in API call
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: {
            latitude: 5.614818,
            longitude: -0.205874,
            accuracy: 10,
          },
          locationCode: "qcc_head_office",
        }),
      })

      const data = await response.json()
      console.log(`[v0] Test Attempt ${attemptNumber}: Response status ${response.status}`, data)

      if (response.ok) {
        return {
          attempt: attemptNumber,
          status: "success",
          message: "Check-in successful",
          timestamp,
          details: data.message || "Successfully checked in",
        }
      } else {
        return {
          attempt: attemptNumber,
          status: "error",
          message: data.error || "Check-in failed",
          timestamp,
          details: data.details || JSON.stringify(data),
        }
      }
    } catch (error) {
      console.error(`[v0] Test Attempt ${attemptNumber}: Error occurred`, error)
      return {
        attempt: attemptNumber,
        status: "error",
        message: "Network or server error",
        timestamp,
        details: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const runTest = async () => {
    setIsRunning(true)
    setResults([])
    console.log("[v0] Starting duplicate check-in test")

    // Attempt 1: First check-in
    const result1 = await simulateCheckIn(1)
    setResults([result1])
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Attempt 2: Immediate duplicate (should fail)
    const result2 = await simulateCheckIn(2)
    setResults((prev) => [...prev, result2])
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Attempt 3: Another duplicate after delay (should also fail)
    const result3 = await simulateCheckIn(3)
    setResults((prev) => [...prev, result3])

    console.log("[v0] Duplicate check-in test completed")
    setIsRunning(false)
  }

  const resetTest = () => {
    setResults([])
    console.log("[v0] Test reset")
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" />
            Duplicate Check-In Prevention Test
          </CardTitle>
          <CardDescription>
            This test simulates multiple check-in attempts to verify the duplicate prevention system is working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/20">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertTitle>Protection Mechanisms</AlertTitle>
            <AlertDescription>
              The system has three layers of protection:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Database unique constraint (primary protection)</li>
                <li>2-hour checkout restriction (secondary protection)</li>
                <li>Client-side debouncing with 3-second cooldown (tertiary protection)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button
              onClick={runTest}
              disabled={isRunning}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>Run Duplicate Check-In Test</>
              )}
            </Button>
            <Button onClick={resetTest} variant="outline" disabled={isRunning || results.length === 0}>
              Reset
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Test Results</h3>
              
              {results.map((result) => (
                <Card key={result.attempt} className={result.status === "success" ? "border-green-500" : "border-red-500"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {result.status === "success" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      Attempt #{result.attempt}
                    </CardTitle>
                    <CardDescription>{new Date(result.timestamp).toLocaleTimeString()}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="font-medium min-w-20">Status:</span>
                      <span className={result.status === "success" ? "text-green-600" : "text-red-600"}>
                        {result.message}
                      </span>
                    </div>
                    {result.details && (
                      <div className="flex items-start gap-2">
                        <span className="font-medium min-w-20">Details:</span>
                        <span className="text-sm text-muted-foreground">{result.details}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {results.length === 3 && (
                <Alert className={
                  results[0].status === "success" && results[1].status === "error" && results[2].status === "error"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                }>
                  {results[0].status === "success" && results[1].status === "error" && results[2].status === "error" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800 dark:text-green-200">Test Passed!</AlertTitle>
                      <AlertDescription className="text-green-700 dark:text-green-300">
                        The duplicate prevention system is working correctly. First check-in succeeded, and all subsequent
                        attempts were blocked as expected.
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertTitle className="text-orange-800 dark:text-orange-200">Test Results Unexpected</AlertTitle>
                      <AlertDescription className="text-orange-700 dark:text-orange-300">
                        The test results don't match expected behavior. Please review the results above and check if the
                        duplicate prevention mechanisms are properly configured.
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}
            </div>
          )}

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Note:</strong> This test requires you to be authenticated and have the proper permissions. If all attempts fail,
              ensure you are logged in and have an active user profile.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
