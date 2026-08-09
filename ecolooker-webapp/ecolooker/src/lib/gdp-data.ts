import "server-only";
import { cache } from "react";

import {
  generatedAt,
  quarter,
  nationalGdpMillions,
  nationalQoqPctChange,
  nationalYoyPctChange,
  states,
  industries,
} from "./gdp-seed-data";
import type { StateGdpRow, IndustryGdpRow } from "./gdp-seed-data";

export type { StateGdpRow, IndustryGdpRow };

export type UsIndustryGdpReport = {
  generatedAt: string;
  quarter: string;
  nationalGdpMillions: number;
  nationalQoqPctChange: number;
  nationalYoyPctChange: number;
  states: StateGdpRow[];
  industries: IndustryGdpRow[];
};

/**
 * Data access for the US industry GDP dashboard.
 *
 * A live BEA SQGDP-backed endpoint isn't wired up yet (see `bea/sqgdp_data/`
 * for the exploratory notebook), so this reads from the seed dataset in
 * `gdp-seed-data.ts`, which mirrors the shape a live endpoint would return.
 * Swap the body of this function for a `fetch()` call once that endpoint
 * exists — see `cfpb-data.ts` for the live-fetch pattern to follow.
 */
export const getUsIndustryGdpReport = cache(
  async (): Promise<UsIndustryGdpReport> => ({
    generatedAt,
    quarter,
    nationalGdpMillions,
    nationalQoqPctChange,
    nationalYoyPctChange,
    states,
    industries,
  })
);
