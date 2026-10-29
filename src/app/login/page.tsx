import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";
import { Field, FormError, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Sign in" };

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/"
    });
  } catch (error) {
    if (error instanceof AuthError) redirect("/login?error=CredentialsSignin");
    throw error;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded bg-fg text-bg">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">DevSecOps Dashboard</h1>
            <p className="text-xs text-muted">Sign in to see your servers and services.</p>
          </div>
        </div>
        <form action={loginAction} className="space-y-4 rounded-md border bg-surface p-5">
          <Field label="Email">
            <Input type="email" name="email" autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" name="password" autoComplete="current-password" required />
          </Field>
          {error && <FormError>That email and password do not match. After 10 attempts, sign-in pauses for 15 minutes.</FormError>}
          <SubmitButton className="w-full" pendingLabel="Signing in">Sign in</SubmitButton>
        </form>
        <p className="mt-4 text-xs text-muted">
          First time? The admin email and password were printed by the installer and saved in <span className="font-mono">.env</span>.
        </p>
      </div>
    </main>
  );
}
