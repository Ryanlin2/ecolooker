// src/app/dashboards/us-industry-gdp/page.tsx

import type { Metadata } from "next";
import { Suspense } from "react";

import { UsIndustryGdpClient } from "./UsIndustryGdpClient";
import { UsIndustryGdpSkeleton } from "./loading";

export const metadata: Metadata = {
  title: "United States Industry GDP Dashboard",
  description: "State-level real GDP and industry composition across the US economy.",
};

export default function UsIndustryGdpPage() {
  return (
    <Suspense fallback={<UsIndustryGdpSkeleton />}>
      <UsIndustryGdpClient />
    </Suspense>
  );
}
