'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { MapPin, User, Clock, AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PendingRequest {
  id: string
  user_id: string
  current_location_name: string
  latitude: number
  longitude: number
  accuracy: number
  device_info: string
  created_at: string
  status: string
  user_profiles: {
    id: string
    first_name: string
    last_name: string
    email: string
    department_id: string
  }
}

interface OffPremisesRequestModalProps {
  isOpen: boolean
  onClose: () => void
  request: PendingRequest
  onApprovalComplete: () => void
}

export function OffPremisesRequestModal({
  isOpen,
  onClose,
  request,
  onApprovalComplete,
}: OffPremisesRequestModalProps) {
  const [isApproving, setIsApproving] = useState(false)
  const [approvalComments, setApprovalComments] = useState('')
  const { toast } = useToast()

  const handleApprove = async (approved: boolean) => {
    if (isApproving) return

    setIsApproving(true)
    try {
      const response = await fetch('/api/attendance/offpremises/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: request.id,
          approved,
          comments: approvalComments,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process request')
      }

      toast({
        title: approved ? 'Request Approved' : 'Request Rejected',
        description: approved
          ? `${request.user_profiles.first_name} has been checked in to their assigned location and marked as on official duty outside premises.`
          : `The off-premises check-in request has been rejected.`,
        action: <div>OK</div>,
      })

      onApprovalComplete()
      onClose()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process the request',
        variant: 'destructive',
      })
    } finally {
      setIsApproving(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const mapUrl = `https://www.google.com/maps?q=${request.latitude},${request.longitude}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Review Off-Premises Check-In Request
          </DialogTitle>
          <DialogDescription>
            Staff member is requesting to check in from outside their assigned QCC location
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Staff Member Information */}
          <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
            <h3 className="font-semibold mb-3 text-sm text-gray-700 dark:text-gray-300">
              Staff Member Information
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="font-medium">
                    {request.user_profiles.first_name} {request.user_profiles.last_name}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400">{request.user_profiles.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>Request Time: {formatDate(request.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Current Location Information */}
          <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
            <h3 className="font-semibold mb-3 text-sm text-blue-900 dark:text-blue-300">
              Current Location
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    {request.current_location_name}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Latitude: {request.latitude.toFixed(6)}
                    <br />
                    Longitude: {request.longitude.toFixed(6)}
                    <br />
                    GPS Accuracy: ±{request.accuracy.toFixed(0)}m
                  </p>
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline dark:text-blue-400 mt-2 inline-block"
                  >
                    View on Google Maps →
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Questions */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Before You Approve</AlertTitle>
            <AlertDescription>
              <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
                <li>Did you send this staff member to this location on official duty?</li>
                <li>Are they unable to come to their registered QCC location to check in?</li>
                <li>Should they be marked as on official duty outside their premises today?</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Comments Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Approval Comments (Optional)
            </label>
            <Textarea
              placeholder="Add comments about your approval/rejection decision..."
              value={approvalComments}
              onChange={(e) => setApprovalComments(e.target.value)}
              className="min-h-20"
            />
          </div>

          {/* Information Message */}
          <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900/50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900 dark:text-green-300">What Happens If Approved</AlertTitle>
            <AlertDescription className="text-green-800 dark:text-green-400 text-sm mt-1">
              The staff member will be automatically checked in to their assigned QCC location and marked as working on official duty outside premises. Their actual location will be recorded for audit purposes.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-2 justify-end pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isApproving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleApprove(false)}
            disabled={isApproving}
            className="gap-2"
          >
            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject Request
          </Button>
          <Button
            onClick={() => handleApprove(true)}
            disabled={isApproving}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve & Check In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
