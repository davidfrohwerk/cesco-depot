# CESCo Depot Product Principles and Service Model

## Purpose

CESCo Depot is a client-facing technical asset lifecycle and custody platform backed by real physical services: receiving, depot repair, inventory control, strategic stocking, logistics, testing, redeployment, decommissioning, donation, and disposition.

The customer normally retains ownership of the asset. CESCo manages the service cycle, custody, evidence, work, storage, movement, and authorized disposition.

## Core customer promise

CESCo Depot should help a customer answer, at any time:

- What do we have?
- Who owns it?
- Where is it?
- Who has custody of it?
- What condition is it in?
- What has happened to it?
- What is happening now?
- What happens next?
- What will it cost?
- What value can still be recovered from it?

A concise operating proposition is:

> Know what you have, where it is, what condition it is in, and what happens next.

A broader value proposition is:

> CESCo Depot gives organizations one place to control the repair, custody, readiness, movement, and disposition of technical assets they still own.

## Product design test

Every proposed feature should materially improve at least one of these outcomes:

1. Visibility
2. Reduced downtime
3. Reduced lifecycle cost
4. Accountability / provenance
5. Recovery of useful value from an asset

If a feature does none of these, it should not be a priority for the first product.

## Why a customer would buy

The primary alternative is often fragmented internal coordination:

- spreadsheets
- email
- ticketing systems
- carrier portals
- repair vendors
- storage rooms
- accounting systems
- technician notes
- informal institutional knowledge

The resulting pain includes:

- unknown asset location
- weak chain of custody
- duplicate purchases
- dormant or lost inventory
- excessive onsite technician time
- poor repair-versus-replace decisions
- slow replacement dispatch
- fragmented evidence
- weak disposition records
- expensive coordination

CESCo Depot should replace that fragmentation with one operational control layer tied to physical service execution.

## Value ladder

### Level 1 - Transactional repair
"Fix this device."

Low commitment. Free account, pay per service.

### Level 2 - Lifecycle visibility
"Track the equipment we send you."

CESCo becomes a trusted record of custody, condition, work, and movement.

### Level 3 - Managed inventory
"Hold useful repaired equipment for us."

CESCo manages client-owned inventory and its physical locations.

### Level 4 - Strategic stocking
"Maintain known-good configured replacements."

CESCo sells readiness and reduced downtime rather than merely storage.

### Level 5 - Distributed lifecycle management
"Manage repair, inventory, redeployment, logistics, and disposition across our sites."

CESCo becomes operational infrastructure for the customer's technical asset lifecycle.

## Customer entry and work-order onset

Account registration is free and does not create a work order.

The customer may:

1. Create an organization/account.
2. Register or identify an asset.
3. Select the desired service or disposition.
4. Authorize the service scope and any spending ceiling.
5. Receive a destination and optionally a CESCo-generated shipping label.
6. Enter or receive a carrier tracking number.

A work order becomes active when the shipment is actually tendered to the carrier or otherwise committed into CESCo's service flow, not merely when a tracking number is typed into the portal.

Preferred objective trigger:

- first carrier acceptance scan for a customer-provided shipment, or
- first carrier acceptance scan for a CESCo-generated label.

This avoids treating abandoned draft shipments as active work while still recognizing that CESCo begins performing logistics and tracking work before the package arrives.

## Inbound service workflow

Account created
-> Service request drafted
-> Asset identified/registered
-> Service and disposition authorized
-> Destination assigned
-> Label/tracking created
-> Carrier acceptance
-> Work order opened: IN_TRANSIT
-> CESCo monitors inbound movement
-> Package received
-> Receiving record created
-> Package condition documented
-> Evidence/photos captured when appropriate
-> Contents reconciled
-> Asset identity confirmed
-> Ownership confirmed
-> CESCo custody recorded
-> Physical storage location assigned
-> Intake/inspection work begins

## Receiving begins inventory management

Asset/inventory management begins at package receipt, not after technical inspection.

Receiving must support questions such as:

- What arrived?
- When?
- Via which carrier/tracking number?
- Who received it?
- Who owns it?
- What package/container was it in?
- Was the package damaged?
- What evidence was captured?
- What assets were inside?
- What condition were they in?
- Where are they physically stored?
- Is there suitable capacity available?
- What workflow are they waiting for?

The model should distinguish package/shipment records from asset records because one package may contain multiple assets and the package may arrive before its contents are fully reconciled.

## Independent operational dimensions

The platform should not collapse multiple concepts into a single asset status.

### Ownership
Who legally owns the asset.

CESCo custody must never imply CESCo ownership.

Donation or other title transfer must be an explicit, auditable event.

### Custody
Who physically controls the asset at a given moment.

