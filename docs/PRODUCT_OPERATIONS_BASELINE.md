# CESCo Depot — Product and Operations Baseline
Status: Architecture reset draft
Date: 2026-10-11
Repository baseline: main at 75bed38bbb6ad4009b18daecdbaa27cbce26c6e4

## Purpose and position
CESCo Depot is a multi-tenant service operations system through which CESCo provides contracted asset stewardship and fulfillment services to MSPs, OEMs, national service organizations, and enterprise asset operators. CESCo is a service infrastructure partner, not a competing MSP. Customer equipment remains customer-owned absent an explicit documented transfer.

## Revenue-bearing service catalog
1. Receive, inspect and register shipments and equipment.
2. Provide secure custody and recurring storage services.
3. Maintain serialized and quantity-based inventory and reconcile counts.
4. Configure, stage, test, and document deployment readiness.
5. Position approved equipment at strategic stock locations.
6. Pick, pack, ship and coordinate field dispatch.
7. Receive returns and provide reverse logistics.
8. Diagnose, repair, retest and restore equipment to stock.
9. Conduct authorized disposition, recycling, or donation with ownership evidence.

Each service must define initiation, authorization, performer, required evidence, completion rules, charging rules and exceptions.

## Customers and tenancy
- CESCo is the platform operator; each customer account is an isolated tenant.
- A customer may be an MSP acting on behalf of multiple end customers. Separate commercial customer, asset owner, managed end customer, and authorized requestor. Never assume they are identical.
- A user may have scoped roles in one or more customer accounts. Roles and permissions must be enforced server-side in data reads and writes.
- Cross-tenant visibility, custody, operational changes and invoicing are prohibited by default.
- Support optional delegated end-customer visibility without exposing other accounts.

## Core entities (logical; not yet a Prisma migration)
CustomerAccount; ManagedEndCustomer; Party; Membership; ServiceAgreement; AgreementService; RateSchedule; ServiceRequirement; Site; Facility; StoragePosition; AssetModel; SerializedAsset; StockLot; AssetOwner; CustodyEvent; ConditionObservation; ConfigurationRevision; ReadinessTest; WorkOrder; WorkOrderLine; Authorization; Receipt; Shipment; ShipmentLine; InventoryReservation; InventoryMovement; EvidenceRecord; ServiceEvent; ChargeEvent; InvoiceExport; ExceptionCase.

Required distinctions: legal ownership vs customer account; physical location vs custodian; available vs reserved vs quarantined vs in-transit; contractual service target vs actual provider performance; executed work vs billable charge.

## Operational invariants
1. No physical asset movement without an auditable movement event.
2. No charge-producing service without an agreement, accepted quotation, or explicit authorization rule.
3. Stock cannot be reserved or dispatched twice; concurrency requires transactional enforcement.
4. Receipt and shipment quantities reconcile to expected manifests; variance creates an exception.
5. Readiness claims must refer to a recorded, recent approved test or configuration evidence.
6. An asset owner change requires explicit authorization and evidence.
7. Every tenant-scoped query applies server-side account authorization.
8. Immutable event history is retained; corrections create follow-up events.
9. Failed processes and unavailable dependencies yield actionable exceptions, not silent success.
10. The system must calculate charges from evidence, but invoices remain reviewable before issue.

## First paid workflow (MVP vertical slice)
Scenario: MSP contracts CESCo to hold ten customer-owned replacement switches.
1. CESCo creates a customer account, delegated contacts and a service agreement.
2. Agreement covers receiving fees, unit-based recurring custody fees, and dispatch fees.
3. MSP provides expected equipment manifest, ownership, site data, and approved service rules.
4. CESCo receives a shipment, reconciles contents, records serials, condition and evidence.
5. CESCo assigns assets to storage positions; portal shows what is available, reserved or unavailable.
6. Monthly custody accrual creates reviewable charges with asset, date range and rate provenance.
7. Authorized request for a switch generates reservation, pick/pack, dispatch and custody handoff events.
8. CESCo records outbound evidence and a dispatch charge; customer sees status and audit history.
9. CESCo reviews charges, exports invoice data, and can explain each line item.
10. An exception (missing serial, damaged box, disputed ownership, failed dispatch) is visible and cannot silently pass.

Definition of done: Perform all steps with no client-specific code, verify tenant isolation, reproduce charges from events, and complete an exception-path test.

## SLA and readiness intelligence
Customers supply targets and authoritative equipment/site requirements. CESCo records fulfillment obligations within its control and measures performance. Coverage analysis, minimum spare recommendations, confidence levels and replenishment suggestions consume actual inventory, service locations, transport capabilities and contractual targets. Never equate dispatch time with restored service. Unknown inputs must be shown as unknown.

## User interfaces
CESCo console: intake queue, exceptions, receiving, stock movements, work queue, dispatch queue, custody, service history, charges, SLA exceptions.
Customer portal: inventory and condition, available ready-to-ship quantities, asset ownership and location, open requests and shipments, contracted services, evidence and invoice detail.
Both project from one authoritative operational record; no independent dashboard-only facts.

## Growth requirements
Same transaction primitives for one or 1,000 customer accounts. Facilities and partners may grow independently. Async jobs must be idempotent and retriable. Add account scoping indexes, background processing, observability, backups, retention policy and operational metrics before production scale.

## Migration and implementation policy
- Do not reset the existing database or deploy schema-breaking migrations before inventory, backup and dependency audits.
- Preserve main and its Git history as the original baseline.
- Reuse proven authentication, tenant controls, custody, asset and workflow code only after tests and review.
- Add architecture changes on this branch; stage schema migrations and feature flags separately.
- Security and finance acceptance tests are release gates.

## Immediate audit checklist
- Enumerate schema models, routes, API handlers, tests, existing workflows and migrations.
- Map each to keep / refactor / retire / missing.
- Verify tenant isolation, permission checks, transactional inventory, charge provenance and data retention.
- Identify live data and backup needs before destructive actions.
- Decide first clean MVP schema changes only after the audit.
