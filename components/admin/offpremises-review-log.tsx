'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertTriangle,
  MapPin,
  Clock,
  User,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  Navigation,
  Loader2,
  Download,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ApprovedRecord {
  id: string
  user_id: string
  check_in_time: string
  actual_location_name: string
  actual_latitude: number
  actual_longitude: number
  on_official_duty_outside_premises: boolean
  check_in_type: string
  device_info: string
  staff_name: string
  user_profiles: {
    id: string
    first_name: string
    last_name: string
    email: string
    department_id: string
  }
}

export function OffPremisesReviewLog() {
  const [records, setRecords] = useState<ApprovedRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [managerProfile, setManagerProfile] = useState<any>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [totalRecords, setTotalRecords] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageSize] = useState(20)

  console.log('[v0] OffPremisesReviewLog component mounted')

  // Load approved off-premises check-ins
  const loadApprovedRecords = async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('[v0] Starting loadApprovedRecords')

      const supabase = createClient()

      // Get current user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      console.log('[v0] Auth result:', { hasUser: !!authUser, authError: authError?.message })

      if (authError || !authUser) {
        console.error('[v0] Auth error:', authError)
        setError('Authentication error - please log in again')
        return
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, role, department_id')
        .eq('id', authUser.id)
        .maybeSingle()

      console.log('[v0] Profile result:', { hasProfile: !!profile, role: profile?.role })

      if (profileError || !profile) {
        console.error('[v0] Profile error:', profileError)
        setError('Failed to fetch user profile')
        return
      }

      setManagerProfile(profile)
      setDepartmentId(profile.department_id)

      // Build query based on role - department heads see only their department, admins see all
      let query = supabase
        .from('pending_offpremises_checkins')
        .select(`
          id,
          user_id,
          current_location_name,
          google_maps_name,
          latitude,
          longitude,
          created_at,
          approved_at,
          status,
          user_profiles!pending_offpremises_checkins_user_id_fkey (
            id,
            first_name,
            last_name,
            email,
            department_id
          ),
          approved_by:approved_by_id (
            id,
            first_name,
            last_name
          )
        `,
          { count: 'exact' }
        )
        .eq('status', 'approved')
        .order('approved_at', { ascending: false })

      // Filter by department if department_head
      if (profile.role === 'department_head') {
        query = query.eq('user_profiles.department_id', profile.department_id)
      }

      // Add pagination
      const { data: requestRecords, error: fetchError, count } = await query.range(
        currentPage * pageSize,
        (currentPage + 1) * pageSize - 1
      )

      console.log('[v0] Fetch result:', { count, recordCount: requestRecords?.length || 0, error: fetchError?.message })

      if (fetchError) {
        console.error('[v0] Fetch error:', fetchError)
        setError('Failed to fetch approved records')
        return
      }

      setRecords(requestRecords || [])
      setTotalRecords(count || 0)
    } catch (err: any) {
      console.error('[v0] Unexpected error:', err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadApprovedRecords()
  }, [currentPage])

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const formatCoordinates = (lat: number, lon: number) => {
    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`
  }

  const handleExportCSV = () => {
    if (records.length === 0) {
      alert('No records to export')
      return
    }

    const csv = [
      ['Staff Name', 'Email', 'Location Name', 'Coordinates', 'Check-In Time', 'Approved By'].join(','),
      ...records.map((record) =>
        [
          `"${record.user_profiles?.first_name} ${record.user_profiles?.last_name}"`,
          record.user_profiles?.email,
          `"${record.current_location_name}"`,
          formatCoordinates(record.latitude, record.longitude),
          formatDate(record.approved_at || record.created_at),
          `"${record.approved_by?.first_name} ${record.approved_by?.last_name}"`,
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `off-premises-review-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading approved records...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <h1 className="text-3xl font-bold">Off-Premises Review Log</h1>
              </div>
              <p className="text-gray-600 ml-9">
                View all approved off-premises check-ins and staff location records
              </p>
            </div>
            <Button
              onClick={handleExportCSV}
              disabled={records.length === 0}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        {!error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total Approved</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalRecords}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Current Page</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{records.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600">Total Pages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.ceil(totalRecords / pageSize)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Approved Off-Premises Records</CardTitle>
            <CardDescription>
              Showing {records.length} of {totalRecords} total records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-600 text-lg font-medium">No approved records found</p>
                <p className="text-gray-500 mt-2">Off-premises check-ins will appear here once approved</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Coordinates</TableHead>
                      <TableHead>Approved Date</TableHead>
                      <TableHead>Approved By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id} className="hover:bg-gray-50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {record.user_profiles?.first_name} {record.user_profiles?.last_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {record.user_profiles?.email}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium">{record.current_location_name}</p>
                              {record.google_maps_name && record.google_maps_name !== record.current_location_name && (
                                <p className="text-gray-500 text-xs">{record.google_maps_name}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <Navigation className="h-4 w-4 text-blue-500" />
                            <span className="font-mono text-xs">
                              {formatCoordinates(record.latitude, record.longitude)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {formatDate(record.approved_at || record.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.approved_by?.first_name && record.approved_by?.last_name ? (
                            <Badge variant="outline">
                              {record.approved_by.first_name} {record.approved_by.last_name}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {totalRecords > pageSize && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <p className="text-sm text-gray-600">
                  Page {currentPage + 1} of {Math.ceil(totalRecords / pageSize)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage(Math.min(Math.ceil(totalRecords / pageSize) - 1, currentPage + 1))
                    }
                    disabled={currentPage >= Math.ceil(totalRecords / pageSize) - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
