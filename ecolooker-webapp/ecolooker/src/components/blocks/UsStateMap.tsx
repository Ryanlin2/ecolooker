"use client";

import { useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";

import statesTopology from "us-atlas/states-10m.json";
import { fmtNum } from "@/lib/utils";

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
  valuePrefix?: string;
  valueSuffix?: string;
  /** Raw datum values are divided by this before formatting, e.g. 1000 to
   *  turn millions into billions for the legend's min/max ticks. */
  valueDivisor?: number;
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

type HoverInfo = {
  name: string;
  text: string;
  x: number;
  y: number;
};

export function UsStateMap({
  title,
  description,
  data,
  valuePrefix = "",
  valueSuffix = "",
  valueDivisor = 1,
  accentVar = "--accent",
  width = 960,
  height = 600,
}: UsStateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const formatValue = (v: number) =>
    `${valuePrefix}${fmtNum(v / valueDivisor)}${valueSuffix}`;

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

  function handleMove(
    event: React.MouseEvent<SVGPathElement>,
    name: string,
    datum: UsStateMapDatum | undefined
  ) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setHover({
      name,
      text: datum ? `${datum.label ?? formatValue(datum.value)}` : "No data",
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full min-w-0 overflow-hidden rounded-xl border bg-surface p-3 sm:p-5"
    >
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
          const name = f.properties.name;

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
              onMouseEnter={(e) => handleMove(e, name, datum)}
              onMouseMove={(e) => handleMove(e, name, datum)}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          <div className="font-semibold">{hover.name}</div>
          <div className="text-muted">{hover.text}</div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <div
          className="h-2 flex-1 max-w-64 rounded-full"
          style={{
            background: `linear-gradient(to right, color-mix(in srgb, var(${accentVar}) 6%, var(--surface-2)), var(${accentVar}))`,
          }}
        />
        <div className="flex justify-between gap-3 text-xs text-muted">
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted">
        Darker states indicate higher values.
      </p>
    </div>
  );
}
