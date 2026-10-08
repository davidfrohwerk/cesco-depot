import { prisma } from "@/lib/prisma";

export const permissionDefinitions = [
  ["system.admin", "Full system administration"],
  ["organization.view", "View organization records"],
  ["organization.manage", "Manage organization records"],
  ["organization.manage_users", "Manage organization users and roles"],
  ["endpoint.view", "View client and downstream service endpoints"],
  ["endpoint.manage", "Manage client and downstream service endpoints"],
  ["service_location.view", "View CESCo-managed and partner service locations"],
  ["service_location.manage", "Manage CESCo-managed and partner service locations"],
  ["service_request.create", "Create service requests"],
  ["service_request.authorize", "Authorize service requests"],
  ["asset.view", "View assets"],
  ["asset.manage", "Manage asset lifecycle records"],
  ["work_order.view", "View work orders"],
  ["work_order.manage", "Manage work-order execution"],
  ["inventory.receive", "Receive packages and inventory"],
  ["shipment.prepare", "Prepare customer shipment records and tracking"],
  ["shipment.manage", "Manage carrier and custody shipment events"],
  ["shipment.acknowledge_receipt", "Acknowledge customer receipt of delivered assets"],
  ["billing.view", "View billing records"],
  ["billing.manage", "Manage billing records"],
  ["audit.view", "View audit and provenance records"],
  ["evidence.view", "View evidence files and metadata"],
  ["evidence.upload", "Upload evidence files"],
] as const;

export const roleDefinitions = [
  {
    key: "SYSTEM_ADMIN",
    name: "System Administrator",
    description: "Full CESCo Depot system administration.",
    permissions: permissionDefinitions.map(([key]) => key),
  },
  {
    key: "CESCO_OPERATIONS_ADMIN",
    name: "CESCo Operations Administrator",
    description: "Manages CESCo operational records, users, and workflows.",
    permissions: [
      "service_location.manage",
      "service_location.view",
      "endpoint.manage",
      "endpoint.view",
      "organization.view",
      "organization.manage",
      "organization.manage_users",
      "service_request.create",
      "service_request.authorize",
      "asset.view",
      "asset.manage",
      "work_order.view",
      "work_order.manage",
      "inventory.receive",
      "shipment.prepare",
      "shipment.manage",
      "shipment.acknowledge_receipt",
      "billing.view",
      "audit.view",
      "evidence.view",
      "evidence.upload",
    ],
  },
  {
    key: "DEPOT_MANAGER",
    name: "Depot Manager",
    description: "Manages depot execution, inventory, and shipments.",
    permissions: [
      "service_location.manage",
      "service_location.view",
      "endpoint.view",
      "organization.view",
      "service_request.create",
      "service_request.authorize",
      "asset.view",
      "asset.manage",
      "work_order.view",
      "work_order.manage",
      "inventory.receive",
      "shipment.prepare",
      "shipment.manage",
      "shipment.acknowledge_receipt",
      "audit.view",
      "evidence.view",
      "evidence.upload",
    ],
  },
  {
    key: "DEPOT_TECHNICIAN",
    name: "Depot Technician",
    description: "Performs and records technical work on assigned assets.",
    permissions: [
      "service_location.view",
      "endpoint.view",
      "organization.view",
      "asset.view",
      "asset.manage",
      "work_order.view",
      "work_order.manage",
      "audit.view",
      "evidence.view",
      "evidence.upload",
    ],
  },
  {
    key: "RECEIVING_LOGISTICS",
    name: "Receiving / Logistics",
    description: "Receives packages, manages storage, and records shipments.",
    permissions: [
      "service_location.manage",
      "service_location.view",
      "endpoint.view",
      "organization.view",
      "asset.view",
      "asset.manage",
      "work_order.view",
      "inventory.receive",
      "shipment.prepare",
      "shipment.manage",
      "shipment.acknowledge_receipt",
      "audit.view",
      "evidence.view",
      "evidence.upload",
    ],
  },
  {
    key: "CLIENT_ADMIN",
    name: "Client Administrator",
    description: "Manages client organization users and operational visibility.",
    permissions: [
      "endpoint.manage",
      "endpoint.view",
      "organization.view",
      "organization.manage",
      "organization.manage_users",
      "service_request.create",
      "service_request.authorize",
      "asset.view",
      "asset.manage",
      "work_order.view",
      "shipment.prepare",
      "shipment.acknowledge_receipt",
      "billing.view",
      "audit.view",
      "evidence.view",
      "evidence.upload",
    ],
  },
  {
    key: "CLIENT_DISPATCHER",
    name: "Client Dispatcher",
    description: "Creates and follows operational service activity.",
    permissions: [
      "endpoint.view",
      "organization.view",
      "service_request.create",
      "asset.view",
      "work_order.view",
      "shipment.prepare",
      "shipment.acknowledge_receipt",
      "evidence.view",
      "evidence.upload",
    ],
  },
  {
    key: "CLIENT_BILLING",
    name: "Client Billing",
    description: "Views billing and related service records.",
    permissions: [
      "endpoint.view",
      "organization.view",
      "asset.view",
      "work_order.view",
      "billing.view",
      "evidence.view",
    ],
  },
  {
    key: "CLIENT_AUDITOR",
    name: "Client Auditor",
    description: "Read-only access to lifecycle and provenance records.",
    permissions: [
      "endpoint.view",
      "organization.view",
      "asset.view",
      "work_order.view",
      "audit.view",
      "evidence.view",
    ],
  },
] as const;

export async function ensureDefaultAccessControl() {
  const permissionMap = new Map<string, { id: string }>();

  for (const [key, description] of permissionDefinitions) {
    const permission = await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
      select: { id: true },
    });

    permissionMap.set(key, permission);
  }

  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { key: definition.key },
      update: {
        name: definition.name,
        description: definition.description,
      },
      create: {
        key: definition.key,
        name: definition.name,
        description: definition.description,
      },
    });

    const allowedPermissionIds = definition.permissions.map(
      (permissionKey) => {
        const permission = permissionMap.get(permissionKey);

        if (!permission) {
          throw new Error(
            `Permission definition missing: ${permissionKey}`
          );
        }

        return permission.id;
      }
    );

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: {
          notIn: allowedPermissionIds,
        },
      },
    });

    for (const permissionKey of definition.permissions) {
      const permission = permissionMap.get(permissionKey);

      if (!permission) {
        throw new Error(
          `Permission definition missing: ${permissionKey}`
        );
      }

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
  }
}
