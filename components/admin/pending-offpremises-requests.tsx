'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, MapPin, Clock, User, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { OffPremisesRequestModal } from './offpremises-request-modal'

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

export function PendingOffPremisesRequests() {
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [managerProfile, setManagerProfile] = useState<any>(null)

  // Load pending requests
  const loadPendingRequests = async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('[v0] Loading pending requests...')

      // Use the API endpoint instead of direct Supabase query
      const response = await fetch('/api/attendance/offpremises/pending')
      console.log('[v0] Pending API response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || `Failed to load requests (${response.status})`
        console.error('[v0] Pending API error:', errorMessage)
        setError(errorMessage)
        return
      }

      const data = await response.json()
      console.log('[v0] Pending requests loaded:', data.requests?.length || 0, 'requests')
      console.log('[v0] First request:', data.requests?.[0])

      if (data.profile) {
        console.log('[v0] User profile role:', data.profile.role)
        setManagerProfile(data.profile)
      }

      setRequests(data.requests || [])
    } catch (err: any) {
      console.error('[v0] Exception in loadPendingRequests:', err)
      setError(err.message || 'An error occurred while loading requests')
    } finally {
      setIsLoading(false)
    }
  }

  // Load requests on mount and set up polling
  useEffect(() => {
    loadPendingRequests()

    // Poll every 5 seconds for new requests
    const interval = setInterval(loadPendingRequests, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleRequestClick = (request: PendingRequest) => {
    setSelectedRequest(request)
    setIsModalOpen(true)
  }

  const handleApprovalComplete = () => {
    setIsModalOpen(false)
    setSelectedRequest(null)
    loadPendingRequests() // Refresh the list
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Off-Premises Check-In Requests</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2">Loading requests...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    // Check if error is due to missing table
    const isMissingTable = error.includes("Could not find the table 'public.pending_offpremises_checkins'") || 
                           error.includes("pending_offpremises_checkins")
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Off-Premises Check-In Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Requests</AlertTitle>
            <AlertDescription>
              {isMissingTable ? (
                <div>
                  <p>The database table for off-premises requests needs to be created.</p>
                  <p className="mt-2 text-sm">Please run this SQL in your Supabase SQL Editor:</p>
                  <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs overflow-auto rounded">
{`CREATE TABLE IF NOT EXISTS public.pending_offpremises_checkins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  current_location_name TEXT NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  accuracy FLOAT8,
  device_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pending_offpremises_user_id ON public.pending_offpremises_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_status ON public.pending_offpremises_checkins(status);
CREATE INDEX IF NOT EXISTS idx_pending_offpremises_created_at ON public.pending_offpremises_checkins(created_at DESC);`}
                  </pre>
                  <p className="mt-2 text-sm">After creating the table, click Retry below.</p>
                </div>
              ) : (
                error
              )}
            </AlertDescription>
          </Alert>
          <Button onClick={loadPendingRequests} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Pending Off-Premises Check-In Requests</CardTitle>
              <CardDescription>
                {managerProfile?.role === 'admin' && 'Review and approve staff off-premises check-ins from all locations and departments'}
                {managerProfile?.role === 'regional_manager' && 'Review and approve staff off-premises check-ins from your assigned location'}
                {managerProfile?.role === 'department_head' && `Review and approve staff off-premises check-ins from ${managerProfile?.department_id || 'your department'}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={loadPendingRequests}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Loader2 className="h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <a href="/offpremises-review">
                  <CheckCircle2 className="h-4 w-4" />
                  View Approved
                </a>
              </Button>
              <div className="text-right">
                <Badge variant="outline" className="mb-2 block">
                  {managerProfile?.role === 'admin' && '👤 Admin - All Access'}
                  {managerProfile?.role === 'regional_manager' && '📍 Regional Manager'}
                  {managerProfile?.role === 'department_head' && '🏢 Department Head'}
                </Badge>
                <Badge variant={requests.length > 0 ? 'default' : 'secondary'} className="text-lg">
                  {requests.length} Pending
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle2 className="mx-auto h-12 w-12 mb-3 text-green-600" />
              <p>No pending requests at this time.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer transition-colors"
                  onClick={() => handleRequestClick(request)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">
                          {request.user_profiles.first_name} {request.user_profiles.last_name}
                        </h3>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          Pending
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{request.user_profiles.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>Requested: {formatDate(request.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">Department:</span>
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {request.user_profiles?.departments?.name || request.user_profiles?.department_id || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 md:col-span-2">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-700 dark:text-gray-300">{request.current_location_name}</p>
                            <p className="text-xs">
                              {request.latitude.toFixed(4)}, {request.longitude.toFixed(4)} (±{request.accuracy}m)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-4 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRequestClick(request)
                      }}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRequest && (
        <OffPremisesRequestModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedRequest(null)
          }}
          request={selectedRequest}
          onApprovalComplete={handleApprovalComplete}
        />
      )}
    </>
  )
}
