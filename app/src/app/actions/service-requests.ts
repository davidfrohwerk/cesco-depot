"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUserLabel } from "@/lib/auth";
import { requireOrganizationPermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";
import {
  ReceiptCondition,
  ServiceType,
} from "../../../generated/prisma/client";

function parseOptionalCents(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Spending limit must be a non-negative number.");
  }

  return Math.round(amount * 100);
}

function nextWorkOrderNumber() {
  const year = new Date().getFullYear();
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  return `WO-${year}-${suffix}`;
}

export async function createServiceRequest(
  assetId: string,
  formData: FormData
) {
  const assetForAccess = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { organizationId: true },
  });

  if (!assetForAccess) {
    throw new Error("Asset not found.");
  }

  const user = await requireOrganizationPermission(
    "service_request.create",
    assetForAccess.organizationId
  );
  const userLabel = currentUserLabel(user);
  const serviceType = String(
    formData.get("serviceType") ?? ""
  ).trim() as ServiceType;

  const customerNotes = String(
    formData.get("customerNotes") ?? ""
  ).trim();

  const requestedOutcome = String(
    formData.get("requestedOutcome") ?? ""
  ).trim();

  if (!serviceType) {
    throw new Error("Service type is required.");
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const request = await prisma.$transaction(async (tx) => {
    if (!asset.ownerOrganizationId) {
      await tx.asset.update({
        where: { id: asset.id },
        data: {
          ownerOrganizationId: asset.organizationId,
          currentCustodyType:
            asset.currentCustodyType ?? "CUSTOMER",
        },
      });

      await tx.assetEvent.create({
        data: {
          assetId: asset.id,
          eventType: "OWNERSHIP_BASELINE_RECORDED",
          fromStatus: asset.status,
          toStatus: asset.status,
          actor: userLabel,
          notes:
            "Legacy prototype asset reconciled: account organization recorded as owner before the first service request.",
        },
      });
    }

    return tx.serviceRequest.create({
      data: {
        organizationId: asset.organizationId,
        assetId: asset.id,
        requestedByUserId: user.id,
        serviceType,
        status: "PENDING_AUTHORIZATION",
        customerNotes: customerNotes || null,
        requestedOutcome: requestedOutcome || null,
      },
    });
  });

  revalidatePath(`/assets/${assetId}`);
  redirect(`/service-requests/${request.id}`);
}

export async function authorizeServiceRequest(
  serviceRequestId: string,
  formData: FormData
) {
  const requestForAccess = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: { organizationId: true },
  });

  if (!requestForAccess) {
    throw new Error("Service request not found.");
  }

  const user = await requireOrganizationPermission(
    "service_request.authorize",
    requestForAccess.organizationId
  );
  const scope = String(formData.get("scope") ?? "").trim();
  const spendingLimitCents = parseOptionalCents(
    formData.get("spendingLimit")
  );

  if (!scope) {
    throw new Error("Authorization scope is required.");
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        authorizations: {
          where: { status: "APPROVED" },
        },
      },
    });

    if (!request) {
      throw new Error("Service request not found.");
    }

    if (request.authorizations.length > 0) {
      throw new Error("This service request is already authorized.");
    }

    await tx.authorization.create({
      data: {
        serviceRequestId,
        authorizedByUserId: user.id,
        status: "APPROVED",
        scope,
        spendingLimitCents,
        authorizedAt: new Date(),
        termsVersion: "prototype-v1",
      },
    });

    await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: "AUTHORIZED" },
    });
  });

  revalidatePath(`/service-requests/${serviceRequestId}`);
}

