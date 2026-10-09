"use server";

import { revalidatePath } from "next/cache";
import { currentUserLabel } from "@/lib/auth";
import { requireOrganizationPermission } from "@/lib/access-scope";
import { prisma } from "@/lib/prisma";

async function caseForAction(caseId: string) {
  const externalCase = await prisma.externalServiceCase.findUnique({
    where: { id: caseId },
    include: {
      serviceRequest: true,
      workOrder: true,
      asset: {
        include: {
          currentStoragePosition: {
            select: { serviceLocationId: true },
          },
        },
      },
      shipments: true,
    },
  });

  if (!externalCase) {
    throw new Error("External service case not found.");
  }

  return externalCase;
}

export async function createExternalServiceShipment(
  caseId: string,
  leg: "TO_PROVIDER" | "FROM_PROVIDER",
  formData: FormData
) {
  const externalCase = await caseForAction(caseId);

  await requireOrganizationPermission(
    "shipment.prepare",
    externalCase.serviceRequest.organizationId
  );

  const carrier = String(formData.get("carrier") ?? "").trim();
  const trackingNumber = String(
    formData.get("trackingNumber") ?? ""
  ).trim();

  if (!carrier || !trackingNumber) {
    throw new Error("Carrier and tracking number are required.");
  }

  if (
    externalCase.shipments.some(
      (shipment) =>
        shipment.externalServiceLeg === leg &&
        shipment.status !== "CANCELLED"
    )
  ) {
    throw new Error(
      `A ${leg === "TO_PROVIDER" ? "provider-bound" : "return"} shipment already exists for this case.`
    );
  }

  let destinationEndpointId: string | null = null;
  let destinationServiceLocationId: string | null = null;

  if (leg === "TO_PROVIDER") {
    if (externalCase.status !== "PLANNED") {
      throw new Error(
        "Provider-bound shipment can only be created for a planned external service case."
      );
    }
  } else {
    if (externalCase.status !== "AT_PROVIDER") {
      throw new Error(
        "Return shipment can only be created after the provider has received the asset."
      );
    }

    const combinedDestination = String(
      formData.get("returnDestination") ?? ""
    ).trim();
    const legacyDestinationType = String(
      formData.get("returnDestinationType") ?? ""
    ).trim();
    const legacyDestinationId = String(
      formData.get("returnDestinationId") ?? ""
    ).trim();

    const separatorIndex = combinedDestination.indexOf(":");
    const destinationType =
      separatorIndex > 0
        ? combinedDestination.slice(0, separatorIndex)
        : legacyDestinationType;
    const returnDestinationId =
      separatorIndex > 0
        ? combinedDestination.slice(separatorIndex + 1)
        : legacyDestinationId;

    if (!destinationType || !returnDestinationId) {
      throw new Error("A return destination is required.");
    }

    if (destinationType === "ENDPOINT") {
      const endpoint = await prisma.endpoint.findFirst({
        where: {
          id: returnDestinationId,
          organizationId:
            externalCase.serviceRequest.organizationId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!endpoint) {
        throw new Error(
          "Return endpoint is not available to this organization."
        );
      }

      destinationEndpointId = endpoint.id;
    } else if (destinationType === "SERVICE_LOCATION") {
      const serviceLocation =
        await prisma.serviceLocation.findFirst({
          where: {
            id: returnDestinationId,
            isActive: true,
            clientAccess: {
              some: {
                organizationId:
                  externalCase.serviceRequest.organizationId,
              },
            },
          },
          select: { id: true },
        });

      if (!serviceLocation) {
        throw new Error(
          "Return service location is not available to this organization."
        );
      }

      destinationServiceLocationId = serviceLocation.id;
    } else {
      throw new Error("Return destination type is invalid.");
    }
  }

  await prisma.shipment.create({
    data: {
      serviceRequestId: externalCase.serviceRequestId,
      externalServiceCaseId: externalCase.id,
      externalServiceLeg: leg,
      direction: leg === "TO_PROVIDER" ? "OUTBOUND" : "INBOUND",
      originEndpointId:
        leg === "TO_PROVIDER"
          ? externalCase.asset.currentEndpointId
          : null,
      originServiceLocationId:
        leg === "TO_PROVIDER"
          ? externalCase.asset.currentStoragePosition
              ?.serviceLocationId ?? null
          : null,
      destinationEndpointId,
      destinationServiceLocationId,
      carrier,
      trackingNumber,
      status: "TRACKING_ENTERED",
      packages: {
        create: {
          packageCode:
            leg === "TO_PROVIDER"
              ? "EXT-OUT-1"
              : "EXT-RETURN-1",
          trackingNumber,
          status: "EXPECTED",
          contents: {
            create: {
              assetId: externalCase.assetId,
              description:
                leg === "TO_PROVIDER"
                  ? "Asset routed to external service provider"
                  : "Asset returning from external service provider",
              quantity: 1,
              expected: true,
            },
          },
        },
      },
    },
  });

  revalidatePath(
    `/service-requests/${externalCase.serviceRequestId}`
  );
}

export async function acceptExternalServiceShipment(
  shipmentId: string
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      externalServiceCase: {
        include: {
          serviceRequest: true,
          workOrder: true,
          asset: true,
        },
      },
    },
  });

  if (
    !shipment ||
    !shipment.externalServiceCase ||
    !shipment.externalServiceLeg
  ) {
    throw new Error("External service shipment not found.");
  }

  const externalCase = shipment.externalServiceCase;
  const user = await requireOrganizationPermission(
    "shipment.manage",
    externalCase.serviceRequest.organizationId
  );
  const actorLabel = currentUserLabel(user);

  if (shipment.status !== "TRACKING_ENTERED") {
    throw new Error(
      "Tracking must be entered before carrier acceptance."
    );
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const caseStatus =
      shipment.externalServiceLeg === "TO_PROVIDER"
        ? "TO_PROVIDER_IN_TRANSIT"
        : "RETURN_IN_TRANSIT";

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

    await tx.externalServiceCase.update({
      where: { id: externalCase.id },
      data: {
        status: caseStatus,
        returnStartedAt:
          shipment.externalServiceLeg === "FROM_PROVIDER"
            ? now
            : externalCase.returnStartedAt,
      },
    });

    await tx.assetMovement.create({
      data: {
        assetId: externalCase.assetId,
        actorUserId: user.id,
        fromEndpointId: externalCase.asset.currentEndpointId,
        fromStoragePositionId:
          externalCase.asset.currentStoragePositionId,
        fromCustodyType:
          externalCase.asset.currentCustodyType,
        fromCustodianLabel:
          externalCase.asset.currentCustodianLabel,
        toCustodyType: "CARRIER",
        toCustodianLabel: shipment.carrier ?? "Carrier",
        reason: `${shipment.externalServiceLeg === "TO_PROVIDER" ? "External service outbound" : "External service return"} carrier acceptance; tracking ${shipment.trackingNumber ?? "not recorded"}.`,
        occurredAt: now,
      },
    });

    await tx.asset.update({
      where: { id: externalCase.assetId },
      data: {
        status: "IN_TRANSIT_EXTERNAL_SERVICE",
        currentEndpointId: null,
        currentStoragePositionId: null,
        currentStorageLocationId: null,
        siteId: null,
        currentCustodyType: "CARRIER",
        currentCustodianLabel:
          shipment.carrier ?? "Carrier",
      },
    });

    await tx.assetEvent.create({
      data: {
        assetId: externalCase.assetId,
        eventType:
          shipment.externalServiceLeg === "TO_PROVIDER"
            ? "EXTERNAL_SERVICE_OUTBOUND_ACCEPTED"
            : "EXTERNAL_SERVICE_RETURN_ACCEPTED",
        fromStatus: externalCase.asset.status,
        toStatus: "IN_TRANSIT_EXTERNAL_SERVICE",
        actor: actorLabel,
        notes: `Carrier ${shipment.carrier ?? "carrier"} accepted tracking ${shipment.trackingNumber ?? "not recorded"}.`,
      },
    });

    await tx.workOrderEvent.create({
      data: {
        workOrderId: externalCase.workOrderId,
        eventType:
          shipment.externalServiceLeg === "TO_PROVIDER"
            ? "EXTERNAL_SERVICE_OUTBOUND_ACCEPTED"
            : "EXTERNAL_SERVICE_RETURN_ACCEPTED",
        fromStatus: externalCase.workOrder.status,
        toStatus: externalCase.workOrder.status,
        actorUserId: user.id,
        actorLabel,
        notes: `Tracking ${shipment.trackingNumber ?? "not recorded"} accepted by ${shipment.carrier ?? "carrier"}.`,
      },
    });
  });

  revalidatePath(
    `/service-requests/${externalCase.serviceRequestId}`
  );
  revalidatePath(`/assets/${externalCase.assetId}`);
}

