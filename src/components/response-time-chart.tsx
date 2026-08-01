"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ResponseTimeChart({ data }: { data: Array<{ checkedAt: Date | string; responseTimeMs: number | null }> }) {
  const chartData = data
    .filter((item) => item.responseTimeMs != null)
    .map((item) => ({
      time: new Date(item.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ms: item.responseTimeMs
    }))
    .reverse();

  if (chartData.length === 0) {
    return <div className="grid h-52 place-items-center rounded border bg-muted/40 text-sm text-muted-foreground">No response time data yet</div>;
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={42} />
          <Tooltip />
          <Line type="monotone" dataKey="ms" stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
