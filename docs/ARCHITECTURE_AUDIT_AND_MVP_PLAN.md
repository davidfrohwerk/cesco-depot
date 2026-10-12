# CESCo Depot — Architecture Audit and First Paid Workflow Plan
Date: 2026-10-11
Source: GitHub main at 75bed38bbb6ad4009b18daecdbaa27cbce26c6e4
Status: static repository inspection; runtime, migrations, database and endpoint security not yet tested

## Inspected
- app/prisma/schema.prisma
- app/package.json
- app/src/app/page.tsx
- app/src/lib/auth.ts
- app/src/app/actions/service-requests.ts
- app/src/app/actions/evidence.ts
- docs/PRODUCT_REQUIREMENTS.md
- docs/SERVICE_BLUEPRINT.md
- docs/WORK_EXECUTION_SCHEMA.md
- repository code search for Agreement, Charge, WorkOrder, AssetMovement and authorization.

## Findings / disposition
| Area | Evidence | Recommendation |
| --- | --- | --- |
| Framework | Next 16.3.8, React 19.2.8, Prisma 7.10.0 | KEEP, test current baseline |
| Organizations and membership | Organization, Membership, Role, Permission in Prisma | KEEP / verify tenant isolation |
| Ownership | Asset account organization separate from owner organization | KEEP / strengthen legal ownership semantics |
| Physical network | ServiceLocation, StoragePosition, endpoints, movements | KEEP / test reconciliation |
| Service request and authorization | ServiceRequest, Authorization; server action with organization permission checks | KEEP / refactor for agreements and batch service |
| Receiving, work orders and evidence | Schema, upload server actions and service blueprints present | KEEP / end-to-end validation |
| Bulk onboarding | Existing product requirements and import models | KEEP / validate 1,000-row workflow |
| Reliability assessments | Schema and npm reliability tests | DEFER UI priority, RETAIN code for later |
| Commercial agreements | No ServiceAgreement model found in inspected schema/search | ADD |
| Rate schedules and charge ledger | No Charge/RateSchedule model found in inspected schema/search | ADD |
| MSP and managed end customer distinctions | OrganizationKind only INTERNAL/CLIENT in inspected schema | REFACTOR relationship model |
| Invoice export | No demonstrated charge-to-invoice path | ADD |
| Customer UI | Homepage emphasizes single-asset service requests | REFOCUS on contracted custody/fulfillment |

## Notable safety findings requiring investigation
- createServiceRequest currently sets missing ownerOrganizationId to asset.organizationId as a legacy baseline. This should not become a general title assumption; prohibit automatic assignment without verified ownership.
- authorizeServiceRequest checks an existing approved authorization inside a transaction but no schema-level uniqueness constraint was confirmed. Test concurrent approvals/idempotency.
- Evidence upload uses filesystem write plus DB transaction/cleanup. Verify durable object storage, virus/content validation, tenancy on retrieval, quota, backup and orphan reconciliation.
- ServiceType is cast from form input without confirmed enum membership validation in the inspected create action. Add explicit validation.
These are review leads, not proof of exploitation or incorrect operation.

## Recommended implementation sequence
1. Produce migration inventory, database backup, and baseline build/test log in the development VM (operator action; not performed).
2. Write first-slice acceptance tests including two tenants, one MSP's managed end customers, ten serialized switches, two price rules (one-time receipt and monthly custody), and a dispatch charge.
3. Add Agreement, AgreementService, RateSchedule and ChargeEvent domain models with tenant-scoped references, effective dates, currency and approval status.
4. Enforce no charge without service authorization; use immutable provenance keys and uniqueness/idempotency constraints to prevent double billing.
5. Implement custody-period accrual using explicit billing boundaries and event-based possession; prorations, minimums and dispute adjustments must be explicit.
6. Implement charge review and CSV invoice export before any payment-processor integration.
7. Adapt existing intake and dispatch flow to create charges only on verified billable milestones.
8. Add MSP/end-client delegation and scope restrictions, then run tenant isolation tests.
9. Render customer contract, inventory, fulfillment, charge and exception views from actual records.
10. Demonstrate the workflow start-to-finish in a nonproduction test database.

## First milestone acceptance tests
- Tenant A cannot read/mutate Tenant B assets, agreements, charges or evidence.
- MSP manages two end-client inventories under one commercial agreement with no cross-customer leakage.
- 10 switches arrive with manifest reconciliation, condition and serial records.
- Missing/damaged switch produces an exception, not silently available inventory.
- A dispatch reservation cannot be double-booked under simultaneous requests.
- One authorized fulfillment advances through pick, pack, custody handoff and shipment.
- Re-running event consumption or accrual does not double-charge.
- Every draft charge links to authorized service, source event, effective rate and customer.
- Charges can be reviewed, corrected by adjustment events and exported.
- No production migration or deletion occurs until backup and migration plan are checked.

## Blocking validation
This is a static review only. No command was run on depot-dev-01; no database inventory/backup, runtime test, security penetration test or full route enumeration was performed. Do not claim deploy-ready until those checks pass.
