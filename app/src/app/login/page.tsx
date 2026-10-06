import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: PageProps) {
  const currentUser = await getCurrentUser();

  if (currentUser) {
    redirect("/organizations");
  }

  const activeUsers = await prisma.user.count({
    where: { status: "ACTIVE" },
  });

  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md p-8">
      <p className="text-sm opacity-60">CESCo Depot</p>
      <h1 className="mt-2 text-3xl font-bold">Sign in</h1>

      {error === "credentials" && (
        <div className="mt-5 rounded border p-3 text-sm">
          Invalid email or password.
        </div>
      )}

      <form action={login} className="mt-6 space-y-4">
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
          autoComplete="current-password"
          placeholder="Password"
          className="w-full rounded border px-3 py-2"
        />
        <button
          type="submit"
          className="w-full rounded border px-4 py-2 font-medium"
        >
          Sign in
        </button>
      </form>

      {activeUsers === 0 && (
        <p className="mt-6 text-sm opacity-70">
          No active user exists yet.{" "}
          <Link href="/setup" className="underline">
            Create the initial administrator
          </Link>
          .
        </p>
      )}
    </main>
  );
}
