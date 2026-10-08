# CESCo Depot Service Blueprint and Domain Model

## Purpose

This document converts the CESCo Depot product principles into an end-to-end operating blueprint and a domain model suitable for the next database/schema revision.

The objective is to preserve the central customer value proposition throughout the workflow:

> Know what you have, where it is, what condition it is in, and what happens next.

The platform should combine physical service execution with a persistent digital record of ownership, custody, condition, work, evidence, labor, movement, authorization, and billing.

---

# 1. End-to-end customer service lifecycle

## Stage 0 - Prospect and account creation

### Customer actions
- Creates a free account.
- Creates or joins an organization.
- Invites additional users if authorized.
- Adds billing/contact information as needed.

### CESCo system behavior
- No work order is created.
- No service charge is created.
- Customer can explore service options and register assets.
- Organization, user memberships, and access scope are established.

### Value
- Low-friction entry.
- Customer can begin organizing assets before paying.
- CESCo does not create operational obligations merely because someone registered.

---

## Stage 1 - Service request

### Customer actions
Customer chooses an outcome for an asset, for example:

- Diagnose
- Repair
- Test
- Reconfigure / reimage
- Store as strategic spare
- Redeploy
- Ship elsewhere
- Decommission
- Data destruction
- Donate to CESCo
- Recycle / disposition

The customer either:
- selects an existing asset, or
- registers a new asset.

### CESCo system behavior
Creates a ServiceRequest in DRAFT state.

The request records:
- customer organization
- asset or expected asset
- requested service type
- requested destination/disposition
- customer notes
- service priority
- any SLA/contract context
- initial estimate if available

### Value
The portal begins with the customer's desired outcome, not internal depot terminology.

---

## Stage 2 - Authorization

### Customer actions
Customer approves:
- service scope
- estimate or price basis
- spending ceiling if required
- shipping responsibility
- disposition authority
- special handling terms

### CESCo system behavior
Creates an Authorization record linked to the request.

Authorization must record:
- who approved it
- what they approved
- monetary ceiling if applicable
- date/time
- expiration if applicable
- terms/version accepted

Authorization and execution remain separate.

### Value
Prevents ambiguity over what CESCo is permitted to do with property it does not own.

---

## Stage 3 - Shipment preparation

### Customer actions
- Requests a CESCo label, or
- enters a customer-provided tracking number.
- selects or confirms the shipping origin.
- confirms package count where known.

### CESCo system behavior
Creates a Shipment record in PREPARING or LABEL_CREATED state.

The routing engine selects a destination based on:
- requested service
- customer contract
- depot capabilities
- stocking region
- capacity
- geography
- special handling requirements

### Important rule
Typing a tracking number does not open the operational work order.

### Value
Customers are routed to the correct service location without needing to understand CESCo's internal physical network.

---

## Stage 4 - Carrier acceptance: operational work begins

### Objective trigger
Preferred trigger is carrier possession:

- first carrier acceptance scan on a customer-provided tracking number, or
- first carrier acceptance scan on a CESCo-generated label.

Other non-carrier intake methods may use an equivalent explicit custody-commit event.

### CESCo system behavior
At carrier acceptance:

- Shipment becomes IN_TRANSIT.
- Operational WorkOrder is opened.
- WorkOrder status begins as IN_TRANSIT or AWAITING_RECEIPT.
- CESCo begins logistics monitoring.
- Time spent on tracking/escalation can be recorded as work activity.
- Any contractual inbound logistics obligations begin.

### Value
CESCo only assumes operational responsibility when the customer has actually committed property into the service flow.

---

# 2. Receiving and inventory intake

## Stage 5 - Package arrival

Receiving begins the inventory-management lifecycle.

### Receiving operator records
- shipment/tracking
- package identifier
- receipt timestamp
- receiving user
- physical receiving location
- carrier/service
- package dimensions/weight if useful
- seal state
- external package condition
- exception notes
- photos/evidence when appropriate

### System behavior
Creates:
- Receipt
- Package
- CustodyEvent
- LocationAssignment

Shipment becomes RECEIVED or PARTIALLY_RECEIVED.

### Important distinction
Package and Asset are separate objects.

One package may contain:
- one asset
- multiple assets
- accessories
- parts
- paperwork
- unexpected items

A package may be received before its contents are fully reconciled.

---

## Stage 6 - Reconciliation and intake

