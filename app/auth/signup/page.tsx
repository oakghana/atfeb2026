"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import Image from "next/image"

interface Department {
  id: string
  name: string
  code: string
}

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    employeeId: "",
    departmentId: "",
    position: "",
    region: "", // Added region field
  })
  const [departments, setDepartments] = useState<Department[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const qccRegions = [
    "Head Office",
    "Tema Port",
    "Tema Research",
    "Tema Training School",
    "Nsawam Archive Center",
    "Awutu Stores",
    "Takoradi Port",
    "Kaase Port",
    "Ashanti Regional Office",
    "Brong Ahafo Regional Office",
    "Western South Regional Office",
    "Western North Regional Office",
    "Volta Regional Office",
    "Eastern Regional Office",
    "Central Regional Office",
  ]

  useEffect(() => {
    const fetchDepartments = async () => {
      const supabase = createClient()
      const { data } = await supabase.from("departments").select("id, name, code").eq("is_active", true)
      if (data) setDepartments(data)
    }
    fetchDepartments()
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()

      console.log("[v0] Starting signup process for:", formData.email)

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/pending-approval`,
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            employee_id: formData.employeeId,
            department_id: formData.departmentId,
            position: formData.position,
            region: formData.region,
            role: "staff",
            is_active: false,
            approval_status: "pending",
          },
        },
      })

      console.log("[v0] Signup response:", { data, error })

      if (error) {
        console.error("[v0] Signup error:", error)
        if (error.message.includes("email") || error.message.includes("confirmation")) {
          setError("Email confirmation failed. Please check your email settings or contact IT support.")
        } else {
          setError(error.message)
        }
        return
      }

      if (data.user) {
        console.log("[v0] User created, redirecting to pending approval page")
        router.push("/auth/pending-approval")
      } else {
        console.warn("[v0] Unexpected signup response")
        setError("Account creation completed, but please check your email for verification.")
      }
    } catch (error: unknown) {
      console.error("[v0] Signup exception:", error)
      const errorMessage = error instanceof Error ? error.message : "An error occurred during signup"

      if (errorMessage.includes("SMTP") || errorMessage.includes("email")) {
        setError(
          "Email service is currently unavailable. Your account may have been created - try logging in or contact IT support.",
        )
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-secondary/5 p-4">
      <div className="w-full max-w-lg">
        <Card className="shadow-2xl border-0 bg-card/98 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <div className="relative">
                <Image
                  src="/images/qcc-logo.png"
                  alt="QCC Logo"
                  width={90}
                  height={90}
                  className="rounded-full shadow-lg"
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary/20 to-secondary/20"></div>
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                QCC ELECTRONIC ATTENDANCE APP
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                Provide your QCC details to help add you to the app
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSignup} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium text-foreground">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    placeholder="Kwame"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className="h-11 border-2 focus:border-secondary transition-colors"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium text-foreground">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    placeholder="Asante"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className="h-11 border-2 focus:border-secondary transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeId" className="text-sm font-medium text-foreground">
                  Employee ID
                </Label>
                <Input
                  id="employeeId"
                  placeholder="701234"
                  value={formData.employeeId}
                  onChange={(e) => handleInputChange("employeeId", e.target.value)}
                  className="h-11 border-2 focus:border-secondary transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="kwame.asante@qccgh.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="h-11 border-2 focus:border-secondary transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="region" className="text-sm font-medium text-foreground">
                  QCC Location
                </Label>
                <Select onValueChange={(value) => handleInputChange("region", value)}>
                  <SelectTrigger className="h-11 border-2 focus:border-secondary">
                    <SelectValue placeholder="Select your QCC location" />
                  </SelectTrigger>
                  <SelectContent>
                    {qccRegions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department" className="text-sm font-medium text-foreground">
                    Department
                  </Label>
                  <Select onValueChange={(value) => handleInputChange("departmentId", value)}>
                    <SelectTrigger className="h-11 border-2 focus:border-secondary">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position" className="text-sm font-medium text-foreground">
                    Position
                  </Label>
                  <Input
                    id="position"
                    placeholder="Senior HR Manager"
                    value={formData.position}
                    onChange={(e) => handleInputChange("position", e.target.value)}
                    className="h-11 border-2 focus:border-secondary transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 6 characters"
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="h-11 border-2 focus:border-secondary transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className="h-11 border-2 focus:border-secondary transition-colors"
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                  <AlertDescription className="text-destructive">{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-semibold shadow-lg transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="font-semibold text-secondary hover:text-secondary/80 underline underline-offset-4 transition-colors"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
