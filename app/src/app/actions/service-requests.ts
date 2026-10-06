"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ServiceType } from "../../../generated/prisma/client";

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
          actor: "system",
          notes:
            "Legacy prototype asset reconciled: account organization recorded as owner before the first service request.",
        },
      });
    }

    return tx.serviceRequest.create({
      data: {
        organizationId: asset.organizationId,
        assetId: asset.id,
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
  const carrier = String(formData.get("carrier") ?? "").trim();
  const trackingNumber = String(
    formData.get("trackingNumber") ?? ""
  ).trim();
  const destinationSiteId = String(
    formData.get("destinationSiteId") ?? ""
  ).trim();

  if (!carrier || !trackingNumber || !destinationSiteId) {
    throw new Error(
      "Carrier, tracking number, and destination are required."
    );
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

    if (request.authorizations.length === 0) {
      throw new Error(
        "Service request must be authorized before shipment setup."
      );
    }

    const destination = await tx.site.findUnique({
      where: { id: destinationSiteId },
    });

    if (!destination) {
      throw new Error("Destination site not found.");
    }

    await tx.shipment.create({
      data: {
        serviceRequestId,
        destinationSiteId,
        carrier,
        trackingNumber,
        status: "TRACKING_ENTERED",
        packages: {
          create: {
            trackingNumber,
            status: "EXPECTED",
            packageCode: "PKG-1",
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
  const result = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      include: {
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

    await tx.asset.update({
      where: { id: asset.id },
      data: {
        status: "IN_TRANSIT_TO_DEPOT",
        currentCustodyType: "CARRIER",
        currentCustodianLabel:
          shipment.carrier ?? "Inbound carrier",
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: asset.id,
        eventType: "SHIPMENT_ACCEPTED_BY_CARRIER",
        fromStatus: asset.status,
        toStatus: "IN_TRANSIT_TO_DEPOT",
        actor: "system",
        notes: shipment.trackingNumber
          ? `Inbound shipment accepted by ${shipment.carrier ?? "carrier"}; tracking ${shipment.trackingNumber}.`
          : "Inbound shipment accepted by carrier.",
      },
    });

    await tx.workOrder.create({
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