### Physical location
Where the asset is located, potentially down to site, room, rack, shelf, bin, cage, pallet position, or other storage location.

### Condition
Observed state of the asset or package.

Examples:
- unknown
- good
- damaged in transit
- cosmetically damaged
- failed
- repairable
- known good
- parts-only

### Asset lifecycle status
Broad lifecycle state such as received, repair, testing, ready, stocked, dispatched, installed, decommissioned, recycled.

### Work-order status
State of a particular job against the asset.

Examples:
- open
- in progress
- waiting parts
- waiting client authorization
- testing
- completed
- cancelled

An asset may remain in REPAIR while its work order is WAITING_PARTS.

## Work and provenance

Asset status answers:

> Where is the asset in its lifecycle?

Work-order records answer:

> What job are we performing?

Work-order events answer:

> What happened during that job?

Evidence answers:

> What proves it?

Labor records answer:

> Who did the work and for how long?

Parts records answer:

> What was ordered, received, installed, removed, or returned?

Examples of work-order events:

- inspection started
- inspection completed
- damage documented
- part ordered
- work paused awaiting parts
- part received
- repair resumed
- component removed
- component installed
- repair completed
- testing started
- test passed
- test failed
- packaged
- shipped

## Labor measurement is separate from billing

CESCo should log labor regardless of whether the client is billed hourly, flat-rate, under contract, or not charged for that labor.

Labor records are operational metrics and may support:

- internal cost accounting
- pricing decisions
- technician productivity
- capacity planning
- workforce development
- training-hour measurement
- grant reporting
- external impact reporting

A labor/activity record should eventually support:

- worker
- work order
- activity type
- start time
- end time
- duration
- notes
- billable/non-billable
- training flag
- supervised flag
- supervisor when applicable

## Strategic stocking

Strategic stocking is not simply storage.

The value proposition is operational readiness:

- known-good assets
- approved configuration
- known location
- readiness verification
- dispatch capability
- SLA-backed response where contracted

A strategic stocking location may be a CESCo depot, partner facility, climate-controlled storage unit, or other suitable controlled location.

The portal should unify these distributed locations into one inventory and readiness view.

## Customer-authorized actions

Customers should be able to authorize actions on assets they own, including:

- diagnose
- repair
- reconfigure/reimage
- test
- store as strategic spare
- redeploy
- ship to another destination
- decommission
- data destruction
- donate to CESCo
- recycle or otherwise dispose

Authorization must be recorded separately from execution.

## Billing architecture

Basic account registration and portal access should be free.

CESCo should primarily charge for real operational value:

- repair
- diagnostic work
- receiving/intake
- logistics
- shipping
- storage
- strategic stocking
- readiness testing
- configuration work
- data destruction
- decommissioning
- disposition
- SLA/reserved-capacity services

The billing model should support multiple customer arrangements without changing the underlying operational record.

### Transactional
Pay per service or item.

### Contract / enterprise
Purchase order, consolidated invoicing, Net terms, negotiated rates.

### Prepaid service credit
Customer prepays CESCo and invoices consume account credit.

This should be modeled as credit against invoices, not as an internal money-transfer wallet.

### Recurring operational services
Monthly or annual charges may be appropriate for:

- strategic stocking
- reserved storage capacity
- readiness verification
- SLA commitments
- dedicated inventory programs
- reporting/API access where valuable
- account management or contract services

Do not charge recurring fees merely for permission to use the portal.

## Financial objects

Billing should be its own domain rather than being embedded directly in WorkOrder.

Likely concepts:

- Estimate
- Authorization
- Charge
- Credit
- Invoice
- Payment
- Refund

A work order may generate multiple charges while still maintaining one operational history.

Internal labor cost and customer-facing billing must remain separate.

## Users and administration

The system should avoid a simplistic global ADMIN/TECH/CLIENT role model.

Preferred structure:

User
-> Membership in one or more organizations
-> Roles
-> Permissions
-> optional site/depot scope

Potential roles:

- System Administrator
- CESCo Operations Administrator
- Depot Manager
- Depot Technician
- Logistics / Receiving User
- Client Administrator
- Client Dispatcher / Helpdesk
- Client Read-Only / Auditor

Potential permissions:

- asset.view
- asset.create
- asset.move
- asset.authorize
- workorder.create
- workorder.perform
- workorder.close
- evidence.upload
- inventory.view
- inventory.manage
- shipment.create
- billing.view
- billing.authorize
- user.invite
- user.disable
- role.assign
- ownership.transfer

Client administrators should be able to manage their own users within allowed bounds so CESCo does not become the helpdesk for routine account administration.

Historical identities should be disabled rather than deleted so audit records remain attributable.

## FLOSS / independence principle

CESCo Depot should remain operationally independent of proprietary SaaS vendors wherever practical.