export async function createInboundShipment(
  serviceRequestId: string,
  formData: FormData
) {
  const requestForAccess = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    select: { organizationId: true },
  });

  if (!requestForAccess) {
    throw new Error("Service request not found.");
  }

  await requireOrganizationPermission(
    "shipment.prepare",
    requestForAccess.organizationId
  );

  const carrier = String(formData.get("carrier") ?? "").trim();
  const trackingNumber = String(
    formData.get("trackingNumber") ?? ""
  ).trim();
  const destinationServiceLocationId = String(
    formData.get("destinationServiceLocationId") ?? ""
  ).trim();

  if (!carrier || !trackingNumber || !destinationServiceLocationId) {
    throw new Error(
      "Carrier, tracking number, and service destination are required."
    );
  }

  await prisma.$transaction(async (tx) => {
    const request = await tx.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        asset: true,
        authorizations: {
          where: { status: "APPROVED" },
        },
      },
    });

    if (!request) {
      throw new Error("Service request not found.");
    }

    if (request.authorizations.length === 0) {
      throw new Error(
        "Service request must be authorized before shipment setup."
      );
    }

    const destination = await tx.serviceLocation.findUnique({
      where: { id: destinationServiceLocationId },
      include: {
        clientAccess: {
          where: { organizationId: request.organizationId },
          select: { organizationId: true },
        },
      },
    });

    if (
      !destination ||
      !destination.isActive ||
      destination.clientAccess.length === 0
    ) {
      throw new Error(
        "Selected service location is not available to this organization."
      );
    }

    await tx.shipment.create({
      data: {
        serviceRequestId,
        direction: "INBOUND",
        originEndpointId: request.asset?.currentEndpointId ?? null,
        originServiceLocationId: request.asset?.currentStoragePositionId
          ? (
              await tx.storagePosition.findUnique({
                where: { id: request.asset.currentStoragePositionId },
                select: { serviceLocationId: true },
              })
            )?.serviceLocationId ?? null
          : null,
        destinationServiceLocationId,
        carrier,
        trackingNumber,
        status: "TRACKING_ENTERED",
        packages: {
          create: {
            trackingNumber,
            status: "EXPECTED",
            packageCode: "PKG-1",
            contents: request.assetId
              ? {
                  create: {
                    assetId: request.assetId,
                    description: "Expected service asset",
                    quantity: 1,
                    expected: true,
                  },
                }
              : undefined,
          },
        },
      },
    });

    await tx.serviceRequest.update({
      where: { id: serviceRequestId },
      data: { status: "SHIPMENT_PREPARING" },
    });
  });

  revalidatePath(`/service-requests/${serviceRequestId}`);
}