### Receiving/intake actions
- Open package if authorized.
- Reconcile expected vs actual contents.
- Identify existing assets.
- Register unknown/unregistered assets.
- Record serials/asset tags.
- Record observed condition.
- Capture evidence.
- Record accessories received.
- Record ownership.
- Assign custody to CESCo.
- Assign temporary or permanent physical storage location.

### System behavior
Creates/updates:
- Asset
- AssetObservation
- CustodyRecord / CustodyEvent
- LocationAssignment
- Evidence
- PackageContent link

### Value
The system can answer immediately:

- what arrived
- who owns it
- where it is
- who received it
- what condition it was in
- what evidence exists

---

# 3. Storage and location model

## Site hierarchy

A Site is a physical facility or controlled service location.

Examples:
- Indianapolis Repair Depot
- Chicago Strategic Stocking
- Client Site 041
- Climate-controlled Storage Unit 17

Each Site may contain nested StorageLocations.

Example:

Indianapolis Repair Depot
-> Receiving
-> Intake Cage
-> Bench Area
-> Rack 2
-> Shelf B
-> Position 4

### StorageLocation attributes
- id
- site
- parent location
- name/code
- type
- active/inactive
- capacity
- capacity unit
- secure-storage flag
- environmental restrictions
- client-dedicated/shared
- notes

### Location rule
An asset should have one current physical location while under CESCo custody, but a full movement history should remain available.

---

# 4. Ownership, custody, and location are independent

## Ownership
Who legally owns the property.

Ownership changes only through explicit authorized transfer.

Examples:
- Client A owns asset.
- Client A donates asset to CESCo.
- TitleTransfer event records that change.

## Custody
Who physically controls the asset.

Possible custodians:
- customer
- carrier
- CESCo
- field technician
- downstream recycler
- repair partner

## Location
Where the asset physically is.

Examples:
- Client Site 41
- UPS network
- Indianapolis receiving cage
- Bench 3
- Rack 2 / Shelf B
- outbound carrier

### Principle
Ownership must never be inferred from custody or location.

---

# 5. Condition and observations

Condition should not be encoded solely as a workflow status.

## AssetObservation

A condition observation should support:
- asset
- observer
- timestamp
- observation type
- condition code
- free-text note
- linked evidence
- work order if applicable

Possible condition codes:
- UNKNOWN
- GOOD
- KNOWN_GOOD
- COSMETIC_DAMAGE
- SHIPPING_DAMAGE
- FAILED
- INTERMITTENT
- REPAIRABLE
- NONREPAIRABLE
- PARTS_ONLY
- DATA_BEARING
- TEST_PENDING

Observations are append-oriented. The latest observation may inform current condition, but prior observations remain part of provenance.

---

# 6. Work-order model

A WorkOrder represents an operational job against an asset.

It is not the asset itself, and it is not the billing record.

## WorkOrder should include
- number
- organization
- asset
- service request
- service type
- assigned service location
- priority
- status
- openedAt
- completedAt
- closedAt
- assigned team/user
- customer authorization reference
- reported issue
- summary diagnosis
- summary resolution

## Work-order statuses

Suggested initial statuses:
- IN_TRANSIT
- AWAITING_RECEIPT
- RECEIVED
- INTAKE
- OPEN
- IN_PROGRESS
- WAITING_PARTS
- WAITING_CUSTOMER_AUTHORIZATION
- WAITING_EXTERNAL_SERVICE
- TESTING
- READY
- PACKED
- OUTBOUND
- COMPLETED
- CANCELLED

### Principle
WorkOrder status reflects job state.

Asset lifecycle status reflects the broader asset state.

Example:

Asset.status = REPAIR
WorkOrder.status = WAITING_PARTS

This is valid and expected.

---

# 7. Work-order events

WorkOrderEvent provides the detailed operational timeline.

Examples:
- WORK_ORDER_OPENED
- PACKAGE_RECEIVED
- INTAKE_STARTED
- DAMAGE_DOCUMENTED
- INSPECTION_STARTED
- INSPECTION_COMPLETED
- CLIENT_AUTHORIZATION_REQUESTED
- CLIENT_AUTHORIZATION_RECEIVED
- PART_ORDERED
- WAITING_PARTS
- PART_RECEIVED
- REPAIR_RESUMED
- COMPONENT_REMOVED
- COMPONENT_INSTALLED
- REPAIR_COMPLETED
- TESTING_STARTED
- TEST_PASSED
- TEST_FAILED
- PACKED
- SHIPPED
- WORK_ORDER_COMPLETED

