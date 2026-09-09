// src/app/dashboards/cfpb-complaints/page.tsx

import type { Metadata } from "next";
import { Suspense } from "react";

import { CfpbComplaintsClient } from "./CfpbComplaintsClient";
import { CfpbComplaintsSkeleton } from "./loading";

export const metadata: Metadata = {
  title: "Consumer Financial Protection Bureau Anomaly Dashboard",
  description: "Complaint trends and anomaly detection dashboard.",
};

export default function CfpbComplaintsPage() {
  return (
    <Suspense fallback={<CfpbComplaintsSkeleton />}>
      <CfpbComplaintsClient />
    </Suspense>
  );
}