export async function markShipmentAccepted(shipmentId: string) {
  const shipmentForAccess = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      serviceRequest: {
        select: { organizationId: true },
      },
    },
  });

  if (!shipmentForAccess) {
    throw new Error("Shipment not found.");
  }

  const user = await requireOrganizationPermission(
    "shipment.manage",
    shipmentForAccess.serviceRequest.organizationId
  );
  const userLabel = currentUserLabel(user);

  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        destinationServiceLocation: true,
        destinationSite: true,
        serviceRequest: {
          include: {
            asset: true,
            workOrders: {
              where: { shipmentId },
            },
          },
        },
      },
    });

    if (!shipment) {
      throw new Error("Shipment not found.");
    }

    if (shipment.status === "IN_TRANSIT") {
      return {
        serviceRequestId: shipment.serviceRequestId,
        assetId: shipment.serviceRequest.assetId,
      };
    }

    if (shipment.status !== "TRACKING_ENTERED") {
      throw new Error(
        "Shipment must have tracking entered before carrier acceptance."
      );
    }

    const asset = shipment.serviceRequest.asset;

    if (!asset) {
      throw new Error(
        "An asset must be associated with the service request before shipment acceptance."
      );
    }

    if (shipment.serviceRequest.workOrders.length > 0) {
      throw new Error(
        "A work order already exists for this shipment."
      );
    }

    const now = new Date();
    const carrierLabel = shipment.carrier ?? "Inbound carrier";

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "IN_TRANSIT",
        acceptedAt: now,
        shippedAt: shipment.shippedAt ?? now,
      },
    });

    await tx.package.updateMany({
      where: { shipmentId: shipment.id },
      data: { status: "IN_TRANSIT" },
    });

    await tx.serviceRequest.update({
      where: { id: shipment.serviceRequestId },
      data: { status: "IN_TRANSIT" },
    });

    await tx.assetMovement.create({
      data: {
        assetId: asset.id,
        actorUserId: user.id,
        fromEndpointId: asset.currentEndpointId,
        fromStoragePositionId: asset.currentStoragePositionId,
        toEndpointId: null,
        toStoragePositionId: null,
        fromCustodyType: asset.currentCustodyType,
        toCustodyType: "CARRIER",
        fromCustodianLabel: asset.currentCustodianLabel,
        toCustodianLabel: carrierLabel,
        reason: shipment.trackingNumber
          ? `Inbound carrier acceptance; tracking ${shipment.trackingNumber}.`
          : "Inbound carrier acceptance.",
        occurredAt: now,
      },
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "IN_TRANSIT_TO_DEPOT",
        currentEndpointId: null,
        currentStoragePositionId: null,
        currentStorageLocationId: null,
        siteId: null,
        currentCustodyType: "CARRIER",
        currentCustodianLabel: carrierLabel,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "SHIPMENT_ACCEPTED_BY_CARRIER",
        fromStatus: asset.status,
        toStatus: "IN_TRANSIT_TO_DEPOT",
        actor: userLabel,
        notes: shipment.trackingNumber
          ? `Inbound shipment accepted by ${shipment.carrier ?? "carrier"}; tracking ${shipment.trackingNumber}.`
          : "Inbound shipment accepted by carrier.",
      },
    });

    const workOrder = await tx.workOrder.create({
      data: {
        assetId: asset.id,
        organizationId: shipment.serviceRequest.organizationId,
        serviceRequestId: shipment.serviceRequestId,
        shipmentId: shipment.id,
        number: nextWorkOrderNumber(),
        status: "IN_TRANSIT",
        serviceType: shipment.serviceRequest.serviceType,
        reportedIssue:
          shipment.serviceRequest.customerNotes ?? null,
        openedAt: now,
      },
    });

    const destinationLabel =
      shipment.destinationServiceLocation?.name ??
      shipment.destinationSite?.name ??
      "service destination";

    await tx.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        eventType: "WORK_ORDER_OPENED",
        fromStatus: null,
        toStatus: "IN_TRANSIT",
        actorUserId: user.id,
        actorLabel: userLabel,
        systemGenerated: false,
        notes: shipment.trackingNumber
          ? `Work order opened when carrier acceptance was confirmed for tracking ${shipment.trackingNumber}; destination ${destinationLabel}.`
          : `Work order opened when carrier acceptance was confirmed; destination ${destinationLabel}.`,
      },
    });

    return {
      serviceRequestId: shipment.serviceRequestId,
      assetId: asset.id,
    };
  });

  revalidatePath(
    `/service-requests/${result.serviceRequestId}`
  );

  if (result.assetId) {
    revalidatePath(`/assets/${result.assetId}`);
  }
}

