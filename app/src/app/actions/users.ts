"use server";

import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  hashPassword,
  requirePermission,
  userHasPermission,
} from "@/lib/auth";
import { ensureDefaultAccessControl } from "@/lib/access-control";

const INVITE_HOURS = 24;

function inviteTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function allowedRoleKeysForUser(
  user: Awaited<ReturnType<typeof requirePermission>>
) {
  if (userHasPermission(user, "system.admin")) {
    return null;
  }

  return new Set([
    "CLIENT_ADMIN",
    "CLIENT_DISPATCHER",
    "CLIENT_BILLING",
    "CLIENT_AUDITOR",
  ]);
}

export async function inviteOrganizationUser(
  organizationId: string,
  formData: FormData
) {
  const currentUser = await requirePermission(
    "organization.manage_users",
    organizationId
  );

  await ensureDefaultAccessControl();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const displayName = String(
    formData.get("displayName") ?? ""
  ).trim();
  const roleKey = String(
    formData.get("roleKey") ?? ""
  ).trim();

  if (!email || !roleKey) {
    throw new Error("Email and role are required.");
  }

  const allowedRoleKeys = allowedRoleKeysForUser(currentUser);

  if (allowedRoleKeys && !allowedRoleKeys.has(roleKey)) {
    throw new Error(
      "You cannot assign that role within this organization."
    );
  }

  const role = await prisma.role.findUnique({
    where: { key: roleKey },
  });

  if (!role) {
    throw new Error("Selected role does not exist.");
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = inviteTokenHash(token);
  const expiresAt = new Date(
    Date.now() + INVITE_HOURS * 60 * 60 * 1000
  );

  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await tx.user.create({
        data: {
          email,
          displayName: displayName || null,
          status: "INVITED",
        },
      });
    } else if (displayName && !user.displayName) {
      user = await tx.user.update({
        where: { id: user.id },
        data: { displayName },
      });
    }

    const membership = await tx.membership.upsert({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
      update: {
        status:
          user.status === "ACTIVE" ? "ACTIVE" : "INVITED",
      },
      create: {
        userId: user.id,
        organizationId,
        status:
          user.status === "ACTIVE" ? "ACTIVE" : "INVITED",
      },
    });

    await tx.membershipRole.deleteMany({
      where: { membershipId: membership.id },
    });

    await tx.membershipRole.create({
      data: {
        membershipId: membership.id,
        roleId: role.id,
      },
    });

    if (user.status === "ACTIVE") {
      return {
        existingActiveUser: true,
        userId: user.id,
      };
    }

    await tx.userInvite.deleteMany({
      where: {
        userId: user.id,
        acceptedAt: null,
      },
    });

    await tx.userInvite.create({
      data: {
        userId: user.id,
        membershipId: membership.id,
        createdByUserId: currentUser.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      existingActiveUser: false,
      userId: user.id,
    };
  });

  if (result.existingActiveUser) {
    redirect(
      `/organizations/${organizationId}/users?added=existing`
    );
  }

  redirect(
    `/organizations/${organizationId}/users?invite=${encodeURIComponent(token)}`
  );
}

export async function setMembershipStatus(
  organizationId: string,
  membershipId: string,
  formData: FormData
) {
  const currentUser = await requirePermission(
    "organization.manage_users",
    organizationId
  );

  const status = String(
    formData.get("status") ?? ""
  ).trim();

  if (!["ACTIVE", "DISABLED"].includes(status)) {
    throw new Error("Unsupported membership status.");
  }

  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      user: true,
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (
    !membership ||
    membership.organizationId !== organizationId
  ) {
    throw new Error("Membership not found.");
  }

  if (
    membership.userId === currentUser.id &&
    status === "DISABLED"
  ) {
    throw new Error(
      "You cannot disable your own current membership."
    );
  }

  const systemAdminMembership = membership.roles.some(
    ({ role }) => role.key === "SYSTEM_ADMIN"
  );

  if (
    systemAdminMembership &&
    !userHasPermission(currentUser, "system.admin")
  ) {
    throw new Error(
      "Only a system administrator can modify a system administrator."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: { status: status as "ACTIVE" | "DISABLED" },
    });

    if (status === "DISABLED") {
      const remainingActiveMemberships =
        await tx.membership.count({
          where: {
            userId: membership.userId,
            status: "ACTIVE",
            id: { not: membership.id },
          },
        });

      if (remainingActiveMemberships === 0) {
        await tx.user.update({
          where: { id: membership.userId },
          data: { status: "DISABLED" },
        });

        await tx.authSession.deleteMany({
          where: { userId: membership.userId },
        });
      }
    } else if (membership.user.status === "DISABLED") {
      await tx.user.update({
        where: { id: membership.userId },
        data: { status: "ACTIVE" },
      });
    }
  });

  redirect(`/organizations/${organizationId}/users`);
}

export async function acceptInvite(
  token: string,
  formData: FormData
) {
  const tokenHash = inviteTokenHash(token);
  const displayName = String(
    formData.get("displayName") ?? ""
  ).trim();
  const password = String(
    formData.get("password") ?? ""
  );

  if (!displayName || !password) {
    redirect(
      `/invite/${encodeURIComponent(token)}?error=missing`
    );
  }

  let passwordHash: string;

  try {
    passwordHash = hashPassword(password);
  } catch {
    redirect(
      `/invite/${encodeURIComponent(token)}?error=password`
    );
  }

  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash },
    include: {
      membership: true,
      user: true,
    },
  });

  if (
    !invite ||
    invite.acceptedAt ||
    invite.expiresAt <= new Date()
  ) {
    redirect("/login?error=invite");
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: invite.userId },
      data: {
        displayName,
        passwordHash,
        status: "ACTIVE",
        lastLoginAt: now,
      },
    });

    await tx.membership.update({
      where: { id: invite.membershipId },
      data: { status: "ACTIVE" },
    });

    await tx.userInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: now },
    });
  });

  await createSession(invite.userId);
  redirect("/organizations");
}