The application may integrate with external services such as carriers and payment processors, but the core customer, asset, custody, work, evidence, labor, billing, and audit records should remain under CESCo's control.

The portal should be able to function as a self-hosted modular monolith with replaceable integrations rather than depending on a proprietary platform for core business logic.

## Near-term design priority

Before adding more UI, define and implement the next domain layer around:

1. Customer service request
2. Shipment / tracking
3. Package receipt
4. Ownership and custody
5. Physical storage location
6. Work orders and work-order events
7. Labor/activity records
8. Parts
9. Evidence/attachments
10. User/membership/role/permission model
11. Billing objects and authorization flow

This design should be validated against the product test: every major feature must improve visibility, reduce downtime, reduce lifecycle cost, preserve accountability, or recover useful value.


## Client organizations, customer sites, and CESCo-managed locations

The system must not assume that every physical location belongs to the client organization that owns the assets.

A typical client may operate on behalf of many downstream customer locations. For example, one CESCo client organization may support hundreds or thousands of geographically distributed stores, clinics, branches, restaurants, or other endpoints. Those locations are operational destinations for client-owned assets even when the downstream site is not itself a CESCo customer account.

The platform should distinguish at least three concepts:

1. **Client organization** - the CESCo customer/account that owns or controls the service relationship, users, authorizations, billing authority, and assets.
2. **Client/customer endpoint** - a geographically distinct location where the client's equipment may be deployed, installed, removed, staged, or returned. These may be the client's own facilities or downstream customer locations.
3. **CESCo-managed service/storage location** - a depot, repair bench, warehouse, climate-controlled storage unit, partner facility, or other controlled location where CESCo coordinates custody, storage, readiness, movement, or service.

A CESCo-managed location may contain assets belonging to multiple client organizations. Asset ownership and account scope must remain independent from physical location.

## Distributed service without direct CESCo handling

CESCo does not need to physically touch every asset in order to manage its lifecycle.

The service may coordinate distributed work through field technicians, couriers, storage providers, repair partners, or national field-service networks. A valid service event may therefore be performed by an authorized third party and still become part of the CESCo Depot record when the required provenance is captured.

Examples include:

- receive a package at a remote climate-controlled storage facility
- place a client-owned cold spare into a specific unit, rack, shelf, bin, or labeled position
- photograph the package, serial number, shelf position, and seal
- dispatch a field technician to retrieve a spare and deliver or install it at a customer endpoint
- remove a failed unit and route it to repair, storage, decommissioning, donation, or recycling
- restock a repaired or returned asset without routing it through a CESCo-owned depot

The customer-facing value is orchestration plus trustworthy state: where the asset is, who controls it, what condition it is in, whether it is ready, what happened to it, and what should happen next.

## Client-controlled operational roles

Client organizations may have administrators, helpdesk users, dispatchers, field technicians, billing users, auditors, and other operational roles.

Client administrators should control routine user membership, role assignment, and organization-scoped permissions within CESCo-defined safety boundaries. Financial authority must not be implied merely by operational access.

Examples:

- a helpdesk user may open a service request or requisition a cold spare without authority to approve spending
- a dispatcher may create or coordinate shipment and redeployment activity without authority to change billing terms
- a field technician may record custody, installation, removal, condition, and evidence for assigned work
- a billing user may view invoices and approve defined financial actions without operational repair permissions
- a client administrator may grant and revoke these organization-scoped roles

CESCo retains exclusive control of internal platform/system roles, CESCo operational roles, security policy, and privileged escalation.


## CESCo as operational middleware plus field execution

CESCo Depot should be designed as valuable operational middleware between the client's helpdesk/dispatch function, the client's distributed asset fleet, carriers, storage providers, field-service networks, repair resources, and downstream customer locations.

CESCo may provide the physical hands directly, through CESCo personnel, or indirectly through authorized field technicians, couriers, repair partners, storage operators, or national service networks. The platform's job is to preserve the same control, provenance, and accountability regardless of who performs the physical step.

The movement model must be bidirectional and composable.

Examples:

Endpoint A
-> carrier / field technician
-> CESCo or partner service location
-> storage position
-> repair / readiness / stocking
-> carrier / field technician
-> Endpoint B

and the reverse:

Endpoint B
-> carrier / field technician
-> service location / receiving position
-> repair / restock / disposition
-> carrier / field technician
-> Endpoint A or another endpoint

No direction should be treated as exceptional. The same primitives - ownership, custody, placement, condition, evidence, authorization, and movement - should describe both forward deployment and reverse logistics.

The customer value is not merely shipping or storage. It is the ability to ask the system what needs to happen next, who can do it, which asset is appropriate, where that asset is, what condition it is in, what evidence proves each handoff, and whether the action is operationally or financially authorized.
