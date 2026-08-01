import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";

async function loginAction(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/"
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=CredentialsSignin");
    }
    throw error;
  }
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">DevSecOps Dashboard</h1>
            <p className="text-sm text-muted-foreground">Sign in to your homelab console.</p>
          </div>
        </div>
        <form action={loginAction} className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input className="mt-1 h-10 w-full rounded border bg-background px-3" type="email" name="email" required />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input className="mt-1 h-10 w-full rounded border bg-background px-3" type="password" name="password" required />
          </label>
          <LoginError searchParams={searchParams} />
          <Button className="w-full" type="submit">Sign in</Button>
        </form>
      </div>
    </main>
  );
}

async function LoginError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (!params.error) return null;
  return <p className="rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">Invalid email or password.</p>;
}
