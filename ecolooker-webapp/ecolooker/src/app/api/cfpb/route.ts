import { NextResponse } from "next/server";

import { getCfpbReport } from "@/lib/cfpb-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getCfpbReport();
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load CFPB report",
      },
      { status: 502 }
    );
  }
}
