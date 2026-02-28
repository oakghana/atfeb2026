"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  FileText,
  Calendar,
  Eye,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Archive,
  UserCheck,
} from "lucide-react"

interface ExcuseDocument {
  id: string
  document_name: string
  document_type: string
  file_url: string
  excuse_reason: string
  excuse_date: string
  hod_status: string
  hod_reviewed_by: string
  hod_reviewed_at: string
  hod_review_notes: string
  hr_status: string
  hr_reviewed_by: string
  hr_reviewed_at: string
  hr_review_notes: string
  final_status: string
  created_at: string
  user_profiles: {
    first_name: string
    last_name: string
    employee_id: string
    department_id: string
    departments: {
      name: string
      code: string
    }
  }
  hod_reviewer?: {
    first_name: string
    last_name: string
  }
}

export function HRExcuseDutyClient() {
  const [excuseDocuments, setExcuseDocuments] = useState<ExcuseDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDoc, setSelectedDoc] = useState<ExcuseDocument | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [hrAction, setHrAction] = useState<"approved" | "rejected" | "archived">("approved")
  const [hrNotes, setHrNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState("hr_review")
  const [docTypeFilter, setDocTypeFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string | null>(null)
  const [dateTo, setDateTo] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(50)
  const [hasMore, setHasMore] = useState<boolean>(false)

  const fetchExcuseDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== "all") {
        params.append("final_status", statusFilter)
      }
      if (docTypeFilter !== "all") params.append("document_type", docTypeFilter)
      if (dateFrom) params.append("date_from", dateFrom)
      if (dateTo) params.append("date_to", dateTo)
      params.append("page", String(page))
      params.append("per_page", String(perPage))

      const response = await fetch(`/api/admin/hr-excuse-duty?${params.toString()}`)

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        console.error("HR excuse documents fetch failed:", response.status, text)
        throw new Error(`Failed to fetch excuse documents: ${response.status} ${text}`)
      }

      const data = await response.json()
      setExcuseDocuments(data.excuseDocuments || [])
      setHasMore(Boolean(data.pagination && data.pagination.hasMore))
    } catch (error) {
      console.error("Failed to fetch excuse documents:", error)
      setError("Failed to load excuse documents")
    } finally {
      setLoading(false)
    }
  }, [statusFilter, docTypeFilter, dateFrom, dateTo, page, perPage])

  useEffect(() => {
    // Reset to first page when filters change
    setPage(1)
  }, [statusFilter, docTypeFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchExcuseDocuments()
  }, [fetchExcuseDocuments])

  const handleHRReview = async () => {
    if (!selectedDoc) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/admin/hr-excuse-duty", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId: selectedDoc.id,
          hrStatus: hrAction,
          hrNotes: hrNotes.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to process document")
      }

      await fetchExcuseDocuments()

      setReviewDialogOpen(false)
      setSelectedDoc(null)
      setHrNotes("")
      setHrAction("approved")
    } catch (error) {
      console.error("HR review error:", error)
      setError(error instanceof Error ? error.message : "Failed to process document")
    } finally {
      setSubmitting(false)
    }
  }

  const openReviewDialog = useCallback((doc: ExcuseDocument) => {
    setSelectedDoc(doc)
    setHrAction("approved")
    setHrNotes("")
    setReviewDialogOpen(true)
  }, [])

  const getStatusBadge = useCallback((status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        )
      case "archived":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        )
      case "hr_review":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <UserCheck className="h-3 w-3 mr-1" />
            Awaiting HR
          </Badge>
        )
      case "hod_review":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            HOD Review
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }, [])

  const getDocumentTypeBadge = useCallback((type: string) => {
    const colors = {
      medical: "bg-blue-100 text-blue-800 border-blue-200",
      emergency: "bg-red-100 text-red-800 border-red-200",
      personal: "bg-purple-100 text-purple-800 border-purple-200",
      official: "bg-green-100 text-green-800 border-green-200",
    }

    return (
      <Badge className={colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200"}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    )
  }, [])

  const viewDocument = useCallback((fileUrl: string) => {
    // If it's a base64 data URL, convert to Blob for better PDF rendering
    if (fileUrl.startsWith("data:")) {
      try {
        // Extract the base64 data and mime type
        const [header, base64Data] = fileUrl.split(",")
        const mimeType = header.match(/:(.*?);/)?.[1] || "application/pdf"
        
        // Convert base64 to binary
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        
        // Create Blob and object URL
        const blob = new Blob([bytes], { type: mimeType })
        const objectUrl = URL.createObjectURL(blob)
        
        // Open in new window
        window.open(objectUrl, "_blank", "width=800,height=600,scrollbars=yes,resizable=yes")
        
        // Clean up object URL after 1 minute
        setTimeout(() => {
          URL.revokeObjectURL(objectUrl)
        }, 60000)
      } catch (error) {
        console.error("[v0] Error converting base64 to Blob:", error)
        // Fallback to direct open
        window.open(fileUrl, "_blank", "width=800,height=600,scrollbars=yes,resizable=yes")
      }
    } else {
      // Regular URL, open directly
      window.open(fileUrl, "_blank", "width=800,height=600,scrollbars=yes,resizable=yes")
    }
  }, [])

  const { pendingCount, approvedCount, archivedCount } = useMemo(() => {
    return {
      pendingCount: excuseDocuments.filter((doc) => doc.final_status === "hr_review").length,
      approvedCount: excuseDocuments.filter((doc) => doc.hr_status === "approved").length,
      archivedCount: excuseDocuments.filter((doc) => doc.hr_status === "archived").length,
    }
  }, [excuseDocuments])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading excuse documents...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting HR Review</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Approved by HOD, needs HR processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">HR Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Fully processed and approved</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Archived</CardTitle>
            <Archive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{archivedCount}</div>
            <p className="text-xs text-muted-foreground">Archived for records</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Excuse Duty Requests
              </CardTitle>
              <CardDescription>Process excuse duty requests approved by department heads</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Requests</SelectItem>
                  <SelectItem value="hr_review">Awaiting HR Review</SelectItem>
                  <SelectItem value="approved">HR Approved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
                <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="official">Official</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom ?? ""}
                    onChange={(e) => setDateFrom(e.target.value || null)}
                    className="input input-sm"
                    title="From"
                  />
                  <input
                    type="date"
                    value={dateTo ?? ""}
                    onChange={(e) => setDateTo(e.target.value || null)}
                    className="input input-sm"
                    title="To"
                  />
                </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {excuseDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {statusFilter === "all"
                  ? "No excuse duty requests found"
                  : "No requests found matching the selected filter"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>HOD Approval</TableHead>
                    <TableHead>HR Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excuseDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {doc.user_profiles.first_name} {doc.user_profiles.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">{doc.user_profiles.employee_id}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{doc.user_profiles.departments.name}</div>
                          <div className="text-sm text-muted-foreground">{doc.user_profiles.departments.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(doc.excuse_date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>{getDocumentTypeBadge(doc.document_type)}</TableCell>
                      <TableCell>
                        <div>
                          {getStatusBadge(doc.hod_status)}
                          {doc.hod_reviewer && (
                            <div className="text-xs text-muted-foreground mt-1">
                              By: {doc.hod_reviewer.first_name} {doc.hod_reviewer.last_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(doc.hr_status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => viewDocument(doc.file_url)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          {doc.final_status === "hr_review" && (
                            <Button size="sm" onClick={() => openReviewDialog(doc)} className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Process
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      Previous
                    </Button>
                    <div className="text-sm text-muted-foreground">Page {page}</div>
                    <Button size="sm" onClick={() => hasMore && setPage((p) => p + 1)} disabled={!hasMore}>
                      Next
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">Per page:</div>
                    <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                      <SelectTrigger className="w-[80px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>HR Processing - Excuse Duty Request</DialogTitle>
            <DialogDescription>Review and process this excuse duty request approved by the HOD</DialogDescription>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Staff Member</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedDoc.user_profiles.first_name} {selectedDoc.user_profiles.last_name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Department</label>
                  <p className="text-sm text-muted-foreground">{selectedDoc.user_profiles.departments.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Date of Absence</label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedDoc.excuse_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Document Type</label>
                  <div className="mt-1">{getDocumentTypeBadge(selectedDoc.document_type)}</div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Reason for Absence</label>
                <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted rounded-lg">
                  {selectedDoc.excuse_reason}
                </p>
              </div>

              {selectedDoc.hod_review_notes && (
                <div>
                  <label className="text-sm font-medium">HOD Review Notes</label>
                  <p className="text-sm text-muted-foreground mt-1 p-3 bg-blue-50 rounded-lg">
                    {selectedDoc.hod_review_notes}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">HR Action</label>
                <Select
                  value={hrAction}
                  onValueChange={(value: "approved" | "rejected" | "archived") => setHrAction(value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approve & Process</SelectItem>
                    <SelectItem value="archived">Archive for Records</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">HR Notes (Optional)</label>
                <Textarea
                  placeholder="Add any HR processing notes or comments..."
                  value={hrNotes}
                  onChange={(e) => setHrNotes(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleHRReview} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `${hrAction === "approved" ? "Approve" : hrAction === "archived" ? "Archive" : "Reject"}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
