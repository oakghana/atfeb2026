"use client"

import type React from "react"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { clearAttendanceCache } from "@/lib/utils/attendance-cache"

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
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
      console.log("[v0] Logging login activity:", { userId, action, success, method })

      const response = await fetch("/api/auth/login-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          action,
          success,
          method,
          ip_address: null, // Will be captured server-side
          user_agent: navigator.userAgent,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        console.error("[v0] Login activity logging failed:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        })
        // Don't throw error - login should continue even if logging fails
        return
      }

      const result = await response.json()
      console.log("[v0] Login activity logged successfully:", result)
    } catch (error) {
      console.error("[v0] Failed to log login activity:", error)
      // Don't throw error - login should continue even if logging fails
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
    console.log("[v0] Sign-in button clicked - handleLogin triggered")
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

      clearAttendanceCache()
      console.log("[v0] Attendance cache cleared on login")

      console.log("[v0] Login successful, redirecting to dashboard")
      showSuccess("Login successful! Redirecting to dashboard...", "Welcome Back")

      // Wait a moment for the success message to show, then do a full page reload
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 500)
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

      console.log("[v0] Attempting to validate email:", otpEmail)

      let emailValidated = false
      let validationError: string | null = null

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const validateResponse = await fetch("/api/auth/validate-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ email: otpEmail }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (validateResponse.ok) {
          const validateResult = await validateResponse.json()

          if (!validateResult.exists) {
            validationError = "This email is not registered in the QCC system. Please contact your administrator."
          } else if (!validateResult.approved) {
            validationError = "Your account is pending admin approval. Please wait for activation."
          } else {
            emailValidated = true
          }
        } else {
          console.log("[v0] Email validation API returned error status:", validateResponse.status)
          // Continue anyway - let Supabase handle the validation
        }
      } catch (fetchError) {
        console.log("[v0] Email validation API failed, will attempt OTP send anyway:", fetchError)
        // Continue anyway - let Supabase handle the validation
      }

      // If validation explicitly failed (email not found or not approved), show error
      if (validationError) {
        showFieldError("Email", validationError)
        return
      }

      // Proceed with OTP sending (either validation passed or we're using fallback)
      console.log("[v0] Sending OTP to:", otpEmail)

      const otpResult = await supabase.auth.signInWithOtp({
        email: otpEmail,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/dashboard`,
          shouldCreateUser: false,
        },
      })

      console.log("[v0] Supabase OTP result:", otpResult)

      if (otpResult.error) {
        console.error("[v0] Supabase OTP error:", otpResult.error.message)

        if (otpResult.error.message.includes("Email rate limit exceeded")) {
          showFieldError("Email", "Too many OTP requests. Please wait 5 minutes before trying again.")
        } else if (
          otpResult.error.message.includes("User not found") ||
          otpResult.error.message.includes("Signups not allowed")
        ) {
          showFieldError(
            "Email",
            "This email is not registered in the system. Please use password login or contact your administrator.",
          )
        } else if (otpResult.error.message.includes("Invalid email")) {
          showFieldError("Email", "Invalid email format. Please check your email address.")
        } else {
          showFieldError("Email", `Failed to send OTP: ${otpResult.error.message}`)
        }
        return
      }

      console.log("[v0] OTP sent successfully")
      setOtpSent(true)
      showSuccess(
        emailValidated
          ? "OTP sent to your email. Please check your inbox and enter the code below."
          : "OTP request sent. If your email is registered, you will receive a code shortly.",
        "OTP Sent",
      )
    } catch (error: unknown) {
      console.error("[v0] OTP send error:", error)
      if (error instanceof Error) {
        showError(`Failed to send OTP: ${error.message}. Please try again or use password login.`, "OTP Error")
      } else {
        showError("Failed to send OTP. Please try again or use password login.", "OTP Error")
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

      // Wait a moment for the success message to show, then do a full page reload
      setTimeout(() => {
        window.location.href = "/dashboard"
      }, 500)
    } catch (error: unknown) {
      console.error("[v0] OTP verification exception:", error)
      showFieldError("OTP Code", error instanceof Error ? error.message : "Invalid OTP code")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Card className="glass-effect shadow-2xl border-border/50">
          <CardHeader className="text-center space-y-6 pb-8">
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center shadow-lg">
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
              <CardTitle className="text-2xl font-bold text-primary tracking-wide">QCC ELECTRONIC ATTENDANCE</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Sign in with your Staff Number, Email or use OTP
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-lg">
                <TabsTrigger
                  value="password"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  Staff Login
                </TabsTrigger>
                <TabsTrigger
                  value="otp"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                >
                  OTP Login
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="space-y-6 mt-6">
                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-sm font-medium text-foreground">
                      Staff Number or Email Address
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="ohemengappiah@qccgh.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      className="h-12 border-border focus:border-primary focus:ring-primary bg-input focus-enhanced"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter your 7-digit staff number (e.g., 1234567) or corporate email address
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-12 border-border focus:border-primary focus:ring-primary bg-input focus-enhanced pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    onClick={(e) => {
                      console.log("[v0] Sign-in button clicked directly")
                      console.log("[v0] Button disabled state:", isLoading)
                      console.log("[v0] Identifier:", identifier)
                      console.log("[v0] Password length:", password.length)
                    }}
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
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
                      <Label htmlFor="otpEmail" className="text-sm font-medium text-foreground">
                        Corporate Email Address
                      </Label>
                      <Input
                        id="otpEmail"
                        type="email"
                        placeholder="your.email@qccgh.com"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        required
                        className="h-12 border-border focus:border-primary focus:ring-primary bg-input focus-enhanced"
                      />
                      <p className="text-xs text-muted-foreground">OTP will be sent to your registered email address</p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={isLoading}
                    >
                      {isLoading ? "Sending OTP..." : "Send OTP Code"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-6">
                    <div className="space-y-4">
                      <Label htmlFor="otp" className="text-sm font-medium text-foreground">
                        Enter OTP Code
                      </Label>
                      <div className="flex justify-center">
                        <InputOTP maxLength={6} value={otp} onChange={(value) => setOtp(value)} className="gap-2">
                          <InputOTPGroup>
                            <InputOTPSlot
                              index={0}
                              className="w-12 h-12 text-lg border-border focus:border-primary focus:ring-primary bg-input"
                            />
                            <InputOTPSlot
                              index={1}
                              className="w-12 h-12 text-lg border-border focus:border-primary focus:ring-primary bg-input"
                            />
                            <InputOTPSlot
                              index={2}
                              className="w-12 h-12 text-lg border-border focus:border-primary focus:ring-primary bg-input"
                            />
                            <InputOTPSlot
                              index={3}
                              className="w-12 h-12 text-lg border-border focus:border-primary focus:ring-primary bg-input"
                            />
                            <InputOTPSlot
                              index={4}
                              className="w-12 h-12 text-lg border-border focus:border-primary focus:ring-primary bg-input"
                            />
                            <InputOTPSlot
                              index={5}
                              className="w-12 h-12 text-lg border-border focus:border-primary focus:ring-primary bg-input"
                            />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Enter the 6-digit code sent to {otpEmail}
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? "Verifying..." : "Verify OTP"}
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 h-12 border-border text-foreground hover:bg-muted bg-transparent"
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
                        className="flex-1 h-12 border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
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
              <p className="text-sm text-muted-foreground">Don't have an account?</p>
            </div>

            <div className="mt-6 text-center border-t border-border pt-6">
              <p className="text-sm font-medium text-foreground">Quality Control Company Limited</p>
              <p className="text-xs text-muted-foreground mt-1">Intranet Portal - Powered by IT Department</p>
              <p className="text-xs text-muted-foreground mt-2 font-mono">v.1.9.113 22/11/25</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
