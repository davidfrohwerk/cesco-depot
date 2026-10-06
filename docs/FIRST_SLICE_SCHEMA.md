# First-Slice Schema Review

This document explains the first implementation slice added to `app/prisma/schema.prisma` for the CESCo Depot operational intake foundation.

## Scope of this slice

The schema change is intentionally limited to the front door of the service cycle:

1. User and organization membership foundation
2. Roles and permissions
3. Service request
4. Customer authorization
5. Shipment
6. Package
7. Receipt
8. Storage location
9. Ownership/custody/current-location fields on Asset
10. Work-order linkage to service request and shipment

It does **not** yet implement the full work-execution, evidence, labor, parts, or billing model.

## Identity

### User
Represents one human identity.

Fields include:
- unique email
- display name
- lifecycle status: invited / active / disabled

Historical users should be disabled instead of deleted.

### Membership
Connects a User to an Organization.

A single user may belong to multiple organizations.

### Role / Permission
Roles are named bundles of atomic permissions.

MembershipRole and RolePermission provide many-to-many assignment without hard-coding permissions directly into users.

Authentication itself is deliberately not implemented by this migration. This is the authorization/data foundation only.

## ServiceRequest

Represents the customer's desired outcome before operational work begins.

Examples:
- repair
- diagnose
- test
- strategic stock
- reconfigure
- decommission
- donate
- recycle

A request may be created before a shipment exists.

No operational work order is created merely because a ServiceRequest exists.

## Authorization

Records what the customer approved.

It may include:
- approved scope
- spending ceiling
- currency
- terms version
- authorization timestamp
- expiration

The data model deliberately separates authorization from execution.

## Shipment

Represents the inbound movement associated with a ServiceRequest.

Important states include:
- PREPARING
- LABEL_CREATED
- TRACKING_ENTERED
- IN_TRANSIT
- PARTIALLY_RECEIVED
- RECEIVED
- EXCEPTION

A tracking number can exist before the shipment is considered committed.

The application workflow should create the WorkOrder when carrier acceptance is confirmed, not when tracking is merely entered.

## Package

Shipment and Package are separate.

A Shipment may contain multiple packages.

A Package may contain:
- one asset
- multiple assets
- accessories
- parts
- unexpected contents

PackageContent connects package contents to known Asset records when possible while also allowing descriptive unknown contents.

## Receipt

A Receipt represents physical receipt of one package.

It records:
- who received it
- when
- package condition
- seal state
- receiving/storage location
- notes

Evidence/photos will be added in the work-execution/evidence slice rather than embedding file logic here.

## StorageLocation

StorageLocation is hierarchical.

Examples:

Indianapolis Depot
-> Receiving
-> Intake Cage
-> Rack 2
-> Shelf B
-> Position 4

Storage locations can represent:
- receiving area
- cage
- room
- rack
- shelf
- bin
- pallet position
- bench
- floor position

The model supports capacity and security metadata without attempting to become a full warehouse-management system.

## Asset changes

The existing Asset model is preserved.

New fields add explicit operational dimensions:

- `ownerOrganizationId`
- `currentStorageLocationId`
- `currentCustodyType`
- `currentCustodianLabel`

The existing `organizationId` remains the account/customer organization associated with the asset.

This distinction is intentional:

- account organization is not necessarily legal owner forever
- legal owner is not the same as physical custodian
- custodian is not the same as location

Existing prototype assets will initially have null values for the new ownership/custody/location fields until they are populated by the new intake workflow.

## WorkOrder changes

The WorkOrder status model is expanded to reflect operational reality.

Examples:
- IN_TRANSIT
- AWAITING_RECEIPT
- RECEIVED
- INTAKE
- IN_PROGRESS
- WAITING_PARTS
- WAITING_CUSTOMER_AUTHORIZATION
- TESTING
- READY
- PACKED
- OUTBOUND
- COMPLETED

WorkOrder now may reference:
- organization
- ServiceRequest
- Shipment
- ServiceType

The asset relation remains required.

This allows a future application transaction to create a WorkOrder automatically when shipment carrier acceptance occurs.

## Deliberately deferred

The following are **not** part of this migration:

- WorkOrderEvent
- WorkActivity / labor
- AssetObservation
- Evidence
- WorkOrderPart
- detailed custody history
- detailed location history
- title-transfer history
- Estimate / Charge / Invoice / Payment
- strategic-stocking readiness records
- authentication/session implementation

Those belong in later coherent slices instead of being partially implemented now.

## Migration safety

The changes are intended to preserve the existing prototype data:

- existing Organization/Site/Asset records remain
- new Asset fields are nullable
- existing WorkOrder relations added in this slice are nullable
- existing `OPEN`, `IN_PROGRESS`, `WAITING_PARTS`, `TESTING`, `COMPLETED`, and `CANCELLED` work-order statuses remain valid

Before creating the migration, run:

```bash
npx prisma format
npx prisma validate
```

Only after validation succeeds should the development migration be generated.

Recommended migration name:

```text
operational_intake_foundation
```

## Acceptance target after application code is added

A customer should eventually be able to:

1. register/select an asset
2. create a service request
3. authorize it
4. enter tracking
5. have no WorkOrder yet
6. confirm carrier acceptance
7. have the WorkOrder open automatically as IN_TRANSIT
8. receive the package
9. record package condition
10. confirm the contained asset
11. record customer ownership
12. record CESCo custody
13. assign a physical storage location

At that point the system should be able to answer:

- who owns the asset
- who currently has custody
- where it physically is
- what shipment it arrived on
- what service was requested
- what was authorized
- what work-order state it is in
