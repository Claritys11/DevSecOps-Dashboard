"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function FormSubmitButton({
  children,
  pendingLabel,
  className,
  variant = "primary"
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <Button className={className} type="submit" variant={variant} loading={pending} loadingLabel={pendingLabel}>
      {children}
    </Button>
  );
}
