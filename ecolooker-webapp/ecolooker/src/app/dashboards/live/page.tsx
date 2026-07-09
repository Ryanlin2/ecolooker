import { LiveDashboard } from "@/components/blocks/LiveDashboard";
import { ReportHeader } from "@/components/blocks/ReportHeader";

export default function LivePage() {
  return (
    <div>
      <ReportHeader
        title="Live Environmental Dashboard"
        subtitle="Streaming metrics from connected sensor networks."
        tags={["Live", "Realtime"]}
      />
      <LiveDashboard />
    </div>
  );
}
