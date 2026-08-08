/**
 * Seed data for the US industry GDP dashboard.
 *
 * A live BEA SQGDP2 (state GDP) / SQGDP9 (state GDP by industry) endpoint
 * isn't wired up yet, so this module generates representative data that
 * mirrors the shape a live endpoint would return — real GDP by state and by
 * industry, with quarter-over-quarter and year-over-year growth — for UI
 * development and demos. See `bea/sqgdp_data/` for the notebook exploring
 * the source BEA tables this is modeled on.
 */

export type StateGdpRow = {
  stateFips: string;
  state: string;
  stateName: string;
  gdpMillions: number;
  qoqPctChange: number;
  yoyPctChange: number;
  leadingIndustry: string;
};

export type IndustryGdpRow = {
  industry: string;
  gdpMillions: number;
  sharePct: number;
  qoqPctChange: number;
  yoyPctChange: number;
};

function makeRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Approximate relative economic size per state (illustrative, not sourced
// from BEA — just enough spread for the map/rankings to look realistic).
const STATES: { fips: string; code: string; name: string; weight: number }[] = [
  { fips: "06", code: "CA", name: "California", weight: 3900 },
  { fips: "48", code: "TX", name: "Texas", weight: 2400 },
  { fips: "36", code: "NY", name: "New York", weight: 2100 },
  { fips: "12", code: "FL", name: "Florida", weight: 1650 },
  { fips: "17", code: "IL", name: "Illinois", weight: 1050 },
  { fips: "42", code: "PA", name: "Pennsylvania", weight: 950 },
  { fips: "39", code: "OH", name: "Ohio", weight: 900 },
  { fips: "13", code: "GA", name: "Georgia", weight: 800 },
  { fips: "34", code: "NJ", name: "New Jersey", weight: 800 },
  { fips: "37", code: "NC", name: "North Carolina", weight: 750 },
  { fips: "53", code: "WA", name: "Washington", weight: 750 },
  { fips: "25", code: "MA", name: "Massachusetts", weight: 750 },
  { fips: "51", code: "VA", name: "Virginia", weight: 700 },
  { fips: "26", code: "MI", name: "Michigan", weight: 650 },
  { fips: "08", code: "CO", name: "Colorado", weight: 500 },
  { fips: "47", code: "TN", name: "Tennessee", weight: 500 },
  { fips: "04", code: "AZ", name: "Arizona", weight: 480 },
  { fips: "18", code: "IN", name: "Indiana", weight: 480 },
  { fips: "24", code: "MD", name: "Maryland", weight: 480 },
  { fips: "27", code: "MN", name: "Minnesota", weight: 470 },
  { fips: "55", code: "WI", name: "Wisconsin", weight: 420 },
  { fips: "29", code: "MO", name: "Missouri", weight: 400 },
  { fips: "09", code: "CT", name: "Connecticut", weight: 330 },
  { fips: "22", code: "LA", name: "Louisiana", weight: 320 },
  { fips: "41", code: "OR", name: "Oregon", weight: 320 },
  { fips: "45", code: "SC", name: "South Carolina", weight: 320 },
  { fips: "01", code: "AL", name: "Alabama", weight: 290 },
  { fips: "21", code: "KY", name: "Kentucky", weight: 270 },
  { fips: "40", code: "OK", name: "Oklahoma", weight: 260 },
  { fips: "19", code: "IA", name: "Iowa", weight: 250 },
  { fips: "49", code: "UT", name: "Utah", weight: 250 },
  { fips: "32", code: "NV", name: "Nevada", weight: 230 },
  { fips: "20", code: "KS", name: "Kansas", weight: 220 },
  { fips: "11", code: "DC", name: "District of Columbia", weight: 160 },
  { fips: "31", code: "NE", name: "Nebraska", weight: 160 },
  { fips: "05", code: "AR", name: "Arkansas", weight: 170 },
  { fips: "28", code: "MS", name: "Mississippi", weight: 150 },
  { fips: "35", code: "NM", name: "New Mexico", weight: 120 },
  { fips: "16", code: "ID", name: "Idaho", weight: 120 },
  { fips: "33", code: "NH", name: "New Hampshire", weight: 110 },
  { fips: "15", code: "HI", name: "Hawaii", weight: 100 },
  { fips: "54", code: "WV", name: "West Virginia", weight: 100 },
  { fips: "23", code: "ME", name: "Maine", weight: 90 },
  { fips: "10", code: "DE", name: "Delaware", weight: 90 },
  { fips: "30", code: "MT", name: "Montana", weight: 65 },
  { fips: "56", code: "WY", name: "Wyoming", weight: 50 },
  { fips: "38", code: "ND", name: "North Dakota", weight: 65 },
  { fips: "46", code: "SD", name: "South Dakota", weight: 65 },
  { fips: "02", code: "AK", name: "Alaska", weight: 65 },
  { fips: "44", code: "RI", name: "Rhode Island", weight: 75 },
  { fips: "50", code: "VT", name: "Vermont", weight: 40 },
];

const INDUSTRIES: { name: string; weight: number }[] = [
  { name: "Real estate and rental and leasing", weight: 13.0 },
  { name: "Government", weight: 12.5 },
  { name: "Manufacturing", weight: 11.0 },
  { name: "Professional, scientific, and technical services", weight: 8.5 },
  { name: "Finance and insurance", weight: 7.5 },
  { name: "Health care and social assistance", weight: 7.5 },
  { name: "Wholesale trade", weight: 5.9 },
  { name: "Retail trade", weight: 5.8 },
  { name: "Information", weight: 5.5 },
  { name: "Construction", weight: 4.3 },
  { name: "Transportation and warehousing", weight: 3.3 },
  { name: "Administrative and support services", weight: 3.0 },
  { name: "Accommodation and food services", weight: 3.0 },
  { name: "Other services (except government)", weight: 2.0 },
  { name: "Management of companies and enterprises", weight: 2.0 },
  { name: "Mining, quarrying, and oil and gas extraction", weight: 1.5 },
  { name: "Utilities", weight: 1.5 },
  { name: "Educational services", weight: 1.5 },
  { name: "Arts, entertainment, and recreation", weight: 1.2 },
  { name: "Agriculture, forestry, fishing and hunting", weight: 0.9 },
];

export const generatedAt = "2026-05-29T09:00:00Z";
export const quarter = "2026 Q1";

const NATIONAL_GDP_MILLIONS = 23_500_000; // ~$23.5T, illustrative

function generateIndustries(): IndustryGdpRow[] {
  const rand = makeRand(7);
  const totalWeight = INDUSTRIES.reduce((sum, i) => sum + i.weight, 0);

  return INDUSTRIES.map((industry) => {
    const gdpMillions = Math.round(
      (industry.weight / totalWeight) * NATIONAL_GDP_MILLIONS
    );
    const qoqPctChange = Math.round((rand() - 0.45) * 3 * 100) / 100;
    const yoyPctChange =
      Math.round((qoqPctChange * 4 + (rand() - 0.5) * 2) * 100) / 100;

    return {
      industry: industry.name,
      gdpMillions,
      sharePct: Math.round((gdpMillions / NATIONAL_GDP_MILLIONS) * 1000) / 10,
      qoqPctChange,
      yoyPctChange,
    };
  }).sort((a, b) => b.gdpMillions - a.gdpMillions);
}

export const industries = generateIndustries();

function generateStates(): StateGdpRow[] {
  const rand = makeRand(101);
  const totalWeight = STATES.reduce((sum, st) => sum + st.weight, 0);
  const industryNames = INDUSTRIES.map((i) => i.name);
  const industryWeights = INDUSTRIES.map((i) => i.weight);

  return STATES.map((st) => {
    const gdpMillions = Math.round(
      (st.weight / totalWeight) * NATIONAL_GDP_MILLIONS
    );
    const qoqPctChange = Math.round((rand() - 0.42) * 3.4 * 100) / 100;
    const yoyPctChange =
      Math.round((qoqPctChange * 4 + (rand() - 0.5) * 2.5) * 100) / 100;

    // Perturb the national industry mix per state and take the top pick, so
    // most states land on the same handful of dominant industries (as in
    // the real BEA data) with some state-to-state variation.
    let bestIndex = 0;
    let bestScore = -Infinity;
    industryWeights.forEach((weight, i) => {
      const score = weight * (1 + (rand() - 0.5) * 0.6);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    });

    return {
      stateFips: st.fips,
      state: st.code,
      stateName: st.name,
      gdpMillions,
      qoqPctChange,
      yoyPctChange,
      leadingIndustry: industryNames[bestIndex],
    };
  }).sort((a, b) => b.gdpMillions - a.gdpMillions);
}

export const states = generateStates();

export const nationalGdpMillions = states.reduce(
  (sum, s) => sum + s.gdpMillions,
  0
);

export const nationalQoqPctChange =
  Math.round(
    (states.reduce((sum, s) => sum + s.qoqPctChange * s.gdpMillions, 0) /
      nationalGdpMillions) *
      100
  ) / 100;

export const nationalYoyPctChange =
  Math.round(
    (states.reduce((sum, s) => sum + s.yoyPctChange * s.gdpMillions, 0) /
      nationalGdpMillions) *
      100
  ) / 100;
