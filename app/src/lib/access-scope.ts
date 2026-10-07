import {
  requireCurrentUser,
  userHasPermission,
} from "@/lib/auth";

const INTERNAL_ROLE_KEYS = new Set([
  "CESCO_OPERATIONS_ADMIN",
  "DEPOT_MANAGER",
  "DEPOT_TECHNICIAN",
  "RECEIVING_LOGISTICS",
]);

export function userHasCrossOrganizationPermission(
  user: Awaited<ReturnType<typeof requireCurrentUser>>,
  permissionKey: string
) {
  return user.memberships.some(
    (membership) =>
      membership.organization.kind === "INTERNAL" &&
      membership.roles.some(
        ({ role }) =>
          role.key === "SYSTEM_ADMIN" ||
          (INTERNAL_ROLE_KEYS.has(role.key) &&
            role.permissions.some(
              ({ permission }) =>
                permission.key === permissionKey
            ))
      )
  );
}

export function userHasOrganizationPermission(
  user: Awaited<ReturnType<typeof requireCurrentUser>>,
  permissionKey: string,
  organizationId: string
) {
  if (userHasPermission(user, permissionKey, organizationId)) {
    return true;
  }

  return userHasCrossOrganizationPermission(
    user,
    permissionKey
  );
}

export async function requireOrganizationPermission(
  permissionKey: string,
  organizationId: string
) {
  const user = await requireCurrentUser();

  if (
    !userHasOrganizationPermission(
      user,
      permissionKey,
      organizationId
    )
  ) {
    throw new Error("Insufficient access for this operation.");
  }

  return user;
}
