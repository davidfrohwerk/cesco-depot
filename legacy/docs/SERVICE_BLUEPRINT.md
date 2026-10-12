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


---

# 21. Bidirectional orchestration and reverse logistics

CESCo Depot is the operational coordination layer between client organizations, downstream endpoints, service locations, storage positions, carriers, field technicians, repair resources, and disposition partners.

The same routing model must work in either direction.

Forward example:

ACME Store 123
-> carrier
-> CESCo/partner service location
-> receiving position
-> Unit 214 / Rack A / Shelf 3
-> dispatch
-> carrier or field technician
-> ACME Store 124

Reverse example:

ACME Store 124
-> field technician or carrier
-> CESCo/partner service location
-> receiving position
-> inspection / repair / restock / disposition
-> storage position
-> later redeployment
-> ACME Store 123 or another endpoint

The important invariant is that the system does not encode "inbound" and "outbound" as ownership changes. They are routing directions relative to an operational step. Ownership remains independent.

## Middleware responsibility

CESCo Depot should answer:

- what event triggered the movement
- which asset should move
- where it is now
- where it should go
- who currently has custody
- who is authorized to request the move
- whether separate financial approval is required
- which carrier, courier, or field technician will execute the move
- what proof is required at pickup, placement, installation, removal, and return
- what condition the asset was in before and after each handoff
- whether a replacement/failed asset is expected in reverse
- what the next lifecycle state should be

## Hands / boots on the ground

Physical execution may be performed by:

- CESCo personnel
- a client field technician
- a WorkMarket or similar national field-service technician
- a courier
- a storage operator
- a repair partner
- another specifically authorized third party

The system should not assume that the user recording or authorizing the work is the person physically performing it.

Future FieldTask / DispatchAssignment records should therefore support:

- organization
- related trouble ticket / requisition / service request
- assigned provider or technician
- origin and destination
- package and asset identifiers
- detailed work instructions
- appointment / SLA window
- required evidence checklist
- custody expectations
- completion status
- exception/escalation status
- actual timestamps

## Strategic spare requisition

The first implementation of strategic spare requisition should deliberately separate operational authority from financial authority.

CLIENT_HELPDESK and CLIENT_DISPATCHER may request a spare when allowed by organization policy without implicitly gaining billing authorization.

CESCo operations may reserve a known-good or stocked asset for the requisition after confirming:

- account ownership
- compatible manufacturer/model or approved compatibility
- readiness state
- current storage placement
- service-location availability to that client
- absence of another active reservation

The next implementation slice should turn a RESERVED spare into an executable dispatch route and record the reverse path for the failed/removed asset when one is expected.


---

# 22. Bulk onboarding, import, and export

Bulk data movement is a first-class customer workflow.

## Import job

Suggested ImportJob fields:

- organization
- submitted by user
- source format
- entity type
- original filename
- submitted timestamp
- validation status
- commit status
- total rows
- valid rows
- invalid rows
- created count
- updated count
- skipped count
- error report reference

## Initial supported entities

Recommended first import order:

1. Endpoints
2. Assets
3. Asset readiness / compatibility metadata
4. Parts / stocked components
5. Optional user invitations / role assignments after stricter review

The importer should support customer-provided stable external IDs so later imports can update known records without relying on display names.

## Required workflow

Upload file
-> detect columns
-> map columns
-> validate all rows
-> show preview and errors
-> customer confirms
-> commit valid transaction/batches
-> generate import summary
-> retain import audit record

Import should not silently discard invalid rows or silently overwrite ambiguous matches.

## Export

Authorized users should be able to export organization-scoped data, including assets, endpoints, placement, readiness, and lifecycle status, in standard formats.

Export is important both for customer trust and for reducing lock-in.

---

# 23. Carrier integration layer

CESCo Depot should expose a carrier-neutral shipment workflow.

## Carrier adapter

Each carrier adapter may implement:

- validateAddress
- quoteRates
- createLabel
- voidLabel
- getTracking
- normalizeWebhookEvent
- obtainProofOfDelivery

The core Shipment model should consume normalized events rather than carrier-specific event names.

## Normalized tracking events

Examples:

- LABEL_CREATED
- CARRIER_ACCEPTED
- IN_TRANSIT
- DELAYED
- DELIVERY_ATTEMPTED
- OUT_FOR_DELIVERY
- DELIVERED
- EXCEPTION
- RETURN_TO_SENDER

The raw carrier payload may be retained for audit/debugging while normalized state drives CESCo workflow.

## Account ownership

A shipment may use:

