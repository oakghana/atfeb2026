"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("") // Changed from email to identifier to support both email and staff number
  const [password, setPassword] = useState("")
  const [otpEmail, setOtpEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()

  const logLoginActivity = async (userId: string, action: string, success: boolean, method: string) => {
    try {
      await fetch("/api/auth/login-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          action,
          success,
          method,
          ip_address: null, // Will be captured server-side
          user_agent: navigator.userAgent,
        }),
      })
    } catch (error) {
      console.error("Failed to log login activity:", error)
    }
  }

  const checkUserApproval = async (userId: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("user_profiles")
        .select("is_active, first_name, last_name")
        .eq("id", userId)
        .single()

      if (error) {
        console.error("Error checking user approval:", error)
        return { approved: false, error: "Failed to verify account status" }
      }

      if (!data) {
        return { approved: false, error: "User profile not found. Please contact administrator." }
      }

      return {
        approved: data.is_active,
        name: `${data.first_name} ${data.last_name}`,
        error: data.is_active ? null : "Your account is pending admin approval. Please wait for activation.",
      }
    } catch (error) {
      console.error("Exception checking user approval:", error)
      return { approved: false, error: "Failed to verify account status" }
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      console.log("[v0] Attempting login with identifier:", identifier)

      const demoUsers = [
        { email: "admin.system@qccgh.com", staff: "5000001", name: "System Admin" },
        { email: "admin.hr@qccgh.com", staff: "5000002", name: "HR Admin" },
        { email: "admin.ops@qccgh.com", staff: "5000003", name: "Operations Admin" },
        { email: "hod.academic@qccgh.com", staff: "4000001", name: "Academic Affairs HOD" },
        { email: "hod.student@qccgh.com", staff: "4000002", name: "Student Affairs HOD" },
        { email: "hod.finance@qccgh.com", staff: "4000003", name: "Finance HOD" },
        { email: "admin.user@qccgh.com", staff: "1000001", name: "Test Admin" },
        { email: "staff.user@qccgh.com", staff: "2000001", name: "Test Staff" },
        { email: "hod.user@qccgh.com", staff: "3000001", name: "Test HOD" },
      ]

      const demoUser = demoUsers.find((user) => identifier === user.email || identifier === user.staff)

      if (demoUser) {
        console.log("[v0] Demo user login detected:", demoUser.name)

        // Check if this demo user has signed up yet
        const { data: authCheck, error: authError } = await supabase.auth.signInWithPassword({
          email: demoUser.email,
          password,
        })

        if (authError && authError.message.includes("Invalid login credentials")) {
          setError(
            `Demo Account: ${demoUser.name} needs activation. Please sign up first at /auth/signup with:\n\nEmail: ${demoUser.email}\nPassword: pa$$w0rd\n\nThen return here to login.`,
          )
          console.log("[v0] Demo user needs to sign up first:", demoUser.email)
          return
        }

        if (authError) {
          console.log("[v0] Demo user login error:", authError)
          setError(`Demo login error: ${authError.message}`)
          return
        }

        console.log("[v0] Demo user authenticated successfully:", authCheck)
        // Continue with normal approval check below
      }

      if (identifier === "QCC@qccgh.onmicrosoft.com") {
        console.log("[v0] QCC Admin login detected - checking if account exists")

        // Check if admin has signed up yet
        const { data: authUser, error: authError } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        })

        if (authError && authError.message.includes("Invalid login credentials")) {
          setError(
            "QCC Admin account not found. Please sign up first at the signup page with email: QCC@qccgh.onmicrosoft.com and password: admin",
          )
          console.log("[v0] QCC Admin needs to sign up first")
          return
        }

        if (authError) {
          console.log("[v0] QCC Admin login error:", authError)
          setError(`Admin login error: ${authError.message}`)
          return
        }

        console.log("[v0] QCC Admin authenticated successfully:", authUser)
      }

      let email = identifier

      // If identifier doesn't contain @, it's a staff number - look up the email
      if (!identifier.includes("@")) {
        const demoByStaff = demoUsers.find((user) => identifier === user.staff)
        if (demoByStaff) {
          email = demoByStaff.email
          console.log("[v0] Demo staff number resolved to email:", email)
        } else {
          const response = await fetch("/api/auth/lookup-staff", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier }),
          })

          const result = await response.json()

          if (!response.ok) {
            setError(result.error || "Staff number not found")
            return
          }

          email = result.email
          console.log("[v0] Staff number resolved to email:", email)
        }
      }

      let data, error
      if (identifier === "QCC@qccgh.onmicrosoft.com") {
        // Already authenticated above, just get the session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        data = sessionData
        error = sessionError
        console.log("[v0] QCC Admin session data:", data)
      } else {
        const authResult = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        data = authResult.data
        error = authResult.error
      }

      console.log("[v0] Login response:", { data, error })

      if (error) {
        console.log("[v0] Login error details:", error)

        if (data?.user?.id) {
          await logLoginActivity(data.user.id, "login_failed", false, "password")
        }

        let errorMessage = error.message
        if (error.message.includes("Invalid login credentials")) {
          if (email === "admin.user@qccgh.com" || email === "staff.user@qccgh.com" || email === "hod.user@qccgh.com") {
            errorMessage = `Account not activated. Please sign up first at /auth/signup with email: ${email} and password: pa$$w0rd to activate your account.`
          } else {
            errorMessage = "Invalid credentials. Please check your staff number/email and password."
          }
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage = "Please check your email and click the confirmation link before logging in."
        } else if (error.message.includes("User not found")) {
          errorMessage = "No account found. Please contact your administrator or sign up first."
        }

        setError(errorMessage)
        return
      }

      if (data?.user?.id) {
        const approvalCheck = await checkUserApproval(data.user.id)

        if (!approvalCheck.approved) {
          await logLoginActivity(data.user.id, "login_blocked_unapproved", false, "password")

          // Sign out the user since they're not approved
          await supabase.auth.signOut()

          setError(approvalCheck.error || "Account not approved")

          // Redirect to pending approval page
          if (approvalCheck.error?.includes("pending admin approval")) {
            router.push("/auth/pending-approval")
          }
          return
        }

        await logLoginActivity(data.user.id, "login_success", true, "password")
      }

      console.log("[v0] Login successful, redirecting to dashboard")
      router.push("/dashboard")
    } catch (error: unknown) {
      console.log("[v0] Caught error:", error)
      setError(error instanceof Error ? error.message : "An error occurred during login")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)
    setSuccessMessage(null)

    try {
      console.log("[v0] Validating email before sending OTP:", otpEmail)

      let validateResponse
      try {
        validateResponse = await fetch("/api/auth/validate-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ email: otpEmail }),
        })
        console.log("[v0] Fetch completed successfully")
      } catch (fetchError) {
        console.error("[v0] Fetch failed:", fetchError)
        setError("Network error: Unable to connect to server. Please check your internet connection and try again.")
        return
      }

      console.log("[v0] Validate response status:", validateResponse.status)
      console.log("[v0] Validate response headers:", validateResponse.headers.get("content-type"))

      // Check if response is actually JSON
      const contentType = validateResponse.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("[v0] Response is not JSON:", contentType)
        setError("Server error: Invalid response format. Please try again.")
        return
      }

      // Get response text first to debug
      const responseText = await validateResponse.text()
      console.log("[v0] Raw response text:", responseText)

      if (!responseText) {
        console.error("[v0] Empty response received")
        setError("Server error: Empty response. Please try again.")
        return
      }

      let validateResult
      try {
        validateResult = JSON.parse(responseText)
      } catch (jsonError) {
        console.error("[v0] JSON parsing error:", jsonError)
        console.error("[v0] Response text that failed to parse:", responseText)
        setError("Server error: Invalid response format. Please contact support.")
        return
      }

      console.log("[v0] Parsed validation result:", validateResult)

      if (!validateResponse.ok) {
        setError(validateResult.error || "Email validation failed")
        return
      }

      if (!validateResult.exists) {
        setError("This email is not registered in the QCC system. Please contact your administrator.")
        return
      }

      if (!validateResult.approved) {
        setError("Your account is pending admin approval. Please wait for activation before using OTP login.")
        return
      }

      console.log("[v0] Email validated, sending OTP")

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
        },
      })
      if (otpError) {
        console.error("[v0] Supabase OTP error:", otpError)
        throw otpError
      }
      setOtpSent(true)
      setSuccessMessage("OTP sent to your email. Please check your inbox and enter the code below.")
    } catch (error: unknown) {
      console.error("[v0] OTP send error:", error)
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch")) {
          setError("Network error: Unable to connect to server. Please check your internet connection and try again.")
        } else {
          setError(error.message)
        }
      } else {
        setError("Failed to send OTP. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otp,
        type: "email",
      })

      if (error) {
        if (data?.user?.id) {
          await logLoginActivity(data.user.id, "otp_login_failed", false, "otp")
        }
        throw error
      }

      if (data?.user?.id) {
        const approvalCheck = await checkUserApproval(data.user.id)

        if (!approvalCheck.approved) {
          await logLoginActivity(data.user.id, "otp_login_blocked_unapproved", false, "otp")

          // Sign out the user since they're not approved
          await supabase.auth.signOut()

          setError(approvalCheck.error || "Account not approved")

          // Redirect to pending approval page
          if (approvalCheck.error?.includes("pending admin approval")) {
            router.push("/auth/pending-approval")
          }
          return
        }

        await logLoginActivity(data.user.id, "otp_login_success", true, "otp")
      }

      router.push("/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Invalid OTP code")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-0 bg-card/95 backdrop-blur">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Image src="/images/qcc-logo.png" alt="QCC Logo" width={80} height={80} className="rounded-full" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-primary">QCC ELECTRONIC ATTENDANCE</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sign in with your Staff Number, Email or use OTP
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Staff Login</TabsTrigger>
                <TabsTrigger value="otp">OTP Login</TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="space-y-4 mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-sm font-medium">
                      Staff Number or Email Address
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="1234567 or your.email@qccgh.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter your 7-digit staff number (e.g., 1234567) or corporate email address
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="otp" className="space-y-4 mt-4">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otpEmail" className="text-sm font-medium">
                        Corporate Email Address
                      </Label>
                      <Input
                        id="otpEmail"
                        type="email"
                        placeholder="your.email@qccgh.com"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        required
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">OTP will be sent to your registered email address</p>
                    </div>
                    <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isLoading}>
                      {isLoading ? "Sending OTP..." : "Send OTP Code"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="otp" className="text-sm font-medium">
                        Enter OTP Code
                      </Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        required
                        maxLength={6}
                        className="h-11 text-center text-lg tracking-widest"
                      />
                    </div>
                    <Button type="submit" className="w-full h-11 bg-primary hover:bg-primary/90" disabled={isLoading}>
                      {isLoading ? "Verifying..." : "Verify OTP"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-11 bg-transparent"
                      onClick={() => {
                        setOtpSent(false)
                        setOtp("")
                        setSuccessMessage(null)
                      }}
                    >
                      Back to Email Entry
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {successMessage && (
              <Alert className="mt-4">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="font-medium text-primary hover:text-primary/80 underline underline-offset-4"
                >
                  Sign up here
                </Link>
              </p>
            </div>

            <div className="mt-4 text-center border-t pt-4">
              <p className="text-xs text-muted-foreground font-medium">QEAA</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Powered by the IT Department</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