Each event should support:
- actor user
- timestamp
- event type
- note
- old/new status where applicable
- related evidence
- related part
- related labor activity
- related shipment/receipt
- system-generated flag

---

# 8. Labor and activity measurement

Labor logging is required independently of customer billing.

## WorkActivity

Suggested fields:
- work order
- worker
- activity type
- startedAt
- endedAt
- durationMinutes
- notes
- billable flag
- training flag
- supervised flag
- supervisor user
- approved/verified flag where needed

Activity types may include:
- receiving
- inventory intake
- inspection
- diagnosis
- repair
- testing
- configuration
- packaging
- logistics
- data destruction
- decommissioning
- administration
- training
- supervision

### Why this matters
Provides:
- true service cost
- labor utilization
- training metrics
- workforce-development evidence
- pricing intelligence
- operational capacity
- grant and impact reporting

Flat-rate customer pricing must not suppress internal labor measurement.

---

# 9. Parts and material flow

## WorkOrderPart

Suggested fields:
- work order
- part number
- description
- manufacturer
- quantity
- unit cost
- source
- status
- orderedAt
- receivedAt
- installedAt
- removedAt
- return/RMA reference
- inventory asset reference if serialized

Possible statuses:
- REQUIRED
- ORDERED
- BACKORDERED
- RECEIVED
- INSTALLED
- REMOVED
- RETURNED
- CONSUMED
- CANCELLED

A part receipt should create an operational event and may release a work order from WAITING_PARTS.

---

# 10. Evidence and attachments

Evidence should be a first-class domain object rather than a generic file upload.

## Evidence

Suggested fields:
- organization
- asset
- work order
- shipment/package/receipt if applicable
- event
- uploader
- capturedAt
- uploadedAt
- evidence type
- description
- file metadata
- cryptographic hash
- immutable/original indicator

Evidence types may include:
- package exterior
- shipping label
- damage
- serial/asset tag
- before repair
- after repair
- test result
- packing
- outbound shipment
- signed authorization
- title transfer
- data-destruction certificate

Evidence should be linkable to the event it proves.

---

# 11. Strategic stocking and readiness

Strategic stocking represents operational readiness, not generic storage.

## StockingProfile

Suggested fields:
- organization
- asset class/model
- approved configuration
- minimum quantity
- target quantity
- maximum quantity
- region/site
- readiness-test interval
- SLA/dispatch target
- customer authorization rules
- replenishment rules

## Readiness record
For stocked assets:
- known-good state
- last tested
- next test due
- configuration version
- reserved/unreserved
- eligible destination/site set

### Customer-facing value
The portal should answer:

- how many ready spares exist
- where they are
- which sites they can support
- which units are reserved
- when each was last verified

---

# 12. Billing lifecycle

Operational history and billing history are related but distinct.

## Core financial objects

### Estimate
Proposed price or range before work.

### Authorization
Customer approval of scope and/or spending ceiling.

### Charge
A billable line generated by an operational event or contractual rule.

Examples:
- intake fee
- diagnostic fee
- labor
- repair flat rate
- part
- shipping
- storage
- strategic stocking
- testing
- data destruction

### Invoice
Customer-facing aggregation of charges.

### Payment
Settlement of invoice or account balance.

### Credit
Reduction in amount owed or prepaid service credit.

### Refund
Money returned after payment.

## Pricing models supported

### Transactional
Per item / per service.

### Hourly
Labor-based.

### Flat rate
Fixed service price regardless of actual internal labor.

### Contract
Negotiated pricing, PO, Net terms.

### Recurring
Strategic stocking, reserved capacity, SLA, recurring readiness testing.

### Prepaid service credit
Account credit consumed by invoices.

### Principle
Do not implement a customer money wallet when normal invoice credit accounting will satisfy the use case.

---

# 13. Billing event flow example

Customer requests repair.

Estimate: $250 maximum.

Customer authorizes up to $250.

Shipment accepted by carrier.

WorkOrder opens.

Package received.

Inspection discovers cracked screen.

CESCo records:
- receiving labor
- inspection labor
- evidence
- required part

If the expected total remains within authorization, work may continue according to policy.

If it exceeds authorization:
- WorkOrder -> WAITING_CUSTOMER_AUTHORIZATION
- new estimate/change order issued
- customer accepts or declines

During repair:
- internal labor is logged
- part cost is logged
- customer charge may be flat-rate, hourly, or contract-based

