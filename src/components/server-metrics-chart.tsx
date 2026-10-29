"use client";

import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type MetricPoint = { t: number; cpu: number; memory: number; disk: number; load: number };

const series = [
  { key: "cpu", label: "CPU", unit: "%", max: 100 },
  { key: "memory", label: "Memory", unit: "%", max: 100 },
  { key: "disk", label: "Disk", unit: "%", max: 100 },
  { key: "load", label: "Load (1 min)", unit: "", max: undefined }
] as const;

function formatTick(value: number, spanMs: number) {
  const date = new Date(value);
  return spanMs > 36 * 3600_000
    ? date.toLocaleDateString([], { month: "short", day: "numeric" })
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Small multiples: one chart per resource, each with its own scale and alert line. */
export function ServerMetricsChart({ data, thresholds }: { data: MetricPoint[]; thresholds: { cpu: number; memory: number; disk: number } }) {
  if (data.length < 2) {
    return <div className="grid h-48 place-items-center rounded border border-dashed text-sm text-muted">Not enough data in this range yet</div>;
  }
  const span = data[data.length - 1].t - data[0].t;

  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {series.map((item) => {
        const threshold = item.key === "load" ? undefined : thresholds[item.key];
        const latest = data[data.length - 1][item.key];
        return (
          <figure key={item.key} className="min-w-0">
            <figcaption className="mb-1 flex items-baseline justify-between text-xs">
              <span className="font-medium">{item.label}</span>
              <span className="tabular font-mono text-muted">
                now {latest.toFixed(item.unit ? 0 : 2)}
                {item.unit}
              </span>
            </figcaption>
            <div className="h-28 text-accent [&_.recharts-cartesian-axis-tick-value]:fill-[rgb(var(--muted))] [&_.recharts-reference-line_line]:stroke-[rgb(var(--crit))]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={(value) => formatTick(value, span)} tickLine={false} axisLine={false} fontSize={10} minTickGap={40} />
                  <YAxis domain={item.max ? [0, item.max] : [0, "auto"]} tickLine={false} axisLine={false} fontSize={10} width={28} tickCount={3} />
                  <Tooltip
                    cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }}
                    contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 6, fontSize: 12 }}
                    labelFormatter={(value) => new Date(Number(value)).toLocaleString()}
                    formatter={(value) => [`${Number(value).toFixed(item.unit ? 1 : 2)}${item.unit}`, item.label]}
                  />
                  {threshold != null && <ReferenceLine y={threshold} className="text-crit" stroke="currentColor" strokeDasharray="3 3" strokeOpacity={0.7} />}
                  <Area type="monotone" dataKey={item.key} stroke="currentColor" fill="currentColor" fillOpacity={0.12} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </figure>
        );
      })}
    </div>
  );
}
