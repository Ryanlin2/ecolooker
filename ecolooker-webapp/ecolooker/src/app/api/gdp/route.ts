import { NextResponse } from "next/server";

import { getUsIndustryGdpReport } from "@/lib/gdp-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getUsIndustryGdpReport();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load GDP report",
      },
      { status: 502 }
    );
  }
}