export async function confirmExternalServiceShipmentDelivery(
  shipmentId: string
) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      externalServiceCase: {
        include: {
          serviceRequest: true,
          workOrder: true,
          asset: true,
        },
      },
      destinationEndpoint: true,
    },
  });

  if (
    !shipment ||
    !shipment.externalServiceCase ||
    !shipment.externalServiceLeg
  ) {
    throw new Error("External service shipment not found.");
  }

  const externalCase = shipment.externalServiceCase;
  const user = await requireOrganizationPermission(
    "shipment.manage",
    externalCase.serviceRequest.organizationId
  );
  const actorLabel = currentUserLabel(user);

  if (shipment.status !== "IN_TRANSIT") {
    throw new Error(
      "Only an in-transit external service shipment can be delivered."
    );
  }

  if (
    shipment.externalServiceLeg === "FROM_PROVIDER" &&
    shipment.destinationServiceLocationId
  ) {
    throw new Error(
      "Returns to a CESCo/partner service location must be received into a storage position."
    );
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();

    await tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "DELIVERED",
        deliveredAt: now,
      },
    });

    await tx.package.updateMany({
      where: { shipmentId: shipment.id },
      data: { status: "DELIVERED" },
    });

    if (shipment.externalServiceLeg === "TO_PROVIDER") {
      await tx.externalServiceCase.update({
        where: { id: externalCase.id },
        data: {
          status: "AT_PROVIDER",
          receivedByProviderAt: now,
        },
      });

      await tx.assetMovement.create({
        data: {
          assetId: externalCase.assetId,
          actorUserId: user.id,
          fromCustodyType: externalCase.asset.currentCustodyType,
          fromCustodianLabel:
            externalCase.asset.currentCustodianLabel,
          toCustodyType: "PARTNER",
          toCustodianLabel: externalCase.providerName,
          reason: `Delivered to external service provider ${externalCase.providerName}.`,
          occurredAt: now,
        },
      });

      await tx.asset.update({
        where: { id: externalCase.assetId },
        data: {
          status: "IN_EXTERNAL_SERVICE",
          currentCustodyType: "PARTNER",
          currentCustodianLabel:
            externalCase.providerName,
        },
      });

      await tx.assetEvent.create({
        data: {
          assetId: externalCase.assetId,
          eventType: "EXTERNAL_SERVICE_PROVIDER_RECEIVED",
          fromStatus: externalCase.asset.status,
          toStatus: "IN_EXTERNAL_SERVICE",
          actor: actorLabel,
          notes: [
            `Provider: ${externalCase.providerName}.`,
            externalCase.providerCaseReference
              ? `Case/RMA: ${externalCase.providerCaseReference}.`
              : null,
          ]
            .filter(Boolean)
            .join(" "),
        },
      });
    } else {
      const endpoint = shipment.destinationEndpoint;

      if (!endpoint) {
        throw new Error(
          "External return delivery requires a customer endpoint destination or service-location receipt."
        );
      }

      await tx.externalServiceCase.update({
        where: { id: externalCase.id },
        data: {
          status: "RETURNED",
          returnedAt: now,
        },
      });

      await tx.assetMovement.create({
        data: {
          assetId: externalCase.assetId,
          actorUserId: user.id,
          toEndpointId: endpoint.id,
          fromCustodyType: externalCase.asset.currentCustodyType,
          fromCustodianLabel:
            externalCase.asset.currentCustodianLabel,
          toCustodyType: "CUSTOMER",
          toCustodianLabel:
            externalCase.serviceRequest.organizationId,
          reason: `External service return delivered to ${endpoint.name}.`,
          occurredAt: now,
        },
      });

      await tx.asset.update({
        where: { id: externalCase.assetId },
        data: {
          status: "DELIVERED",
          currentEndpointId: endpoint.id,
          currentStoragePositionId: null,
          currentStorageLocationId: null,
          siteId: null,
          currentCustodyType: "CUSTOMER",
          currentCustodianLabel: endpoint.name,
        },
      });

      await tx.workOrder.update({
        where: { id: externalCase.workOrderId },
        data: {
          status: "COMPLETED",
          completedAt: now,
        },
      });

      await tx.serviceRequest.update({
        where: { id: externalCase.serviceRequestId },
        data: { status: "COMPLETED" },
      });

      await tx.workOrderEvent.create({
        data: {
          workOrderId: externalCase.workOrderId,
          eventType: "EXTERNAL_SERVICE_RETURNED_TO_ENDPOINT",
          fromStatus: externalCase.workOrder.status,
          toStatus: "COMPLETED",
          actorUserId: user.id,
          actorLabel,
          notes: `External service return delivered to ${endpoint.name}; tracking ${shipment.trackingNumber ?? "not recorded"}.`,
        },
      });

      await tx.assetEvent.create({
        data: {
          assetId: externalCase.assetId,
          eventType: "EXTERNAL_SERVICE_RETURNED_TO_ENDPOINT",
          fromStatus: externalCase.asset.status,
          toStatus: "DELIVERED",
          actor: actorLabel,
          notes: `Returned from ${externalCase.providerName} to ${endpoint.name}.`,
        },
      });
    }
  });

  revalidatePath(
    `/service-requests/${externalCase.serviceRequestId}`
  );
  revalidatePath(`/assets/${externalCase.assetId}`);
}