- CESCo carrier account
- client carrier account
- prepaid/third-party label
- manual/external shipment

The portal should show one workflow regardless of which commercial arrangement is used.

---

# 24. Financial and payment architecture

CESCo Depot owns operational billing state but should not become a raw payment-card vault.

## Financial domain

The application should model:

- customer account terms
- estimate
- authorization
- charge
- credit
- invoice
- payment
- refund
- recurring service agreement
- purchase-order/customer reference

## Payment processor adapter

Payment-provider integration should support:

- customer/payment-method token reference
- hosted or embedded secure payment collection
- authorization/capture where needed
- ACH where supported
- payment webhooks
- refunds
- failure/retry status

Sensitive card/bank credentials remain with the processor.

## Accounting integration

Accounting synchronization is a separate adapter concern.

Potential synchronized objects:

- customer/account
- invoice
- payment
- credit memo
- tax
- GL/accounting references

Operational events remain CESCo Depot records even when financial summaries are synchronized elsewhere.

---

# 25. Partner storage qualification and secure access

A ServiceLocation may have a qualification record describing whether it is acceptable for strategic stocking.

Suggested fields/checks:

- climate controlled
- twenty-four-hour access or documented SLA access hours
- controlled gate/building access
- individually secured unit/cage/room
- access method type
- package receipt supported
- after-hours package procedure
- staff placement service supported
- receiving contact/escalation
- insurance/risk documentation
- last qualification review
- qualification status
- notes/exceptions

## Package receipt patterns

### Facility holds package

Carrier
-> storage office/front desk
-> package held securely
-> CESCo dispatches technician/courier
-> technician verifies package
-> technician places package in assigned position
-> evidence captured
-> unit secured

### Facility staff places package

Carrier
-> facility staff
-> staff verifies package identifier
-> staff receives CESCo placement instruction
-> staff places package into assigned unit/position
-> staff captures required evidence or CESCo performs later verification
-> unit secured

Both patterns must result in the same normalized custody, placement, and evidence records.

## Access credentials

Access credentials may include:

- gate PIN
- unit PIN
- combination
- temporary smart-lock code
- mobile credential/token
- physical key reference

Credentials must not be stored as ordinary descriptive fields on a ServiceLocation.

They should eventually use a dedicated encrypted/secrets subsystem with:

- role-limited access
- dispatch-specific disclosure
- access log
- expiration
- rotation/revocation
- optional one-time credential support

A work order/dispatch should reference the access instruction/secret it is authorized to use rather than copying permanent secrets into broadly visible notes.

## Remote lock integrations

If a lock/storage provider offers remote control, CESCo Depot may expose actions such as:

- issue temporary code
- unlock for authorized dispatch
- revoke code
- read access-log event

The integration must fail safely and have an offline/manual fallback. Remote lock control is an optional capability; the inventory and dispatch model must not depend on connectivity at the storage site.

---

# 26. Loss prevention and custody controls

Distributed storage introduces theft, misplacement, and unauthorized-access risk.

Mitigations should include:

- least-privilege disclosure of facility/unit credentials
- time-limited or one-time codes where available
- access-event logging
- mandatory pickup/drop-off evidence
- serial/asset-tag verification
- before/after photos of placement
- tamper/seal observations where relevant
- explicit custody acceptance
- mismatch/exception workflow
- periodic inventory reconciliation
- readiness audits
- provider/facility qualification
- contractual responsibility and insurance review
- alerts for overdue dispatch completion or unexpected access where integrations permit

CESCo Depot's role is to make every authorized handoff observable and attributable even when execution occurs through third parties.


---

# 27. Warranty-aware service routing

An asset may be under OEM warranty while still remaining fully visible inside CESCo Depot.

## Asset warranty metadata

Recommended fields:

- warranty provider / OEM
- expiration date
- entitlement / contract / warranty reference
- warranty notes / exclusions / handling instructions

Warranty metadata is advisory operational context. It does not itself prove legal coverage; CESCo should rely on the applicable OEM entitlement system, contract, or customer documentation when making a warranty routing decision.

## OEM warranty coordination service

A client may request OEM warranty coordination as a lifecycle service.

Expected flow:

Client asset failure
-> service request
-> warranty context checked
-> authorization boundary established
-> evidence / serial captured
-> OEM or authorized service-provider RMA initiated
-> carrier / courier routing coordinated
-> external service tracked
-> repaired or replacement asset returned
-> asset routed to designated endpoint or strategic stocking position
-> lifecycle and custody history preserved

