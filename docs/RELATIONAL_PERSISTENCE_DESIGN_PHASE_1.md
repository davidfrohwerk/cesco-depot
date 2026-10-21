# CESCo Depot — Relational Persistence Design, Phase 1: Domain and Transaction Boundaries

- **Status:** Design draft; not a migration or production implementation
- **Date:** 2026-10-20
- **Decision basis:** ADR-0001; original conversation PDFs in `docs/history/`; current `rebuild/customer-to-invoice` source
- **Change scope:** Documentation only

## Evidence basis

Direct source review: `app/src/lib/domain.ts`, `app/src/lib/store.ts`, `app/tests/rebuild.test.ts`, `app/tests/http.test.ts`. The current State shape exposes 16 top-level collections (`plans`, `organizations`, `users`, `endpoints`, `equipment`, `intakes`, `rates`, `requests`, `activities`, `invoices`, `settlements`, `audit`, `operationalEvents`, `imports`, `evidence`, `invites`). State is currently serialized as a single `depot_v2_state` row for either SQLite or PostgreSQL; sessions and login limits are separately stored. Transaction processing takes a write lock on that aggregate row, so cross-tenant writes cannot scale independently.

The original *Enterprise IT SLA Example* and *Project Platform Vision* conversations remain the primary evidence of business intent. This file is a design interpretation, **not** a paraphrase to replace those originals. Any unimplemented proposed table is labeled proposed.

## Model boundaries to preserve

1. **Account organization**: tenant/account is the mandatory ownership/security scope for each client operational record. Global identity must not accidentally confer cross-tenant access. Internal CESCo authorization may have explicit cross-tenant capabilities.
2. **Supported equipment population**: customer-declared equipment and endpoint relationships describe where continuity is needed. This is not the same as a physically held spare or a custody claim.
3. **Physical unit**: persistent immutable internal ID, client-scoped customer equipment ID, manufacturer/model/serial operational identity, configuration, purpose and readiness/condition tracked distinctly. Manufacturer+serial duplication rules should be evaluated with tenant scoping, casing/normalization and controlled exceptions.
4. **Expected intake vs verified receipt**: customer declaration, arrival, inspector observation, variance resolution, CESCo acceptance, and custody transfer are separate evidentiary events.
5. **Facility and capacity**: distinguish customer-visible facility/region from restricted bins and positions, along with handling capacity, dedicated/shared assignment and movement history.
6. **Recovery fulfillment**: request, financial authorization, compatible reservation, pick/pack, package revision, label, carrier handoff, delivery and installation are separate transitions. Delivery alone does not establish operational recovery.
7. **Return/repair**: failed-unit return, assessment, authorization, repair/OEM activity, independent readiness verification, replenishment or authorized disposition.
8. **Commercial lifecycle**: versioned approved rates, authorized billable activity, immutable charge amounts/periods, invoices/lines, settlements, credit application, refunds, cost and approvals.
9. **Evidence and audit**: immutable evidence metadata + stored content digest, actor, time, account, subject, capture provenance and access/disclosure history; do not conflate presence of metadata with confirmed recoverability.
10. **Planning**: client requirements and rate/uncertainty provenance are distinct from modeled spare quantity and calculated geographic coverage.

## Proposed relational aggregates (names provisional)

| Aggregate | Proposed core entities | Most important relational safeguards |
|---|---|---|
| Tenant and identity | organizations, identities, memberships, sessions, invites, role_grants | user/global identity vs account membership; scoped permissions, expiry |
| Customer topology | endpoints, supported_equipment, configuration_profiles, compatibility_pools | account-level identifiers, FK account consistency, normalized lookup |
| Physical inventory | physical_units, ownership_claims, condition_observations, verification_events | immutable unit ID; no READY state without valid verification/custody |
| Intake/custody | intake_orders, expected_unit_lines, receipts, receipt_observations, reconciliations, custody_events | declaration != receipt; discrepancy lock; event provenance |
| Facilities | facilities, storage_positions, capacity_allocations, position_movements | restricted position access, valid occupancy, no double allocation |
| Recovery/dispatch | service_requests, authorizations, reservations, pick_packs, packages, labels, carrier_handoffs, deliveries | one active reservation per physical unit; valid request/status transitions |
| Repair/return | failed_returns, assessments, repair_authorizations, repair_jobs, verification_results, dispositions | approval ceiling/cost integrity, independent verifier |
| Finance | rate_versions, approvals, billable_activities, invoice_headers, invoice_lines, settlement_events, credit_ledger | approved rate version, unique accrual period, immutable posted entries, balanced reductions |
| Evidence/audit | evidence_objects, evidence_links, evidence_access_events, audit_events | content-hash retention, accountable access, tenant and entity linkage |
| Planning/import | import_jobs, import_rows, spare_plans, planning_inputs | idempotent commits, source preservation, explicit modeled assumptions |

