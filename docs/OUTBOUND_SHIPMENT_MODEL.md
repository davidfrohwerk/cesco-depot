# Outbound Return and Delivery Model

This slice extends CESCo Depot from READY into outbound return, redeployment, and delivery.

## Why a schema change is required

The existing Shipment model was effectively inbound-only. Once the same ServiceRequest can have both an inbound and outbound shipment, the system must distinguish shipment direction or the UI and workflow will eventually confuse the two.

This slice adds:

- ShipmentDirection: INBOUND / OUTBOUND / TRANSFER
- Shipment.originSiteId
- Shipment.direction
- ShipmentStatus.DELIVERED
- PackageStatus.DELIVERED
- AssetStatus.DELIVERED

Existing shipment records remain valid because direction defaults to INBOUND and originSiteId is optional.

## Intended outbound workflow

READY
-> PACKED
-> outbound Shipment created
-> carrier accepts package
-> WorkOrder OUTBOUND
-> Asset DISPATCHED
-> carrier delivers package
-> Shipment DELIVERED
-> WorkOrder COMPLETED
-> ServiceRequest COMPLETED
-> Asset DELIVERED
-> custody returns to CUSTOMER

The asset is **not** automatically marked INSTALLED at delivery. Delivery and installation are separate facts.

## Destination rule

The first outbound implementation will require a destination Site already associated with the customer/owner organization.

This keeps the first return-to-customer workflow deterministic and auditable.

Ad-hoc external addresses can be added later without weakening the core lifecycle.

## Migration

After pulling this change:

```bash
cd /opt/cesco/depot/app
npx prisma format
npx prisma validate
npx prisma migrate dev --name outbound_shipment_foundation
npx prisma generate
npm run build
```

The next application change will add packing, outbound shipment creation, carrier acceptance, and delivery confirmation to the work-order page.
