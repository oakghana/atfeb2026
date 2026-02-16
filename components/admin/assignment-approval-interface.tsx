'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, XCircle, MapPin, User, Calendar, FileText, Send } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'

interface AssignmentRequest {
  id: string
  user_id: string
  staff_name: string
  location: string
  reason: string
  status: 'pending_approval' | 'approved' | 'rejected'
  requested_at: string
}

interface AssignmentApprovalProps {
  requests: AssignmentRequest[]
  onApprovalChange?: () => void
}

export function AssignmentApprovalInterface({ requests, onApprovalChange }: AssignmentApprovalProps) {
  const [selectedRequest, setSelectedRequest] = useState<AssignmentRequest | null>(null)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [approvalComments, setApprovalComments] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null)

  const pendingRequests = requests.filter((r) => r.status === 'pending_approval')

  const handleApprovalClick = (request: AssignmentRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request)
    setApprovalAction(action)
    setApprovalComments('')
    setApprovalDialogOpen(true)
  }

  const handleSubmitApproval = async () => {
    if (!selectedRequest) return

    setIsApproving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: 'Error',
          description: 'User not authenticated',
          variant: 'destructive',
        })
        return
      }

      // Process approval - in production, this would update database
      const approvalData = {
        assignment_id: selectedRequest.id,
        user_id: selectedRequest.user_id,
        approver_id: user.id,
        action: approvalAction,
        comments: approvalComments,
        timestamp: new Date().toISOString(),
      }

      console.log('[v0] Approval decision:', approvalData)

      if (approvalAction === 'approve') {
        toast({
          title: 'Assignment Approved',
          description: `${selectedRequest.staff_name}'s off-location assignment has been approved. Auto-check-in will be triggered.`,
        })
      } else {
        toast({
          title: 'Assignment Rejected',
          description: `${selectedRequest.staff_name}'s off-location assignment has been rejected.`,
        })
      }

      setApprovalDialogOpen(false)
      setSelectedRequest(null)
      setApprovalAction(null)
      onApprovalChange?.()
    } catch (error) {
      console.error('[v0] Approval error:', error)
      toast({
        title: 'Error',
        description: 'Failed to process approval',
        variant: 'destructive',
      })
    } finally {
      setIsApproving(false)
    }
  }

  if (pendingRequests.length === 0) {
    return (
      <Card className="bg-slate-50">
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground text-sm">No pending assignment requests</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Pending Assignment Requests ({pendingRequests.length})
          </CardTitle>
          <CardDescription>Review and approve staff off-location work assignments</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingRequests.map((request) => (
            <Card key={request.id} className="border-l-4 border-l-amber-500">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <p className="font-semibold">{request.staff_name}</p>
                        <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                          Pending
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.requested_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Assignment Location</p>
                        <p className="font-medium">{request.location}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Reason</p>
                      <p className="text-sm whitespace-pre-wrap">{request.reason}</p>
                    </div>
                  </div>

                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertDescription className="text-blue-900 text-xs">
                      If approved, staff will be auto-checked in at their registered location and marked as "on assignment".
                    </AlertDescription>
                  </Alert>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => handleApprovalClick(request, 'approve')}
                      disabled={isApproving}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-2 text-red-600 hover:text-red-700"
                      onClick={() => handleApprovalClick(request, 'reject')}
                      disabled={isApproving}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest?.staff_name} - {selectedRequest?.location}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className={approvalAction === 'approve' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
              <AlertDescription
                className={approvalAction === 'approve' ? 'text-green-900' : 'text-red-900'}
              >
                {approvalAction === 'approve'
                  ? 'The staff member will be auto-checked in at their assigned location and marked as "on assignment".'
                  : 'The staff member will be notified about the rejection.'}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="comments" className="text-sm font-medium">
                Comments (Optional)
              </Label>
              <Textarea
                id="comments"
                placeholder="Add comments for the staff member..."
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                disabled={isApproving}
                rows={3}
                className="text-sm"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setApprovalDialogOpen(false)}
                disabled={isApproving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitApproval}
                disabled={isApproving}
                className={`flex-1 gap-2 ${
                  approvalAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <Send className="h-4 w-4" />
                {isApproving
                  ? 'Processing...'
                  : approvalAction === 'approve'
                    ? 'Approve & Auto-Checkin'
                    : 'Reject'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