At completion:
- charges are finalized
- invoice is issued according to account terms
- payment/credit status is visible separately from operational completion

---

# 14. Users, memberships, roles, and permissions

## User
Represents one human identity.

Historical user records should be disabled, not deleted.

## Membership
Connects a User to an Organization.

A user may belong to multiple organizations.

Membership supports:
- active/inactive
- invitation state
- organization
- user
- default role(s)
- optional site/depot scope

## Role
Named collection of permissions.

Potential roles:
- SYSTEM_ADMIN
- CESCO_OPERATIONS_ADMIN
- DEPOT_MANAGER
- DEPOT_TECHNICIAN
- RECEIVING_LOGISTICS
- CLIENT_ADMIN
- CLIENT_DISPATCHER
- CLIENT_BILLING
- CLIENT_AUDITOR

## Permission
Atomic capability.

Examples:
- organization.view
- organization.manage
- user.invite
- user.disable
- role.assign
- asset.view
- asset.create
- asset.move
- asset.authorize
- asset.transfer_ownership
- shipment.create
- shipment.view
- receipt.perform
- evidence.upload
- workorder.view
- workorder.perform
- workorder.close
- labor.log
- parts.manage
- inventory.view
- inventory.manage
- billing.view
- billing.authorize
- invoice.pay
- disposition.authorize

## Administration principle
Routine client-user administration belongs to authorized client administrators, not CESCo support.

CESCo should retain control over:
- platform/system roles
- CESCo operational roles
- permission definitions
- privileged escalation
- audit and security controls

---

# 15. Audit model

Important mutations should leave durable records.

Examples:
- ownership transfer
- custody transfer
- location move
- service authorization
- billing authorization
- user-role changes
- work-order status changes
- asset condition observations
- evidence uploads
- title transfer
- disposition

Audit events should identify:
- actor
- timestamp
- organization scope
- affected object
- action
- before/after values where appropriate
- source/IP/session metadata where useful

Business-domain events and security audit events may overlap but should not be conflated.

---

# 16. Proposed major domain entities

Initial target entities for the next schema design:

- User
- Organization
- Membership
- Role
- Permission
- MembershipRole / RolePermission
- Site
- StorageLocation
- Asset
- AssetOwnership
- CustodyEvent
- LocationEvent
- AssetObservation
- ServiceRequest
- Authorization
- Shipment
- Package
- PackageContent
- Receipt
- WorkOrder
- WorkOrderEvent
- WorkActivity
- WorkOrderPart
- Evidence
- StockingProfile
- Estimate
- Charge
- Invoice
- InvoiceLine
- Payment
- Credit
- Refund

Not all of these need to be implemented in the first migration. The schema should be phased.

---

# 17. Recommended implementation phases

## Phase A - Identity and operational intake
Implement first:
- User
- Membership
- Role/Permission minimum viable model
- ServiceRequest
- Authorization
- Shipment
- Package
- Receipt
- StorageLocation
- ownership/custody/location concepts

This establishes the true front door.

## Phase B - Work execution
Add:
- richer WorkOrder
- WorkOrderEvent
- WorkActivity
- AssetObservation
- Evidence
- WorkOrderPart

This creates defensible repair/service provenance.

## Phase C - Commercial layer
Add:
- Estimate
- Charge
- Invoice
- InvoiceLine
- Payment
- Credit
- Refund
- account billing terms

This supports pay-per-service and contract billing.

## Phase D - Strategic stocking
Add:
- StockingProfile
- readiness records
- reservation/dispatch logic
- recurring service charges
- SLA metrics

## Phase E - Advanced lifecycle/disposition
Add:
- explicit ownership transfer workflow
- donation/title transfer
- decommissioning
- data destruction
- refurbishment
- parts harvesting
- recycling/disposition certificates

---

# 18. First implementation slice after design approval

The next code/schema slice should not attempt to implement the entire model.

Recommended first slice:

1. User + Membership foundation
2. ServiceRequest
3. Authorization
4. Shipment
5. Package
6. Receipt
7. StorageLocation
8. WorkOrder creation on shipment acceptance

Minimal customer flow:

Create account
-> create/select asset
-> request service
-> authorize
-> add tracking
-> mark carrier accepted
-> WorkOrder opens
-> receive package
-> document condition
-> assign physical location

This slice tests the real front door of CESCo Depot while preserving the current prototype's Organizations, Sites, Assets, and AssetEvent work.

---

