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

export async function getSiteData(): Promise<SiteData> {
  const baseUrl = process.env.API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing API_BASE_URL");
  }

  const endpoint = baseUrl.replace(/\/$/, "");

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
}