**Important:** this is a *candidate decomposition*. The user-facing domain should not be forced to copy these particular names, and some tables may combine or split after transaction design and constraint review. Do not migrate from the old Prisma schema by name alone.

## Transaction boundaries to demonstrate with SQL-backed tests

### T1 — Bulk onboarding commit
Input: validated customer imports (e.g. 100 endpoints, 1,000 supported devices, 20 spares).
Atomic changes: create/update applicable customer-scoped records and import job outcome. A failed constraint must not commit a partial import. Repeated requests must not duplicate identities.

### T2 — Physical receiving and discrepancy
Input: expected unit + documented inspection/identity.
Atomic changes: receipt, observation, custody eligibility and event. Mismatch must remain in exception until authorized reconciliation; import alone must not grant custody.

### T3 — Verified readiness and reservation
Input: request for a supported configuration/pool.
Atomic changes: verify eligible unexpired readiness and single active reservation. Two concurrent requests must never claim the same physical unit. Prefer DB-enforced reservation uniqueness/locking, not process-local mutexes.

### T4 — Shipment release and carrier tender
Input: valid reservation, package revision, authorized financial ceiling, documented pick/pack.
Atomic changes: authorized release/handoff transition and immutable external references. External carrier API is an out-of-transaction side effect requiring idempotent outbox/reconciliation, not a call inside a long DB transaction.

### T5 — Return, repair, quality verification and restock
Input: returned failed device, authorization and inspection/repair outcome.
Atomic changes: custody and quality state; restock eligibility requires independent verification. Financial expenditure ceiling checks must remain authoritative.

### T6 — Service charging and invoice issue
Input: accepted/authorized activity and approved rate version.
Atomic changes: unique charge and period, invoice lines and ledger posting. Do not use floating-point money. Repeated issue requests must be idempotent.

### T7 — Payments, credits and refunds
Input: externally verified financial event/reference.
Atomic changes: append-only settlement/credit events and derived balances with idempotency reference. A refund must not silently erase original charge or payment history.

### T8 — Evidence ingestion
Input: approved file and authenticated actor.
Atomic changes: evidence metadata/account/subject/event linkage. File/object bytes and DB commit cannot generally be one transaction: use staging, content digest, immutable object key and periodic reconciliation/cleanup plus restore testing.

## Security and data access principles

- Every operational query must explicitly account-scope or enforce verified database row-level policy; foreign keys should prevent cross-account entity relationships where feasible.
- Authentication status and authorization are not interchangeable. API error distinction (401 unauthenticated, 403 forbidden, 404 undisclosed resource) remains pending.
- Customers may see higher-level storage location and status, but **must not** receive internal source bin or position fields from nested shipment, repair or replenishment records.
- Staff authority is role-specific: operational access does not automatically include financial privilege.
- Audit entries, evidence access, approvals and ledger records must retain actor and provenance even when user status changes.

## Migration and validation sequence — not yet authorized to execute

1. Inventory current SQLite development records and externally held evidence; take verified restorable backups.
2. Define stable logical entity IDs, tenant-key strategy, FK/unique/check and versioning rules.
3. Create an isolated PostgreSQL test database and application role; leave historical `depot` untouched.
4. Build a repository abstraction mapping existing domain operations to SQL transactions. Avoid a big-bang cutover; use contract-based tests that run against both persistence implementations where appropriate.
5. Validate T1–T8 on real PostgreSQL with parallel actors, rollback, conflicts, retries and crash recovery; compare outputs to baseline tests.
6. Drill coordinated DB/evidence backup and restore; verify hashes and balanced financial state.
7. Switch the development instance only after explicit review, then run Gates A–F before any live operations.

## Open questions requiring explicit decisions

- Physical spares vs supported fleet: one shared equipment identity model or separate lifecycle tables?
- Multiple client organizations underneath one MSP: single account vs nested tenant responsibilities and consent boundaries?
- Whether configuration profiles require immutable versioned artifacts in storage.
- Which custody events need two-party acknowledgment versus CESCo-only observation.
- Financial posting, tax, invoicing and external payment provider reconciliation boundaries.
- Expected operating size, partitioning/indexing and acceptable performance envelopes.
- PostgreSQL application role and row-level security strategy.
- Choice of ORM/query layer; Prisma not precluded by ADR-0001.

This document proposes no changes to the running development server, database, old Prisma schemas, or test artifacts.