The work order may enter WAITING_EXTERNAL_SERVICE while the OEM or authorized provider has the unit.

CESCo must not perform repair actions outside the authorized scope when doing so could affect OEM warranty coverage.

## External-service record

Service requests and work orders should be able to carry:

- external service provider
- RMA / case / entitlement reference
- outbound shipment
- return shipment
- external-service status
- expected return destination
- evidence
- exception notes

The current ServiceRequest external provider and RMA fields are the first implementation slice; richer external-service event modeling can follow.

## Authorized OEM service-provider strategy

Where economically and operationally sensible, CESCo may seek OEM-authorized service-provider status.

This is commercially aligned with the platform because CESCo may already have:

- custody of the failed asset
- intake evidence
- serial / warranty metadata
- depot labor capability
- parts and test workflow
- return logistics responsibility

Authorized status could reduce unnecessary handoffs and convert warranty repair into an additional service channel.

CESCo Depot should model provider authorization as a capability of a service location / service network, not hard-code assumptions about any specific OEM.


---

# 28. External-service case and tracked coordination loop

OEM warranty and other authorized third-party service should be represented as an explicit external-service case rather than forcing the provider into the Endpoint or ServiceLocation model.

## ExternalServiceCase

The first implementation slice records:

- service request
- work order
- asset
- provider name
- provider case / RMA reference
- external service destination name and postal address
- expected return date
- lifecycle status
- notes
- provider receipt / return timestamps
- associated shipment legs

Statuses:

- PLANNED
- TO_PROVIDER_IN_TRANSIT
- AT_PROVIDER
- RETURN_IN_TRANSIT
- RETURNED
- EXCEPTION
- CANCELLED

## Shipment legs

Each external-service case may carry two normal Shipment records:

1. TO_PROVIDER
2. FROM_PROVIDER

The outbound provider leg records the asset leaving its CESCo/partner/client placement, entering carrier custody, and being received by the OEM or authorized provider.

The return leg records the asset leaving the provider, entering carrier custody, and returning either to:

- a client/downstream Endpoint, or
- an authorized CESCo/partner ServiceLocation for receiving and verification.

This preserves the standard carrier/tracking/evidence model while keeping the provider outside the client endpoint and CESCo service-location taxonomies.

## Custody and asset state

Provider-bound carrier acceptance:
- custody -> CARRIER
- asset -> IN_TRANSIT_EXTERNAL_SERVICE

Provider delivery:
- custody -> PARTNER / external provider
- asset -> IN_EXTERNAL_SERVICE

Return carrier acceptance:
- custody -> CARRIER
- asset -> IN_TRANSIT_EXTERNAL_SERVICE

Return to CESCo/partner service location:
- normal receiving flow records package receipt, condition, storage position, and service-location custody
- external-service case -> RETURNED
- work order may then move to TESTING for CESCo verification

Return directly to client endpoint:
- custody -> CUSTOMER
- placement -> selected Endpoint
- external-service case -> RETURNED
- work order/service request may complete because no CESCo verification handoff remains

The full coordination loop therefore remains auditable even when CESCo does not perform the warranty repair itself.


---

# 29. CESCo internal operations queue

Client actions must create visible internal work.

The CESCo operations workspace should aggregate client activity across organizations and classify it by the next operational action rather than requiring staff to navigate each tenant manually.

Initial queues include:

- needs CESCo routing
- awaiting client authorization
- ready for shipment setup
- active work orders
- external/OEM service cases
- shipment exceptions
- other active service requests

An authorized request with no client-accessible service location is an explicit routing exception. Internal operations can grant the client access to an eligible CESCo/partner ServiceLocation from the operations queue, after which the normal shipment workflow can continue.

# 30. Service-request evidence and electronic authorization

Evidence that exists before depot intake belongs on the ServiceRequest itself.

Examples:

- FIELD_DIAGNOSTIC
- TICKET_RECORD
- WARRANTY_CLAIM
- DAMAGE
- SERIAL_ASSET_TAG
- OTHER

This lets a client carry forward an existing ticket, field technician diagnosis, photographs, or warranty documentation instead of rewriting the history into a free-text service form.

Ordinary customer authorization should occur in the authenticated portal. The current authorization object records the user, scope, spending ceiling, terms version, and authorization timestamp. The UI requires explicit acceptance of the authorization statement.

Signed-document upload remains available as supporting evidence but is not the default requirement.

Future payment/checkout integration should create its own financial transaction record linked to the service request/authorization. Payment evidence should be obtained from the payment provider/API, not by asking the customer to upload screenshots.
