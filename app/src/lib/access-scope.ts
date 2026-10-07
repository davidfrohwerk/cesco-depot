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

export function userHasOrganizationPermission(
  user: Awaited<ReturnType<typeof requireCurrentUser>>,
  permissionKey: string,
  organizationId: string
) {
  if (userHasPermission(user, permissionKey, organizationId)) {
    return true;
  }

  return user.memberships.some(
    (membership) =>
      membership.organization.kind === "INTERNAL" &&
      membership.roles.some(
        ({ role }) =>
          INTERNAL_ROLE_KEYS.has(role.key) &&
          role.permissions.some(
            ({ permission }) =>
              permission.key === permissionKey
          )
      )
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
