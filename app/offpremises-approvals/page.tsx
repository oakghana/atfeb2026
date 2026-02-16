'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { PendingOffPremisesRequests } from '@/components/admin/pending-offpremises-requests'

const fetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
})

export default function OffPremisesApprovalPage() {
  const router = useRouter()
  const { data: userProfile, isLoading, error } = useSWR('/api/user/profile', fetcher)

  useEffect(() => {
    // Check if user is a manager/department head
    if (userProfile && !['admin', 'department_head', 'regional_manager'].includes(userProfile.role)) {
      router.push('/dashboard/attendance')
    }
  }, [userProfile, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load dashboard. Please try again later.</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (userProfile && !['admin', 'department_head', 'regional_manager'].includes(userProfile.role)) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view this dashboard. Only managers, department heads, and admins can review off-premises check-in requests.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Off-Premises Check-In Approvals
            </h1>
            <p className="text-muted-foreground">
              Review and approve staff members requesting to check in from outside their registered QCC location
            </p>
          </div>
        </div>

        {/* Information Card */}
        <Card className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-lg">How This Works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-blue-900 dark:text-blue-100">
            <p>
              When staff members need to check in from outside their registered QCC location (after 3 PM), they can request approval through the "Check In Outside Premises" button.
            </p>
            <p>
              As a manager or department head, you will see their current location and can confirm whether you sent them on official duty outside their premises. Approved requests will automatically check them in to their assigned location with an "on official duty" flag.
            </p>
          </CardContent>
        </Card>

        {/* Pending Requests Component */}
        <PendingOffPremisesRequests />

        {/* Instructions Card */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Instructions for Managers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <h4 className="font-semibold mb-1">Before Approving:</h4>
              <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                <li>Verify the staff member was sent by you on official duty</li>
                <li>Check their current location matches where you sent them</li>
                <li>Confirm they cannot reach their registered QCC location to check in normally</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1">What Happens When Approved:</h4>
              <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                <li>Staff member is automatically checked into their assigned QCC location</li>
                <li>Their actual location is recorded for audit purposes</li>
                <li>Attendance record is marked "On Official Duty Outside Premises"</li>
                <li>They receive a confirmation notification</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-1">What Happens When Rejected:</h4>
              <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                <li>Request is marked as rejected</li>
                <li>Staff member is notified and cannot check in from that location</li>
                <li>They can submit a new request if circumstances change</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
