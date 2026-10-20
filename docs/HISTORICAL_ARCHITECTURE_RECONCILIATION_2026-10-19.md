# CESCo Depot — Historical Architecture Reconciliation (initial evidence review)

Date: 2026-10-19
Purpose: preserve an evidence-led comparison of architecture generations before touching the existing PostgreSQL database.
Disposition: **Review only. No database migration or production approval.**

## Source hierarchy and scope
1. Original conversation PDFs supplied under CESCo_Depot; original bytes are the primary record of contemporary discussions. Five additional conversations await archive upload to `docs/history`.
2. Git branches checked directly: `main`, `architecture-reset-2026-10`, `rebuild/customer-to-invoice`.
3. Current VM observations supplied by operator: PostgreSQL 17.11, database `depot`, role `depot_app`, 44 visible user tables; rebuilt `.env.local` and inspected dev process lack `DEPOT_DATABASE_URL`.
4. Existing operational readiness review `docs/OPERATIONAL_READINESS_REVIEW_2026-10-19.md`.

**Do not conflate:** a past proposal, committed schema, migrated physical database, populated database, and tested operational behavior.

## Architectural lineage

### A. Original `main` — relational PostgreSQL/Prisma
`app/prisma/schema.prisma` specifies PostgreSQL and models identity, membership/permissions, assets, endpoints, physical storage, package receiving, shipments, custody observations/movements, work orders, external service, and reliability assessment. `app/package.json` depends on Prisma 7 and pg. An initial migration `app/prisma/migrations/20261006134503_initial_core/migration.sql` exists.

**Evidence boundary:** a model declaration and migration source do not prove current live schema matches that commit or prove correct custody behavior.

### B. `architecture-reset-2026-10` — relational model incrementally adapted
This branch retains Prisma/PostgreSQL but expands the schema beyond `main`: directly inspected models and relations include `ServiceAgreement`, `CommercialCharge`, and `ReceiptReconciliation`. Its package scripts add `test:commercial`. The *Enterprise IT SLA Example* conversation describes an effort to remove mandatory customer CESCo asset tags and adapt onboarding, followed by the conclusion that the application's workflows remained misaligned.

**Evidence boundary:** these branch-level additions were inspected in source; they are not proven to be present in the currently running 44-table database. The absence of an obvious Invoice table in the 44-table listing is not by itself a complete description of any historical financial design.

### C. `rebuild/customer-to-invoice` — operational rebuild
The *Project Platform Vision* conversation records building and publishing a separate rebuild after emphasizing client-owned spares, advance onboarding, verification of physical receipt, strategic stocking, and first-class billing. Its `app/package.json` no longer contains Prisma; `app/src/lib/store.ts` selects PostgreSQL with `DEPOT_DATABASE_URL`, otherwise Node SQLite, and stores domain state as a single JSON payload in `depot_v2_state`. Both database choices use the aggregate-state implementation.

The current VM `.env.local` and inspected process did not contain `DEPOT_DATABASE_URL`, so the running rebuild is expected to use the SQLite fallback; verify the true effective runtime backend before claiming certainty.

**Critical distinction:** running PostgreSQL 17 on the host does not mean the rebuilt application uses the original Prisma schema.

## Decisions from original conversations that constrain any new schema

- *Enterprise IT SLA Example*: customer onboarding establishes supported endpoints, equipment population and operational purpose before normal expected arrivals; manufacturer serial is not universally globally unique; system IDs should be generated; receipt is a physical observation, not customer declaration. Initial advice to permit receiving-led creation was revisited and qualified later in the same discussion.
- *Project Platform Vision*: customers own initial spares; CESCo provides storage, custody, readiness, logistics and accountability; commercial pricing, approval, charges, invoices, credits, and refunds are first-class requirements.
- *Calculate Cold Spares Needs*: distinguish stochastic spare quantity from geographic positioning and operational restoration time; initial failure rates in examples were illustrative assumptions; preserve explicit source and uncertainty for planning inputs.
- *Climate Controlled Storage Research*: receiving at a third-party facility, physical placement, CESCo-verified equipment identity, and acceptance into managed inventory are separate handoffs. A storage operator's publicly advertised services do not establish a verified contractual capability.
- *Azure VM Validation Fix*: endpoint-facing vocabulary and importer must accommodate realistic customer records; recovery targets were moved from location-level records to supported equipment.
- *Asset upload validation error*: later rebuilt import/physical-receipt, dispatch/return/repair, financial and security behavior developed iteratively; source records are authoritative rather than recollected summaries.
- *Rebuild context frustration*: previous conversation loss prompted preservation of full records and explicit limitations of reconstructed context.

## Preliminary reuse assessment — candidates, not approvals

| Concern | Existing historical structures | Required verification before reuse |
|---|---|---|
| Accounts/permissions | Organization, User, Membership, Role, Permission | Tenant-scope constraints, staff/client separation, identity lifecycle and server enforcement |
| Equipment | Asset, Endpoint, AssetEvent, AssetObservation | Immutable identity, account-scoped uniqueness, customer declarations vs verified observations |
| Facility/capacity | ServiceLocation, StorageLocation, StoragePosition | Hierarchical capacity, secure exposure boundary, valid occupancy and movement rules |
| Custody/logistics | Receipt, Package, Shipment, AssetMovement, DispatchAssignment | Explicit custody transfer proofs, carrier handoff, counterparty, idempotency and rollback |
| Repairs | WorkOrder, WorkOrderEvent, WorkOrderPart, ExternalServiceCase | Independent verification, cost ceilings, ownership and authorized disposition |
| Financials | WorkActivity plus later ServiceAgreement/CommercialCharge models | Complete approved rates, immutable charge lineage, invoicing, credit, settlement and refund ledger |
| Evidence | Evidence, EvidenceAccessEvent | Original retention, SHA-256, disclosure logs, storage durability and jointly restorable metadata |

## Explicit uncertainty / next discovery steps

1. Determine whether the live `depot` schema is a migrated version of `main`, `architecture-reset-2026-10`, or a distinct intermediate commit. Compare `_prisma_migrations`, DDL, constraints and foreign keys **read-only**.
2. Determine whether any original relational tables have actual records and whether their content needs separate preservation, without claiming empty or populated from table names.
3. Establish exact current rebuild database and file/evidence locations by inspecting effective runtime configuration safely; do not reveal passwords.
4. Design **new isolated PostgreSQL database/user** for rebuild integration tests; do not reuse the historical `depot` DB as a test target.
5. Preserve the existing rebuild's synthetic records and stage migration with inventory/financial/evidence reconciliation and rollback.
6. Keep production release blocked by the existing Gates A–F; relational redesign does not substitute for authentication, backup/restore, authorization or physical custody assurance.

## Recommended sequence
Archive remaining five original conversations with SHA-256 manifest; inspect migrations and actual constraints/row counts; produce mapping between original relational entities and current domain state; design isolated tenant-normalized relational schema and migration tests; validate concurrency, recovery and operational correctness before switching runtime.

No runtime or database changes were made by this review.