export async function receiveInboundPackage(
  packageId: string,
  formData: FormData
) {
  const packageForAccess = await prisma.package.findUnique({
    where: { id: packageId },
    select: {
      shipment: {
        select: {
          serviceRequest: {
            select: { organizationId: true },
          },
        },
      },
    },
  });

  if (!packageForAccess) {
    throw new Error("Package not found.");
  }

  const user = await requireOrganizationPermission(
    "inventory.receive",
    packageForAccess.shipment.serviceRequest.organizationId
  );
  const userLabel = currentUserLabel(user);
  const storagePositionId = String(
    formData.get("storagePositionId") ?? ""
  ).trim();
  const legacyStorageLocationId = String(
    formData.get("storageLocationId") ?? ""
  ).trim();

  const condition = String(
    formData.get("condition") ?? "UNKNOWN"
  ).trim() as ReceiptCondition;

  const sealValue = String(
    formData.get("sealIntact") ?? ""
  ).trim();

  const notes = String(formData.get("notes") ?? "").trim();

  if (!storagePositionId && !legacyStorageLocationId) {
    throw new Error("A receiving storage position is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const pkg = await tx.package.findUnique({
      where: { id: packageId },
      include: {
        receipt: true,
        contents: true,
        shipment: {
          include: {
            destinationServiceLocation: true,
            destinationSite: true,
            serviceRequest: {
              include: {
                asset: true,
              },
            },
          },
        },
      },
    });

    if (!pkg) {
      throw new Error("Package not found.");
    }

    if (pkg.receipt) {
      return {
        serviceRequestId: pkg.shipment.serviceRequestId,
        assetId: pkg.shipment.serviceRequest.assetId,
      };
    }

    if (
      pkg.shipment.status !== "IN_TRANSIT" &&
      pkg.shipment.status !== "PARTIALLY_RECEIVED"
    ) {
      throw new Error(
        "Package can only be received from an in-transit shipment."
      );
    }

    const storagePosition =
      pkg.shipment.destinationServiceLocationId && storagePositionId
        ? await tx.storagePosition.findUnique({
            where: { id: storagePositionId },
            include: {
              serviceLocation: {
                include: {
                  clientAccess: {
                    where: {
                      organizationId:
                        pkg.shipment.serviceRequest.organizationId,
                    },
                    select: { organizationId: true },
                  },
                },
              },
            },
          })
        : null;

    const legacyStorageLocation =
      !pkg.shipment.destinationServiceLocationId &&
      pkg.shipment.destinationSiteId &&
      legacyStorageLocationId
        ? await tx.storageLocation.findUnique({
            where: { id: legacyStorageLocationId },
            include: { site: true },
          })
        : null;

    if (pkg.shipment.destinationServiceLocationId) {
      if (
        !storagePosition ||
        !storagePosition.isActive ||
        storagePosition.serviceLocationId !==
          pkg.shipment.destinationServiceLocationId
      ) {
        throw new Error(
          "Receiving position must belong to the shipment destination service location."
        );
      }

      if (
        storagePosition.dedicatedOrganizationId &&
        storagePosition.dedicatedOrganizationId !==
          pkg.shipment.serviceRequest.organizationId
      ) {
        throw new Error(
          "Receiving position is dedicated to another client organization."
        );
      }

      if (
        !storagePosition.dedicatedOrganizationId &&
        storagePosition.serviceLocation.clientAccess.length === 0
      ) {
        throw new Error(
          "Shipment organization is not authorized to use this shared service location."
        );
      }
    } else if (
      !legacyStorageLocation ||
      legacyStorageLocation.siteId !== pkg.shipment.destinationSiteId
    ) {
      throw new Error(
        "Legacy receiving location must belong to the shipment destination site."
      );
    }

    const asset = pkg.shipment.serviceRequest.asset;

    if (!asset) {
      throw new Error(
        "Service request must have an asset before package receipt."
      );
    }

    if (!pkg.contents.some((content) => content.assetId === asset.id)) {
      await tx.packageContent.create({
        data: {
          packageId: pkg.id,
          assetId: asset.id,
          description: "Received service asset",
          quantity: 1,
          expected: true,
        },
      });
    }

    const now = new Date();
    const serviceLocation = storagePosition?.serviceLocation ?? null;
    const destinationLabel =
      serviceLocation?.name ??
      legacyStorageLocation?.site.name ??
      pkg.shipment.destinationSite?.name ??
      "service destination";
    const positionLabel =
      storagePosition?.name ??
      legacyStorageLocation?.name ??
      "receiving location";
    const custodyType =
      serviceLocation?.custodyType ?? "CESCO";
    const custodianLabel =
      serviceLocation?.custodianLabel ??
      serviceLocation?.operatorLabel ??
      serviceLocation?.name ??
      "CESCo";

    await tx.receipt.create({
      data: {
        packageId: pkg.id,
        receivedByUserId: user.id,
        storagePositionId: storagePosition?.id ?? null,
        storageLocationId: legacyStorageLocation?.id ?? null,
        receivedAt: now,
        condition,
        sealIntact:
          sealValue === "true"
            ? true
            : sealValue === "false"
              ? false
              : null,
        notes: notes || null,
      },
    });

    await tx.package.update({
      where: { id: pkg.id },
      data: { status: "RECEIVED" },
    });

    const remainingPackages = await tx.package.count({
      where: {
        shipmentId: pkg.shipmentId,
        status: { not: "RECEIVED" },
      },
    });

    const shipmentComplete = remainingPackages === 0;

    await tx.shipment.update({
      where: { id: pkg.shipmentId },
      data: {
        status: shipmentComplete
          ? "RECEIVED"
          : "PARTIALLY_RECEIVED",
        deliveredAt: shipmentComplete ? now : null,
      },
    });

    if (shipmentComplete) {
      await tx.serviceRequest.update({
        where: { id: pkg.shipment.serviceRequestId },
        data: { status: "RECEIVED" },
      });

      const shipmentWorkOrders = await tx.workOrder.findMany({
        where: { shipmentId: pkg.shipmentId },
      });

      await tx.workOrder.updateMany({
        where: { shipmentId: pkg.shipmentId },
        data: { status: "RECEIVED" },
      });

      for (const workOrder of shipmentWorkOrders) {
        await tx.workOrderEvent.create({
          data: {
            workOrderId: workOrder.id,
            eventType: "PACKAGE_RECEIVED",
            fromStatus: workOrder.status,
            toStatus: "RECEIVED",
            actorUserId: user.id,
            actorLabel: userLabel,
            systemGenerated: false,
            notes: [
              `Package received at ${destinationLabel}.`,
              `Condition: ${condition}.`,
              `Position: ${positionLabel}.`,
            ].join(" "),
          },
        });
      }
    }

    await tx.assetMovement.create({
      data: {
        assetId: asset.id,
        actorUserId: user.id,
        fromEndpointId: asset.currentEndpointId,
        fromStoragePositionId: asset.currentStoragePositionId,
        toEndpointId: null,
        toStoragePositionId: storagePosition?.id ?? null,
        fromCustodyType: asset.currentCustodyType,
        toCustodyType: custodyType,
        fromCustodianLabel: asset.currentCustodianLabel,
        toCustodianLabel: custodianLabel,
        reason: `Package received at ${destinationLabel}; position ${positionLabel}.`,
        occurredAt: now,
      },
    });

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "RECEIVED",
        currentEndpointId: null,
        currentStoragePositionId: storagePosition?.id ?? null,
        currentStorageLocationId:
          legacyStorageLocation?.id ?? null,
        siteId:
          legacyStorageLocation?.siteId ?? null,
        currentCustodyType: custodyType,
        currentCustodianLabel: custodianLabel,
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "PACKAGE_RECEIVED",
        fromStatus: asset.status,
        toStatus: "RECEIVED",
        actor: userLabel,
        notes: [
          `Package received at ${destinationLabel}.`,
          `Condition: ${condition}.`,
          `Position: ${positionLabel}.`,
          notes ? `Receiving note: ${notes}` : null,
        ]
          .filter(Boolean)
          .join(" "),
      },
    });

    return {
      serviceRequestId: pkg.shipment.serviceRequestId,
      assetId: asset.id,
    };
  });

  revalidatePath(
    `/service-requests/${result.serviceRequestId}`
  );

  if (result.assetId) {
    revalidatePath(`/assets/${result.assetId}`);
  }
}

