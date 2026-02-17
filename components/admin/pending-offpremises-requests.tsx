'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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
    geofence_locations?: string[]
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
      console.log('[v0] Starting loadPendingRequests')

      const supabase = createClient()
      console.log('[v0] Supabase client created')

      // Get current user with better error handling
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      console.log('[v0] Auth result:', { hasUser: !!authUser, authError: authError?.message })

      if (authError) {
        console.error('[v0] Auth error:', authError)
        setError('Authentication error: ' + authError.message)
        return
      }

      if (!authUser) {
        console.log('[v0] No authenticated user found')
        setError('Unable to authenticate - please log in again')
        return
      }

      console.log('[v0] Authenticated user:', authUser.id)

      // Get user profile for filtering
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, role, department_id, geofence_locations')
        .eq('id', authUser.id)
        .maybeSingle()

      console.log('[v0] Profile result:', { hasProfile: !!profile, profileError: profileError?.message })

      if (profileError) {
        console.error('[v0] Profile error:', profileError)
        setError('Failed to fetch user profile: ' + profileError.message)
        return
      }

      if (!profile) {
        console.log('[v0] User profile not found')
        setError('User profile not found')
        return
      }

      console.log('[v0] User profile loaded:', profile.role)
      setManagerProfile(profile)

      // Build query based on role
      let query = supabase
        .from('pending_offpremises_checkins')
        .select(`
          id,
          user_id,
          current_location_name,
          latitude,
          longitude,
          accuracy,
          device_info,
          created_at,
          status,
          user_profiles!pending_offpremises_checkins_user_id_fkey (
            id,
            first_name,
            last_name,
            email,
            department_id,
            geofence_locations
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      // Apply role-based filtering
      if (profile.role === 'admin') {
        // Admins see all requests
      } else if (profile.role === 'regional_manager') {
        // Regional managers see requests from their location staff
        const { data: locationStaff, error: staffError } = await supabase
          .from('user_profiles')
          .select('id')
          .contains('geofence_locations', profile.geofence_locations || [])

        if (!staffError && locationStaff && locationStaff.length > 0) {
          const staffIds = locationStaff.map(s => s.id)
          query = query.in('user_id', staffIds)
        } else {
          setRequests([])
          setIsLoading(false)
          return
        }
      } else if (profile.role === 'department_head') {
        // Department heads see requests from their department
        query = query.eq('user_profiles.department_id', profile.department_id)
      }

      const { data: pendingRequests, error: queryError } = await query

      console.log('[v0] Query result:', { count: pendingRequests?.length || 0, queryError: queryError?.message })

      if (queryError) {
        console.error('[v0] Query error:', queryError)
        setError('Failed to fetch pending requests: ' + queryError.message)
        return
      }

      console.log('[v0] Requests loaded successfully:', pendingRequests?.length || 0)
      setRequests(pendingRequests || [])
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

    // Poll every 30 seconds
    const interval = setInterval(loadPendingRequests, 30000)

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
              {error}
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Off-Premises Check-In Requests</CardTitle>
              <CardDescription>
                Review and approve staff members requesting to check in from outside their registered QCC location
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg">
              {requests.length} Pending
            </Badge>
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
