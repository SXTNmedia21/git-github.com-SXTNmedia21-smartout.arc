import { notFound, redirect } from "next/navigation";
import { getSuperAdminId } from "@/lib/platform-admin";

export const metadata = { title: "dev_outbox — Smartout" };

export default async function DevOutboxPage() {
  // Hard prod gate (defense-in-depth: banner + mono title + diagonal stripe also signal it)
  if (process.env.NODE_ENV === "production") notFound();

  const adminId = await getSuperAdminId();
  if (!adminId) redirect("/dashboard");

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(0,0,0,0.02) 12px, rgba(0,0,0,0.02) 24px)",
      }}
    >
      <div className="bg-warning text-warning-foreground border-border sticky top-0 z-10 border-b px-4 py-2 text-center font-mono text-sm">
        ⚠ DEV ENVIRONMENT — these messages were captured locally and never delivered.
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-foreground mb-2 font-mono text-2xl">dev_outbox</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          Locally-intercepted email + SMS dispatch. Production builds 404 this route.
        </p>

        <div className="border-border text-muted-foreground rounded-md border p-12 text-center">
          <p>No messages captured yet.</p>
          <p className="mt-2 text-xs">
            Wire-up to <code className="font-mono">notification_outbox</code> table with{" "}
            <code className="font-mono">dispatch_mode=&apos;inbucket&apos;</code> ships in Wave I.
          </p>
        </div>
      </div>
    </div>
  );
}
