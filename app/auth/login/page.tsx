"use client"

import type React from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Image from "next/image"
import { useNotifications } from "@/components/ui/notification-system"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [otpEmail, setOtpEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const router = useRouter()

  const { showFieldError, showSuccess, showError, showWarning } = useNotifications()

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

      if (!identifier.trim()) {
        showFieldError("Staff Number/Email", "Please enter your staff number or email address")
        return
      }

      if (!password.trim()) {
        showFieldError("Password", "Please enter your password")
        return
      }

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
          showError(
            `Demo Account: ${demoUser.name} needs activation. Please sign up first at /auth/signup with Email: ${demoUser.email} and Password: pa$$w0rd`,
            "Account Activation Required",
          )
          console.log("[v0] Demo user needs to sign up first:", demoUser.email)
          return
        }

        if (authError) {
          console.log("[v0] Demo user login error:", authError)
          showError(`Demo login error: ${authError.message}`, "Login Failed")
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
          showError(
            "QCC Admin account not found. Please sign up first at the signup page with email: QCC@qccgh.onmicrosoft.com and password: admin",
            "Account Not Found",
          )
          console.log("[v0] QCC Admin needs to sign up first")
          return
        }

        if (authError) {
          console.log("[v0] QCC Admin login error:", authError)
          showError(`Admin login error: ${authError.message}`, "Login Failed")
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
            showFieldError("Staff Number", result.error || "Staff number not found")
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

        const errorMessage = error.message
        if (error.message.includes("Invalid login credentials")) {
          if (email === "admin.user@qccgh.com" || email === "staff.user@qccgh.com" || email === "hod.user@qccgh.com") {
            showError(
              `Account not activated. Please sign up first at /auth/signup with email: ${email} and password: pa$$w0rd to activate your account.`,
              "Account Activation Required",
            )
          } else {
            showFieldError("Credentials", "Invalid credentials. Please check your staff number/email and password.")
          }
        } else if (error.message.includes("Email not confirmed")) {
          showWarning(
            "Please check your email and click the confirmation link before logging in.",
            "Email Confirmation Required",
          )
        } else if (error.message.includes("User not found")) {
          showFieldError("Account", "No account found. Please contact your administrator or sign up first.")
        } else {
          showError(errorMessage, "Login Failed")
        }
        return
      }

      if (data?.user?.id) {
        const approvalCheck = await checkUserApproval(data.user.id)

        if (!approvalCheck.approved) {
          await logLoginActivity(data.user.id, "login_blocked_unapproved", false, "password")
          await supabase.auth.signOut()
          showWarning(approvalCheck.error || "Account not approved", "Account Approval Required")
          if (approvalCheck.error?.includes("pending admin approval")) {
            router.push("/auth/pending-approval")
          }
          return
        }

        await logLoginActivity(data.user.id, "login_success", true, "password")
      }

      console.log("[v0] Login successful, redirecting to dashboard")
      showSuccess("Login successful! Redirecting to dashboard...", "Welcome Back")
      router.push("/dashboard")
    } catch (error: unknown) {
      console.log("[v0] Caught error:", error)
      showError(error instanceof Error ? error.message : "An error occurred during login", "Login Error")
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
      if (!otpEmail.trim()) {
        showFieldError("Email", "Please enter your email address")
        return
      }

      if (!otpEmail.includes("@") || !otpEmail.includes(".")) {
        showFieldError("Email", "Please enter a valid email address")
        return
      }

      console.log("[v0] Validating email before sending OTP:", otpEmail)

      let validateResponse
      try {
        // Test basic connectivity first
        console.log("[v0] Testing API connectivity...")
        const connectivityTest = await fetch("/api/auth/validate-email", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        })
        console.log("[v0] Connectivity test response:", connectivityTest.status)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

        console.log("[v0] Making POST request to validate email...")
        validateResponse = await fetch("/api/auth/validate-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({ email: otpEmail }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        console.log("[v0] Fetch completed successfully, status:", validateResponse.status)
      } catch (fetchError) {
        console.error("[v0] Fetch failed:", fetchError)

        if (fetchError instanceof Error) {
          if (fetchError.name === "AbortError") {
            showError("Request timeout. The server is taking too long to respond. Please try again.", "Timeout Error")
          } else if (fetchError.message.includes("Failed to fetch")) {
            // This is the specific error we're getting
            showError(
              "Unable to connect to the authentication server. This may be a temporary network issue. Please check your internet connection and try again in a few moments.",
              "Connection Error",
            )
          } else if (fetchError.message.includes("NetworkError")) {
            showError("Network error occurred. Please check your internet connection and try again.", "Network Error")
          } else {
            showError(`Connection failed: ${fetchError.message}. Please try again.`, "Connection Error")
          }
        } else {
          showError("Unknown network error. Please try again.", "Network Error")
        }
        return
      }

      console.log("[v0] Validate response status:", validateResponse.status)
      console.log("[v0] Validate response headers:", validateResponse.headers.get("content-type"))

      const contentType = validateResponse.headers.get("content-type")

      // Get response text first to debug
      const responseText = await validateResponse.text()
      console.log("[v0] Raw response text:", responseText.substring(0, 200)) // Log first 200 chars

      if (!responseText) {
        console.error("[v0] Empty response received")
        showError("Server error: Empty response. Please try again.", "Server Error")
        return
      }

      // Check if response looks like HTML (common on deployed domains when there's an error)
      if (responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
        console.error("[v0] Received HTML instead of JSON - likely server error")
        showError("Server configuration error. Please contact support or try again later.", "Server Error")
        return
      }

      let validateResult
      try {
        validateResult = JSON.parse(responseText)
      } catch (jsonError) {
        console.error("[v0] JSON parsing error:", jsonError)
        console.error("[v0] Response text that failed to parse:", responseText.substring(0, 500))

        if (responseText.includes("Internal Server Error") || responseText.includes("500")) {
          showError("Server is temporarily unavailable. Please try again in a few minutes.", "Server Error")
        } else {
          showError("Server error: Invalid response format. Please contact support.", "Server Error")
        }
        return
      }

      console.log("[v0] Parsed validation result:", validateResult.message)

      if (!validateResponse.ok) {
        showFieldError("Email", validateResult.error || "Email validation failed")
        return
      }

      if (!validateResult.exists) {
        showFieldError("Email", "This email is not registered in the QCC system. Please contact your administrator.")
        return
      }

      if (!validateResult.approved) {
        showWarning(
          "Your account is pending admin approval. Please wait for activation before using OTP login.",
          "Account Approval Required",
        )
        return
      }

      console.log("[v0] Email validated, sending OTP")

      try {
        console.log("[v0] Calling Supabase signInWithOtp for email:", otpEmail)

        const otpResult = await supabase.auth.signInWithOtp({
          email: otpEmail,
          options: {
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
            shouldCreateUser: false, // Don't create new users via OTP
          },
        })

        console.log("[v0] Supabase OTP result:", otpResult)

        if (otpResult.error) {
          console.error("[v0] Supabase OTP error details:", {
            message: otpResult.error.message,
            status: otpResult.error.status,
            details: otpResult.error,
          })

          if (otpResult.error.message.includes("Email rate limit exceeded")) {
            throw new Error("Too many OTP requests. Please wait 5 minutes before trying again.")
          } else if (otpResult.error.message.includes("Invalid email")) {
            throw new Error("Invalid email format. Please check your email address.")
          } else if (otpResult.error.message.includes("User not found")) {
            throw new Error("Email not found in the system. Please contact your administrator.")
          } else if (otpResult.error.message.includes("Signup not allowed")) {
            throw new Error("OTP login is not available for this email. Please use password login.")
          } else {
            throw new Error(`OTP sending failed: ${otpResult.error.message}`)
          }
        }

        console.log("[v0] OTP sent successfully")
        setOtpSent(true)
        showSuccess("OTP sent to your email. Please check your inbox and enter the code below.", "OTP Sent")
      } catch (supabaseError) {
        console.error("[v0] Supabase OTP call failed:", supabaseError)
        throw supabaseError
      }
    } catch (error: unknown) {
      console.error("[v0] OTP send error:", error)
      if (error instanceof Error) {
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          showError(
            "Network connectivity issue. Please check your internet connection and try again. If the problem persists, contact IT support.",
            "Connection Error",
          )
        } else if (
          error.message.includes("OTP sending failed") ||
          error.message.includes("Too many OTP requests") ||
          error.message.includes("Invalid email") ||
          error.message.includes("Email not found")
        ) {
          showFieldError("Email", error.message)
        } else {
          showError(`Failed to send OTP: ${error.message}. Please try again or contact support.`, "OTP Error")
        }
      } else {
        showError("Failed to send OTP. Please try again.", "OTP Error")
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
      if (!otp.trim()) {
        showFieldError("OTP Code", "Please enter the OTP code")
        return
      }

      if (otp.length !== 6) {
        showFieldError("OTP Code", "OTP code must be 6 digits")
        return
      }

      if (!/^\d{6}$/.test(otp)) {
        showFieldError("OTP Code", "OTP code must contain only numbers")
        return
      }

      console.log("[v0] Verifying OTP:", otp.substring(0, 2) + "****") // Log first 2 digits only for security

      const { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otp,
        type: "email",
      })

      if (error) {
        console.error("[v0] OTP verification error:", error.message)
        if (data?.user?.id) {
          await logLoginActivity(data.user.id, "otp_login_failed", false, "otp")
        }

        if (error.message.includes("expired")) {
          showFieldError("OTP Code", "OTP code has expired. Please request a new one.")
        } else if (error.message.includes("invalid")) {
          showFieldError("OTP Code", "Invalid OTP code. Please check and try again.")
        } else {
          showFieldError("OTP Code", "Invalid or expired OTP code. Please try again.")
        }
        return
      }

      if (data?.user?.id) {
        const approvalCheck = await checkUserApproval(data.user.id)

        if (!approvalCheck.approved) {
          await logLoginActivity(data.user.id, "otp_login_blocked_unapproved", false, "otp")
          await supabase.auth.signOut()
          showWarning(approvalCheck.error || "Account not approved", "Account Approval Required")
          if (approvalCheck.error?.includes("pending admin approval")) {
            router.push("/auth/pending-approval")
          }
          return
        }

        await logLoginActivity(data.user.id, "otp_login_success", true, "otp")
      }

      console.log("[v0] OTP verification successful")
      showSuccess("OTP verified successfully! Redirecting to dashboard...", "Login Successful")
      router.push("/dashboard")
    } catch (error: unknown) {
      console.error("[v0] OTP verification exception:", error)
      showFieldError("OTP Code", error instanceof Error ? error.message : "Invalid OTP code")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border border-gray-200 bg-white">
          <CardHeader className="text-center space-y-6 pb-8">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm">
                <Image
                  src="/images/qcc-logo.png"
                  alt="QCC Logo - Quality Control Company Limited"
                  width={80}
                  height={80}
                  className="rounded-full object-contain"
                />
              </div>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-[#4A7C59] tracking-wide">
                QCC ELECTRONIC ATTENDANCE
              </CardTitle>
              <CardDescription className="text-gray-600 text-sm">
                Sign in with your Staff Number, Email or use OTP
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg">
                <TabsTrigger
                  value="password"
                  className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                >
                  Staff Login
                </TabsTrigger>
                <TabsTrigger
                  value="otp"
                  className="data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:shadow-sm"
                >
                  OTP Login
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="space-y-6 mt-6">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-sm font-medium text-gray-700">
                      Staff Number or Email Address
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="ohemengappiah@qccgh.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      className="h-12 border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59] bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">
                      Enter your 7-digit staff number (e.g., 1234567) or corporate email address
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-12 border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59] bg-gray-50"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 bg-[#4A7C59] hover:bg-[#3d6b4a] text-white font-medium rounded-lg"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="otp" className="space-y-6 mt-6">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="otpEmail" className="text-sm font-medium text-gray-700">
                        Corporate Email Address
                      </Label>
                      <Input
                        id="otpEmail"
                        type="email"
                        placeholder="your.email@qccgh.com"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        required
                        className="h-12 border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59] bg-gray-50"
                      />
                      <p className="text-xs text-gray-500">OTP will be sent to your registered email address</p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-[#4A7C59] hover:bg-[#3d6b4a] text-white font-medium rounded-lg"
                      disabled={isLoading}
                    >
                      {isLoading ? "Sending OTP..." : "Send OTP Code"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="space-y-4">
                      <Label htmlFor="otp" className="text-sm font-medium text-gray-700">
                        Enter OTP Code
                      </Label>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)} className="gap-2">
                          <InputOTPGroup>
                            <InputOTPSlot
                              index={0}
                              className="w-12 h-12 text-lg border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59]"
                            />
                            <InputOTPSlot
                              index={1}
                              className="w-12 h-12 text-lg border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59]"
                            />
                            <InputOTPSlot
                              index={2}
                              className="w-12 h-12 text-lg border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59]"
                            />
                            <InputOTPSlot
                              index={3}
                              className="w-12 h-12 text-lg border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59]"
                            />
                            <InputOTPSlot
                              index={4}
                              className="w-12 h-12 text-lg border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59]"
                            />
                            <InputOTPSlot
                              index={5}
                              className="w-12 h-12 text-lg border-gray-300 focus:border-[#4A7C59] focus:ring-[#4A7C59]"
                            />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <p className="text-xs text-gray-500 text-center">Enter the 6-digit code sent to {otpEmail}</p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-[#4A7C59] hover:bg-[#3d6b4a] text-white font-medium rounded-lg"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? "Verifying..." : "Verify OTP"}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent"
                        onClick={() => {
                          setOtpSent(false)
                          setOtp("")
                          setSuccessMessage(null)
                        }}
                      >
                        Back to Email
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 border-[#4A7C59] text-[#4A7C59] hover:bg-[#4A7C59] hover:text-white bg-transparent"
                        onClick={handleSendOtp}
                        disabled={isLoading}
                      >
                        {isLoading ? "Sending..." : "Resend OTP"}
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">Don't have an account?</p>
            </div>

            <div className="mt-6 text-center border-t border-gray-200 pt-6">
              <p className="text-sm font-medium text-gray-700">Quality Control Company Limited</p>
              <p className="text-xs text-gray-500 mt-1">Intranet Portal - Powered by IT Department</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
