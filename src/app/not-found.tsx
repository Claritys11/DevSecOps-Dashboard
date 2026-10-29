import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">That page does not exist</h1>
        <p className="text-sm text-muted">It may have been removed, or the link is out of date.</p>
        <Link href="/" className={buttonClass({ variant: "primary" })}>Go to overview</Link>
      </div>
    </main>
  );
}
