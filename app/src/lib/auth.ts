import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "cesco_depot_session";
const SESSION_HOURS = 12;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const PASSWORD_KEY_LENGTH = 64;

function sessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, PASSWORD_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: 64 * 1024 * 1024,
  });

  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt,
    key.toString("hex"),
  ].join("$");
}

export function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const [, nRaw, rRaw, pRaw, salt, expectedHex] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);

  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    !salt ||
    !expectedHex
  ) {
    return false;
  }

  const actual = scryptSync(
    password,
    salt,
    Buffer.from(expectedHex, "hex").length,
    {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    }
  );
  const expected = Buffer.from(expectedHex, "hex");

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = sessionTokenHash(token);
  const expiresAt = new Date(
    Date.now() + SESSION_HOURS * 60 * 60 * 1000
  );

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.authSession.deleteMany({
      where: {
        tokenHash: sessionTokenHash(token),
      },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: {
      tokenHash: sessionTokenHash(token),
    },
    include: {
      user: {
        include: {
          memberships: {
            where: {
              status: "ACTIVE",
            },
            include: {
              organization: true,
              roles: {
                include: {
                  role: {
                    include: {
                      permissions: {
                        include: {
                          permission: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE"
  ) {
    return null;
  }

  return session.user;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export function currentUserLabel(
  user: Awaited<ReturnType<typeof requireCurrentUser>>
) {
  return user.displayName?.trim() || user.email;
}

export function userHasPermission(
  user: Awaited<ReturnType<typeof requireCurrentUser>>,
  permissionKey: string,
  organizationId?: string | null
) {
  const memberships = organizationId
    ? user.memberships.filter(
        (membership) =>
          membership.organizationId === organizationId
      )
    : user.memberships;

  return memberships.some((membership) =>
    membership.roles.some(
      ({ role }) =>
        role.key === "SYSTEM_ADMIN" ||
        role.permissions.some(
          ({ permission }) =>
            permission.key === permissionKey
        )
    )
  );
}

export async function requirePermission(
  permissionKey: string,
  organizationId?: string | null
) {
  const user = await requireCurrentUser();

  if (!userHasPermission(user, permissionKey, organizationId)) {
    throw new Error(
      `Permission denied: ${permissionKey}`
    );
  }

  return user;
}
