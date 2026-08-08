import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";

import statesTopology from "us-atlas/states-10m.json";

export type UsStateMapDatum = {
  /** 2-digit state FIPS code, e.g. "06" for California. */
  id: string;
  value: number;
  label?: string;
};

type StateProperties = { name: string };

type UsStateMapProps = {
  title?: string;
  description?: string;
  data: UsStateMapDatum[];
  valueSuffix?: string;
  accentVar?: string;
  width?: number;
  height?: number;
};

// geoAlbersUsa only has a defined projection for the 50 states + DC — Puerto
// Rico and the other outlying territories in the atlas fall outside it.
const TERRITORY_FIPS = new Set(["60", "66", "69", "72", "78"]);

const topology = statesTopology as unknown as Topology;
const statesCollection = feature(
  topology,
  topology.objects.states as GeometryCollection
) as unknown as FeatureCollection<Geometry, StateProperties>;
const states = statesCollection.features.filter(
  (f) => !TERRITORY_FIPS.has(String(f.id))
);

export function UsStateMap({
  title,
  description,
  data,
  valueSuffix = "",
  accentVar = "--accent",
  width = 960,
  height = 600,
}: UsStateMapProps) {
  const projection = geoAlbersUsa().fitSize([width, height], {
    type: "FeatureCollection",
    features: states,
  } as FeatureCollection);
  const path = geoPath(projection);

  const lookup = new Map(data.map((d) => [d.id, d]));
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-surface p-3 sm:p-5">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="font-semibold">{title}</h3>}
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={title ?? "Map of the United States"}
      >
        {states.map((f) => {
          const id = String(f.id);
          const d = path(f);
          if (!d) return null;

          const datum = lookup.get(id);
          const intensity = datum
            ? Math.round(((datum.value - min) / range) * 100)
            : 0;

          return (
            <path
              key={id}
              d={d}
              stroke="var(--surface)"
              strokeWidth={0.75}
              fill={
                datum
                  ? `color-mix(in srgb, var(${accentVar}) ${Math.max(intensity, 6)}%, var(--surface-2))`
                  : "var(--surface-2)"
              }
            >
              <title>
                {`${f.properties.name}${
                  datum ? `: ${datum.label ?? datum.value}${valueSuffix}` : ": No data"
                }`}
              </title>
            </path>
          );
        })}
      </svg>

      <p className="mt-3 text-xs text-muted">
        Darker states indicate higher values.
      </p>
    </div>
  );
}
