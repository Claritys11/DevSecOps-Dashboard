"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const database = /database|prisma|ECONNREFUSED|P10\d\d/i.test(error.message);
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16">
      <h1 className="text-xl font-semibold">This page could not load</h1>
      <p className="text-sm text-muted">
        {database
          ? "The dashboard cannot reach its database. Check that the postgres container is running: docker compose ps"
          : "Something failed on the server. The details are in the app logs: docker compose logs app"}
      </p>
      {error.digest && <p className="font-mono text-2xs text-muted">Reference {error.digest}</p>}
      <Button variant="primary" onClick={reset}>Try again</Button>
    </div>
  );
}
