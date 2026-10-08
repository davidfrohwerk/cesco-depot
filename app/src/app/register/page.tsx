import Link from "next/link";
import { redirect } from "next/navigation";
import { registerClientAccount } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RegisterPage({
  searchParams,
}: PageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/organizations");
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/" className="text-sm underline">
        ← CESCo Depot
      </Link>

      <p className="mt-8 text-sm font-medium opacity-60">
        Free customer account
      </p>
      <h1 className="mt-2 text-3xl font-bold">
        Create your CESCo Depot workspace
      </h1>
      <p className="mt-3 text-sm leading-6 opacity-70">
        Create your organization, become its first client administrator,
        register assets, invite your team, and begin requesting service.
        Creating an account does not create a work order or service charge.
      </p>

      {error === "missing" && (
        <div className="mt-6 rounded border p-3 text-sm">
          Name, organization, email, and password are required.
        </div>
      )}

      {error === "password" && (
        <div className="mt-6 rounded border p-3 text-sm">
          Password must be at least 12 characters.
        </div>
      )}

      {error === "account_exists" && (
        <div className="mt-6 rounded border p-3 text-sm">
          An account with that email already exists. Sign in instead.
        </div>
      )}

      <form action={registerClientAccount} className="mt-8 space-y-4">
        <input
          name="displayName"
          required
          autoComplete="name"
          placeholder="Your name"
          className="w-full rounded border px-3 py-2"
        />

        <input
          name="organizationName"
          required
          autoComplete="organization"
          placeholder="Organization name"
          className="w-full rounded border px-3 py-2"
        />

        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Work email"
          className="w-full rounded border px-3 py-2"
        />

        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          placeholder="Password (12+ characters)"
          className="w-full rounded border px-3 py-2"
        />

        <button
          type="submit"
          className="w-full rounded border px-4 py-2 font-medium"
        >
          Create free account
        </button>
      </form>

      <p className="mt-6 text-sm opacity-70">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
        .
      </p>
    </main>
  );
}
