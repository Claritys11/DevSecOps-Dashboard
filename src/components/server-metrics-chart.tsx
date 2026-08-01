"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type MetricPoint = {
  collectedAt: string;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  storageUsagePercent: number;
  loadAverage1: number;
};

export function ServerMetricsChart({ data }: { data: MetricPoint[] }) {
  if (data.length === 0) {
    return <div className="grid h-64 place-items-center rounded border bg-muted/40 text-sm text-muted-foreground">No metrics in this range</div>;
  }

  const chartData = data.map((point) => ({
    time: new Date(point.collectedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    cpu: point.cpuUsagePercent,
    ram: point.memoryUsagePercent,
    disk: point.storageUsagePercent,
    load: point.loadAverage1
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="time" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} width={42} />
          <Tooltip />
          <Line type="monotone" dataKey="cpu" stroke="#0f766e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="ram" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="disk" stroke="#b45309" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
