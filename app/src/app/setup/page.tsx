import { redirect } from "next/navigation";
import { setupInitialAdmin } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SetupPage({
  searchParams,
}: PageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/organizations");
  }

  const activeUsers = await prisma.user.count({
    where: { status: "ACTIVE" },
  });

  if (activeUsers > 0) {
    redirect("/login");
  }

  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md p-8">
      <p className="text-sm opacity-60">CESCo Depot</p>
      <h1 className="mt-2 text-3xl font-bold">
        Initial administrator setup
      </h1>

      <p className="mt-4 text-sm opacity-70">
        This one-time screen creates the first active user, grants the
        SYSTEM_ADMIN role, and starts an authenticated session.
      </p>

      {error === "missing" && (
        <div className="mt-5 rounded border p-3 text-sm">
          Name, email, and password are required.
        </div>
      )}

      {error === "password" && (
        <div className="mt-5 rounded border p-3 text-sm">
          Password must be at least 12 characters.
        </div>
      )}

      <form action={setupInitialAdmin} className="mt-6 space-y-4">
        <input
          name="displayName"
          required
          autoComplete="name"
          placeholder="Display name"
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="Email"
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
          Create system administrator
        </button>
      </form>
    </main>
  );
}
