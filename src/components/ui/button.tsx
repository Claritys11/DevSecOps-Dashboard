import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded border px-3 text-sm font-medium transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "border-primary bg-primary text-primary-foreground",
        variant === "secondary" && "border-border bg-card text-foreground",
        variant === "danger" && "border-destructive bg-destructive text-destructive-foreground",
        className
      )}
      {...props}
    />
  );
}
