"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Shield, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface PasswordResetProps {
  userEmail?: string
  onClose?: () => void
}

export function PasswordReset({ userEmail, onClose }: PasswordResetProps) {
  const [email, setEmail] = useState(userEmail || "")
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setError("Email address is required")
      return
    }

    setIsLoading(true)
    setError("")
    setMessage("")

    try {
      const response = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password")
      }

      setMessage(data.message)
      toast.success("Password reset email sent successfully")

      // Clear form after success
      if (!userEmail) {
        setEmail("")
      }

      // Close modal if callback provided
      if (onClose) {
        setTimeout(onClose, 2000)
      }
    } catch (error) {
      console.error("Password reset error:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset email"
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-600" />
          <CardTitle className="text-xl">Reset User Password</CardTitle>
        </div>
        <CardDescription>
          Send a password reset email to the user. They will receive a secure link to create a new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">User Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="user@qccgh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || !!userEmail}
              required
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {message && (
            <Alert className="border-green-200 bg-green-50">
              <Mail className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{message}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !email.trim()} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Reset Email
                </>
              )}
            </Button>

            {onClose && (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> User passwords are securely stored in Supabase Auth and cannot be viewed directly.
            This reset function sends a secure email link that allows users to create a new password.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
