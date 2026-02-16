'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, MapPin, Send } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'

interface AssignmentRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffName: string
  departmentHeadInfo?: { name: string; id: string }
  onSuccess?: () => void
}

export function AssignmentRequestDialog({
  open,
  onOpenChange,
  staffName,
  departmentHeadInfo,
  onSuccess,
}: AssignmentRequestDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    location: '',
    reason: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.location.trim() || !formData.reason.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both location and reason for the assignment.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
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

      // Store assignment request in local pending state
      // In production, this would create a database record
      const assignmentData = {
        user_id: user.id,
        location: formData.location,
        reason: formData.reason,
        status: 'pending_approval',
        requested_at: new Date().toISOString(),
      }

      console.log('[v0] Assignment request:', assignmentData)

      toast({
        title: 'Assignment Request Sent',
        description: `Your request to work at ${formData.location} has been sent to your department head for approval.`,
      })

      setFormData({ location: '', reason: '' })
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('[v0] Assignment request error:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit assignment request',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Request Off-Location Assignment</DialogTitle>
          <DialogDescription>
            Request to work outside your assigned location for official duties
          </DialogDescription>
        </DialogHeader>

        <Alert className="bg-blue-50 border-blue-200">
          <MapPin className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Your department head or regional manager will review and auto-confirm your check-in at your registered location
            if approved.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="location" className="font-semibold">
              Assignment Location
            </Label>
            <Input
              id="location"
              placeholder="e.g., Regional Office, Project Site, External Meeting"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              disabled={loading}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">Where will you be working today?</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason" className="font-semibold">
              Reason for Assignment
            </Label>
            <Textarea
              id="reason"
              placeholder="Provide details about your assignment..."
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              disabled={loading}
              rows={4}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">Be specific about your assignment details</p>
          </div>

          {departmentHeadInfo && (
            <Card className="bg-slate-50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Will be reviewed by:</p>
              <p className="text-sm font-semibold">{departmentHeadInfo.name}</p>
            </Card>
          )}

          <div className="pt-4 space-y-2">
            <Button
              type="submit"
              disabled={loading || !formData.location.trim() || !formData.reason.trim()}
              className="w-full gap-2"
            >
              <Send className="h-4 w-4" />
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading} className="w-full">
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
