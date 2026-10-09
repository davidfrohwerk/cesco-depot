# CESCo Depot Product Requirements Brief

## Product objective

CESCo Depot is the operational middleware between client organizations, their distributed technical assets, downstream customer endpoints, carriers, storage providers, field technicians, repair resources, and financial/accounting services.

The product should make a complex national asset lifecycle feel simple to the customer.

The customer should be able to:

1. Bring CESCo their existing asset and location data.
2. Identify what outcome is needed.
3. See which asset, spare, service location, carrier, or field resource can satisfy that need.
4. Authorize only what their role permits.
5. Track custody, condition, placement, work, evidence, cost, and next action from one place.
6. Export their own data without lock-in.

## Primary customer problem

The alternative is fragmented coordination across spreadsheets, ticketing systems, carrier portals, repair vendors, storage facilities, technician notes, accounting systems, and institutional knowledge.

CESCo Depot should reduce that fragmentation without forcing the customer to recreate their operation manually inside the platform.

## Core product principles

### 1. Existing customer data comes first

Manual entry remains available for small accounts and exceptions, but bulk onboarding is the normal path for any organization with meaningful scale.

The platform must support bulk import and export for:

- endpoints
- assets
- asset readiness and compatibility metadata
- parts / stocked components
- eventually users and role assignments under stricter controls

CSV should be the first implementation format because it is simple, portable, and easy to validate. XLSX support should follow using the same import pipeline.

### 2. Ownership, custody, placement, and condition are independent

The platform must never infer ownership from where an asset is located or who currently holds it.

### 3. Location types are distinct

The platform distinguishes:

- client organization
- downstream/client endpoint
- CESCo-managed or partner service location
- storage position within a service location
- transit/custody state

### 4. Movement is bidirectional

The same model must support:

Endpoint
-> carrier/technician
-> service location
-> storage/repair/readiness
-> carrier/technician
-> another endpoint

and the reverse.

### 5. CESCo is middleware plus execution

CESCo may perform work directly or coordinate execution through carriers, couriers, storage operators, repair partners, or national field-service networks.

The platform must preserve provenance regardless of who performs the physical step.

### 6. Customer experience hides provider complexity

Customers should not need to visit separate carrier, storage, payment, or field-service portals to understand routine CESCo-managed work.

Provider-specific integrations should be replaceable adapters behind CESCo Depot.

### 7. Operational authority and financial authority are separate

Helpdesk, dispatch, field, billing, audit, and administrator roles must remain independently permissioned.

### 8. Core records remain under CESCo control

Carrier APIs, payment processors, storage systems, and accounting integrations may contribute events and actions, but CESCo Depot remains authoritative for the operational record.

## Required customer journeys

### Self-service onboarding

Public landing page
-> create account
-> create client organization
-> first user becomes CLIENT_ADMIN
-> import endpoints/assets or add manually
-> invite users
-> assign client roles
-> begin service workflows

### Bulk onboarding

Download template or upload existing file
-> identify entity type
-> map columns
-> validate
-> review errors and duplicates
-> preview changes
-> confirm import
-> commit
-> import summary
-> retained audit history

### Strategic spare response

Trouble ticket
-> request compatible spare
-> rank known-good candidates
-> reserve
-> create dispatch
-> provider accepts custody
-> deliver/install
-> optionally collect failed unit
-> route return to service network
-> repair/restock/dispose

### Service and reverse logistics

Endpoint
-> shipment/dispatch
-> service location
-> receiving
-> storage/repair/readiness
-> redeploy or return

### Carrier-neutral shipment

Customer chooses shipment action
-> CESCo Depot selects/uses carrier adapter
-> label/tracking created
-> normalized tracking events ingested
-> custody/workflow state updated
-> delivery/exceptions visible in one portal

### Financial settlement

Operational event
-> charge/estimate/invoice logic in CESCo Depot
-> payment handled by external processor
-> payment result returned by webhook
-> optional accounting synchronization

## First implementation priorities

### Priority 1 - Bulk asset and endpoint import

Build a safe CSV import path before adding more manual-entry UI depth.

MVP requirements:

- organization-scoped import permission
- endpoint template
- asset template
- upload CSV
- map source columns to CESCo fields
- dry-run validation
- duplicate detection
- explicit create/update/skip behavior
- row-level error report
- preview counts
- confirmation before write
- import audit record
- export endpoint and asset CSV

### Priority 2 - Integration adapter interfaces

Define internal interfaces for:

- carrier
- payment processor
- accounting synchronization
- storage access
- field-service provider

Do not couple core models to one vendor.

### Priority 3 - Storage qualification

Extend ServiceLocation with a qualification profile and separate protected access-secret model.

### Priority 4 - Guided customer navigation

Reduce user dependence on knowing domain object names.

Customer-oriented actions should read more like:

- Import my locations
- Import my assets
- Request service
- Request a replacement
- Send equipment back
- Track shipments
- View stocked spares
- Invite my team

## MVP bulk-import acceptance criteria

A CLIENT_ADMIN with a new organization containing no assets should be able to import at least 1,000 asset rows without manually creating those assets one by one.

The system must:

- reject rows outside the user's organization scope
- detect duplicate CESCo asset tags
- allow a stable client-provided external ID
- resolve endpoints through stable identifiers rather than only names
- show all validation failures before commit
- never silently overwrite an ambiguous record
- preserve an auditable ImportJob record
- produce an error file or equivalent row-level report
- allow the customer to export the resulting records

## Non-goals for first bulk-import slice

The first implementation does not need:

- arbitrary ETL scripting
- continuous bidirectional synchronization
- direct CMDB/RMM integrations
- background million-row ingest
- automatic fuzzy merge
- automatic financial reconciliation

Those should build on the same validation/import service later.

## Product test

Every major feature should answer at least one of these better than the customer's fragmented alternative:

- What do we have?
- Where is it?
- Who has it?
- What condition is it in?
- Is it ready?
- What happened?
- What needs to happen next?
- Who can authorize it?
- What will it cost?
- What evidence proves the handoff?
