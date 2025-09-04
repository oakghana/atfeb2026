import { AuditLogsClient } from "@/components/admin/audit-logs-client"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"

export default function AuditLogsPage() {
  return (
    <DashboardLayout>
      <AuditLogsClient />
    </DashboardLayout>
  )
}
