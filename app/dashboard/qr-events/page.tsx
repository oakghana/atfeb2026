import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { QREventsClient } from "@/components/qr/qr-events-client"

export default function QREventsPage() {
  return (
    <DashboardLayout>
      <QREventsClient />
    </DashboardLayout>
  )
}
