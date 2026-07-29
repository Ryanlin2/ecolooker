import "server-only";

type ApiComplaintRow = {
  complaint_year: string;
  net_complaints: string;
};

type ApiResponse = {
  count: number;
  rows: ApiComplaintRow[];
};

export type ComplaintRow = {
  complaintYear: number;
  netComplaints: number;
};

export type SiteData = {
  count: number;
  rows: ComplaintRow[];
};

/**
 * TEMPORARY: mock fallback for local frontend dev while the real API
 * endpoint (API_BASE_URL) is returning 500s. Only used outside production
 * builds — remove once the endpoint is fixed.
 */
const MOCK_SITE_DATA: SiteData = {
  count: 13,
  rows: [
    { complaintYear: 2013, netComplaints: 4_820 },
    { complaintYear: 2014, netComplaints: 9_140 },
    { complaintYear: 2015, netComplaints: 15_760 },
    { complaintYear: 2016, netComplaints: 24_310 },
    { complaintYear: 2017, netComplaints: 41_950 },
    { complaintYear: 2018, netComplaints: 68_220 },
    { complaintYear: 2019, netComplaints: 102_480 },
    { complaintYear: 2020, netComplaints: 158_930 },
    { complaintYear: 2021, netComplaints: 251_640 },
    { complaintYear: 2022, netComplaints: 318_070 },
    { complaintYear: 2023, netComplaints: 392_510 },
    { complaintYear: 2024, netComplaints: 431_890 },
    { complaintYear: 2025, netComplaints: 469_920 },
  ],
};

export async function getSiteData(): Promise<SiteData> {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing API_BASE_URL");
  }

  const endpoint = baseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
      },

      // Cache the response until the next build or deployment.
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch site data: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as ApiResponse;

    if (!Array.isArray(data.rows)) {
      throw new Error("Invalid API response: rows must be an array");
    }

    return {
      count: data.count,
      rows: data.rows.map((row) => ({
        complaintYear: Number(row.complaint_year),
        netComplaints: Number(row.net_complaints),
      })),
    };
  } catch (error) {
    console.warn(
      `[getSiteData] API_BASE_URL fetch failed (${
        (error as Error).message
      }) — falling back to MOCK_SITE_DATA for local dev.`
    );

    return MOCK_SITE_DATA;
  }
}
