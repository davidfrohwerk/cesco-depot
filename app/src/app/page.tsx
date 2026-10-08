import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <main>
      {!user && (
        <section className="border-b">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
            <div className="font-semibold">CESCo Depot</div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/login" className="underline">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded border px-4 py-2 font-medium"
              >
                Create free account
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-4xl">
          <p className="text-sm font-medium opacity-60">
            Technical asset lifecycle services
          </p>
          <h1 className="mt-4 text-5xl font-bold leading-tight">
            Know what you have, where it is, what condition it is in,
            and what happens next.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 opacity-75">
            CESCo Depot combines depot repair, custody records, shipment
            tracking, evidence, inventory visibility, strategic stocking,
            redeployment, and disposition in one operational record for
            technical assets you still own.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {user ? (
              <Link
                href="/organizations"
                className="rounded border px-5 py-3 font-medium"
              >
                Open your workspace
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="rounded border px-5 py-3 font-medium"
                >
                  Create a free account
                </Link>
                <Link
                  href="/login"
                  className="rounded border px-5 py-3"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>

          <p className="mt-4 text-sm opacity-60">
            Account registration and basic portal access are free. Service
            charges apply when you authorize operational work or contracted
            services.
          </p>
        </div>
      </section>

      <section className="border-y">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-12 md:grid-cols-3">
          <article className="rounded border p-5">
            <h2 className="text-xl font-semibold">Repair with provenance</h2>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Keep service requests, authorization, work history, evidence,
              parts, testing, and shipment records tied to the asset.
            </p>
          </article>
          <article className="rounded border p-5">
            <h2 className="text-xl font-semibold">Control custody and movement</h2>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Track ownership, custody, physical location, package receipt,
              carrier movement, and delivery as separate operational facts.
            </p>
          </article>
          <article className="rounded border p-5">
            <h2 className="text-xl font-semibold">Keep useful assets ready</h2>
            <p className="mt-3 text-sm leading-6 opacity-70">
              Hold repaired, known-good equipment as strategic stock so useful
              assets can be redeployed instead of forgotten or repurchased.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-bold">
          From service request to return
        </h2>
        <p className="mt-3 max-w-3xl leading-7 opacity-70">
          Start with the outcome you need. CESCo Depot keeps the authorization,
          shipment, custody, work, evidence, and return path connected without
          turning account registration into an operational obligation.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["1", "Register assets", "Create your organization workspace and record the equipment you manage."],
            ["2", "Request service", "Choose repair, test, reconfiguration, stocking, redeployment, or disposition."],
            ["3", "Authorize and ship", "Approve scope and spending limits, then prepare the inbound shipment."],
            ["4", "Follow the lifecycle", "See custody, condition, work, evidence, readiness, and return status."],
          ].map(([number, title, description]) => (
            <article key={number} className="rounded border p-5">
              <div className="text-sm opacity-50">{number}</div>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 opacity-70">
                {description}
              </p>
            </article>
          ))}
        </div>

        {!user && (
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-block rounded border px-5 py-3 font-medium"
            >
              Create your organization workspace
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
