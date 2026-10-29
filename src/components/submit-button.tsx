"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/button";

export function SubmitButton({ children, pendingLabel, className, variant = "primary" }: { children: React.ReactNode; pendingLabel: string; className?: string; variant?: ButtonVariant }) {
  const { pending } = useFormStatus();
  return (
    <Button className={className} type="submit" variant={variant} loading={pending} loadingLabel={pendingLabel}>
      {children}
    </Button>
  );
}
