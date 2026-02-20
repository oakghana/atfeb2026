"use client"

import { AlertCircle, CheckCircle, Clock, MapPin } from "lucide-react"
import { Card } from "@/components/ui/card"

interface OffPremisesRequestStatusProps {
  approvalStatus?: string | null
  reason?: string | null
  supervisorRemarks?: string | null
  onOfficialDuty?: boolean
  requestedAt?: string
}

export function OffPremisesRequestStatus({
  approvalStatus,
  reason,
  supervisorRemarks,
  onOfficialDuty,
  requestedAt,
}: OffPremisesRequestStatusProps) {
  // Only show if there's off-premises data
  if (!approvalStatus) return null

  const isPending = approvalStatus === "pending_supervisor_approval"
  const isApproved = approvalStatus === "approved_offpremises"
  const isRejected = approvalStatus === "rejected_offpremises"

  return (
    <Card className="p-4 mb-4 border-l-4" style={{
      borderLeftColor: isPending ? "#f59e0b" : isApproved ? "#10b981" : isRejected ? "#ef4444" : "#6b7280"
    }}>
      <div className="flex items-start gap-3">
        {isPending && <Clock className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />}
        {isApproved && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />}
        {isRejected && <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h4 className="font-semibold text-sm">
              {isPending && "Off-Premises Request Pending"}
              {isApproved && "Off-Premises Approved"}
              {isRejected && "Off-Premises Request Denied"}
            </h4>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
              isPending ? "bg-amber-100 text-amber-800" :
              isApproved ? "bg-green-100 text-green-800" :
              isRejected ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"
            }`}>
              {isPending && "Awaiting Approval"}
              {isApproved && "Approved"}
              {isRejected && "Rejected"}
            </span>
          </div>

          {reason && (
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-700">
                <span className="font-medium">Reason:</span> {reason}
              </div>
            </div>
          )}

          {supervisorRemarks && (
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded mt-2">
              <span className="font-medium text-gray-700">Supervisor Note:</span>
              <p className="mt-1">{supervisorRemarks}</p>
            </div>
          )}

          {requestedAt && (
            <p className="text-xs text-gray-500 mt-2">
              Requested: {new Date(requestedAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}