# 19. Acceptance test for the next slice

A successful test should allow the following scenario:

A customer registers an asset and requests repair.

They authorize the work and enter a tracking number.

No work order exists yet.

The shipment is marked carrier-accepted.

A work order is automatically opened and shows IN_TRANSIT.

The depot receives the package.

The receiving user records:
- package condition
- receiving timestamp
- evidence
- contained asset
- customer ownership
- CESCo custody
- physical storage location

The customer dashboard can then answer:

- asset owner
- current custodian
- current location
- shipment state
- current work-order state
- latest condition
- timeline of events

If the system can answer those correctly, the new domain foundation is working.



---

# 20. Distributed client network and service-location model

The location model must support a many-to-many operational network rather than assuming one organization's assets only move among that organization's own sites.

## Account organization

The Account Organization is the CESCo customer relationship boundary. It governs:

- membership and client-side roles
- authorization authority
- billing relationship
- ownership/control of registered assets
- service policy
- contract/SLA context
- visibility of that client's inventory and lifecycle records

## Endpoint

An Endpoint represents a real-world destination or origin relevant to the client.

Examples:

- Store 123
- Store 124
- Clinic 41
- Branch Office 8
- Restaurant 207
- Client warehouse
- technician staging point

An endpoint may belong to the client directly or to one of the client's downstream customers. It does not need to be a CESCo customer organization.

Suggested Endpoint fields:

- account organization
- external/customer location identifier
- name
- address
- region/market
- contact metadata
- active/inactive
- service notes
- optional SLA/service profile

## Service location

A ServiceLocation is a physical location through which CESCo coordinates custody, storage, repair, readiness, or logistics.

Examples:

- CESCo repair depot
- climate-controlled self-storage facility
- partner warehouse
- third-party repair location
- cross-dock
- technician-controlled staging location

A ServiceLocation may support more than one client organization.

Suggested ServiceLocation fields:

- name/code
- location type
- provider/landlord/operator
- address
- active/inactive
- climate-controlled flag
- secure-storage flag
- access instructions
- service capabilities
- region
- notes

## Storage position

StoragePosition replaces the assumption that storage hierarchy belongs exclusively to one client-owned Site.

A service location may contain nested positions:

Storage facility
-> Unit 214
-> Rack A
-> Shelf 3
-> Bin 2

Each position may be shared or dedicated.

Suggested fields:

- service location
- parent position
- name/code
- type
- active/inactive
- capacity
- secure flag
- environmental constraints
- dedicated organization when applicable

## Asset placement

An asset's current physical placement should reference either:

- an Endpoint when deployed at a client/downstream site, or
- a StoragePosition when staged or stocked at a service location,
- or a transit/custody state when moving between locations.

Ownership, account scope, custody, and physical placement remain independent.

## Distributed work execution

A field technician, courier, or partner may perform a service action without being a CESCo employee.

The platform should support assignments such as:

- pick up package from storage-office counter
- place package in Unit 214 / Rack A / Shelf 3
- photograph identifying labels and placement
- retrieve cold spare
- deliver/install spare at Store 123
- remove failed asset
- route failed asset to repair or storage
- confirm restock and readiness

The resulting record should capture:

- assigned actor/provider
- work instructions
- asset/package identifiers
- origin and destination
- timestamps
- custody transitions
- condition observations
- required evidence
- final placement
- exceptions

The platform therefore manages the state transition and proof of execution even when CESCo never physically touches the asset.

## Strategic spare requisition

A client user with appropriate operational permission may request a spare for a downstream endpoint.

The system should be able to answer:

- which compatible spare is available
- which service location holds it
- whether it is known-good and ready
- which endpoint needs it
- who is authorized to dispatch it
- how it will move
- whether a return/failed asset is expected
- where the removed asset should go next

Financial authority must be evaluated separately from operational requisition authority.

## Role scope

Client-side roles should be organization-scoped and may later gain optional endpoint/region scope.

Examples:

- CLIENT_ADMIN
- CLIENT_HELPDESK
- CLIENT_DISPATCHER
- CLIENT_FIELD_TECHNICIAN
- CLIENT_BILLING
- CLIENT_AUDITOR

Client administrators manage routine assignment of client roles. CESCo defines the permission vocabulary and prevents assignment of internal/system privileges.

This model preserves the original product promise while allowing CESCo Depot to operate as a distributed control layer over client-owned assets, third-party storage, field technicians, carriers, repair partners, and downstream customer locations.
