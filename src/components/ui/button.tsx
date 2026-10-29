import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClass({ variant = "secondary", size = "md", className }: { variant?: ButtonVariant; size?: "sm" | "md" | "icon"; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    size === "md" && "h-9 px-3.5 text-sm",
    size === "sm" && "h-7 px-2.5 text-xs",
    size === "icon" && "size-8",
    variant === "primary" && "bg-accent text-accent-fg hover:bg-accent/90",
    variant === "secondary" && "border bg-surface text-fg hover:bg-raised",
    variant === "ghost" && "text-muted hover:bg-raised hover:text-fg",
    variant === "danger" && "bg-crit text-white hover:bg-crit/90 dark:text-bg",
    className
  );
}

export function Button({
  className,
  variant = "secondary",
  size = "md",
  loading = false,
  loadingLabel,
  disabled,
  children,
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "icon";
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
