"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { ensureDefaultAccessControl } from "@/lib/access-control";

const permissions = [
  ["system.admin", "Full system administration"],
  ["organization.view", "View organization records"],
  ["organization.manage", "Manage organization records"],
  ["organization.manage_users", "Manage organization users and roles"],
  ["asset.view", "View assets"],
  ["asset.manage", "Manage asset lifecycle records"],
  ["work_order.view", "View work orders"],
  ["work_order.manage", "Manage work-order execution"],
  ["inventory.receive", "Receive packages and inventory"],
  ["shipment.manage", "Manage inbound and outbound shipments"],
  ["billing.view", "View billing records"],
  ["billing.manage", "Manage billing records"],
  ["audit.view", "View audit and provenance records"],
] as const;

async function ensureSystemAdminRole() {
  const permissionRecords = [];

  for (const [key, description] of permissions) {
    permissionRecords.push(
      await prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      })
    );
  }

  const role = await prisma.role.upsert({
    where: { key: "SYSTEM_ADMIN" },
    update: {
      name: "System Administrator",
      description:
        "Full CESCo Depot system administration.",
    },
    create: {
      key: "SYSTEM_ADMIN",
      name: "System Administrator",
      description:
        "Full CESCo Depot system administration.",
    },
  });

  for (const permission of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }

  return role;
}

export async function setupInitialAdmin(formData: FormData) {
  const existingActiveUsers = await prisma.user.count({
    where: { status: "ACTIVE" },
  });

  if (existingActiveUsers > 0) {
    redirect("/login");
  }

  const displayName = String(
    formData.get("displayName") ?? ""
  ).trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(
    formData.get("password") ?? ""
  );

  if (!displayName || !email || !password) {
    redirect("/setup?error=missing");
  }

  let passwordHash: string;

  try {
    passwordHash = hashPassword(password);
  } catch {
    redirect("/setup?error=password");
  }

  let organization = await prisma.organization.findFirst({
    where: {
      kind: "INTERNAL",
    },
  });

  if (!organization) {
    const legacyInternal = await prisma.organization.findFirst({
      where: {
        name: {
          equals: "CESCo Internal",
          mode: "insensitive",
        },
      },
    });

    organization = legacyInternal
      ? await prisma.organization.update({
          where: { id: legacyInternal.id },
          data: { kind: "INTERNAL" },
        })
      : await prisma.organization.create({
          data: {
            name: "CESCo Internal",
            kind: "INTERNAL",
          },
        });
  }

  const role = await ensureSystemAdminRole();

  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      status: "ACTIVE",
      lastLoginAt: new Date(),
      memberships: {
        create: {
          organizationId: organization.id,
          status: "ACTIVE",
        },
      },
    },
    include: {
      memberships: true,
    },
  });

  const membership = user.memberships[0];

  await prisma.membershipRole.create({
    data: {
      membershipId: membership.id,
      roleId: role.id,
    },
  });

  await createSession(user.id);
  redirect("/organizations");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(
    formData.get("password") ?? ""
  );

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.passwordHash ||
    !verifyPassword(password, user.passwordHash)
  ) {
    redirect("/login?error=credentials");
  }

  await prisma.$transaction([
    prisma.authSession.deleteMany({
      where: {
        userId: user.id,
        expiresAt: {
          lt: new Date(),
        },
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);

  await createSession(user.id);
  redirect("/organizations");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}


export async function registerClientAccount(formData: FormData) {
  const displayName = String(
    formData.get("displayName") ?? ""
  ).trim();
  const email = String(
    formData.get("email") ?? ""
  )
    .trim()
    .toLowerCase();
  const password = String(
    formData.get("password") ?? ""
  );
  const organizationName = String(
    formData.get("organizationName") ?? ""
  ).trim();

  if (!displayName || !email || !password || !organizationName) {
    redirect("/register?error=missing");
  }

  let passwordHash: string;

  try {
    passwordHash = hashPassword(password);
  } catch {
    redirect("/register?error=password");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    redirect("/register?error=account_exists");
  }

  await ensureDefaultAccessControl();

  const clientAdminRole = await prisma.role.findUnique({
    where: { key: "CLIENT_ADMIN" },
    select: { id: true },
  });

  if (!clientAdminRole) {
    throw new Error("Client administrator role is unavailable.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        kind: "CLIENT",
      },
    });

    const user = await tx.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        status: "ACTIVE",
        lastLoginAt: new Date(),
      },
    });

    const membership = await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        status: "ACTIVE",
      },
    });

    await tx.membershipRole.create({
      data: {
        membershipId: membership.id,
        roleId: clientAdminRole.id,
      },
    });

    return {
      userId: user.id,
      organizationId: organization.id,
    };
  });

  await createSession(result.userId);
  redirect(`/organizations/${result.organizationId}`);
}
