import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { UserApprovalsClient } from "@/components/admin/user-approvals-client"

export default function UserApprovalsPage() {
  return (
    <DashboardLayout>
      <UserApprovalsClient />
    </DashboardLayout>
  )
}
