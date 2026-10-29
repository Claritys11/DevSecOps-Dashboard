import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, children, action, className }: { icon?: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-start gap-3 px-4 py-8 sm:items-center sm:text-center", className)}>
      {Icon && <Icon className="size-6 text-muted" />}
      <div className="max-w-md space-y-1">
        <p className="font-medium">{title}</p>
        {children && <div className="text-sm text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}
