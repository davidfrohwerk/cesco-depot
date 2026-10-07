import { redirect } from "next/navigation";
import { acceptInvite } from "@/app/actions/users";
import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

function inviteTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export default async function InvitePage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const { error } = await searchParams;

  const invite = await prisma.userInvite.findUnique({
    where: {
      tokenHash: inviteTokenHash(token),
    },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              organization: true,
              roles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      },
      createdBy: true,
    },
  });

  if (
    !invite ||
    invite.acceptedAt ||
    invite.expiresAt <= new Date()
  ) {
    redirect("/login?error=invite");
  }

  const membership = invite.user.memberships.find(
    (candidate) => candidate.status === "INVITED"
  );

  return (
    <main className="mx-auto max-w-md p-8">
      <p className="text-sm opacity-60">CESCo Depot invitation</p>
      <h1 className="mt-2 text-3xl font-bold">
        Activate your account
      </h1>

      <div className="mt-6 rounded border p-4 text-sm">
        <div>
          Email: {invite.user.email}
        </div>
        <div className="mt-2">
          Organization:{" "}
          {membership?.organization.name ?? "Assigned organization"}
        </div>
        <div className="mt-2">
          Role:{" "}
          {membership?.roles
            .map(({ role }) => role.name)
            .join(", ") || "Assigned role"}
        </div>
        <div className="mt-2 opacity-60">
          Invited by:{" "}
          {invite.createdBy.displayName ?? invite.createdBy.email}
        </div>
      </div>

      {error === "missing" && (
        <div className="mt-5 rounded border p-3 text-sm">
          Display name and password are required.
        </div>
      )}

      {error === "password" && (
        <div className="mt-5 rounded border p-3 text-sm">
          Password must be at least 12 characters.
        </div>
      )}

      <form
        action={acceptInvite.bind(null, token)}
        className="mt-6 space-y-4"
      >
        <input
          name="displayName"
          required
          defaultValue={invite.user.displayName ?? ""}
          placeholder="Display name"
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
          Activate account
        </button>
      </form>
    </main>
  );
}
