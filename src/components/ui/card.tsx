import { cn } from "@/lib/utils";

/** A bordered region. Use `Section` for page blocks that need a heading. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border bg-surface", className)} {...props} />;
}

export function Section({
  title,
  description,
  action,
  children,
  className,
  flush = false
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn("rounded-md border bg-surface", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
        {action}
      </header>
      <div className={flush ? undefined : "p-4"}>{children}</div>
    </section>
  );
}
