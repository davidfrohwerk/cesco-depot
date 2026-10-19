# CESCo Depot — Operational Readiness Review (initial static assessment)

Date: 2026-10-19
Target: `rebuild/customer-to-invoice`
Scope: repository source review and previously reported 66-test/build verification on the development VM. No live penetration test, infrastructure inspection, PostgreSQL restore drill, or customer acceptance sign-off was performed.

## Readiness decision

**Development/training: continue. Unsupervised live customer custody, financial operations and evidence processing: NOT APPROVED.**

Working workflows and passing unit/domain tests are not equivalent to secure, recoverable, multi-tenant production operation. This review distinguishes present controls, observed risks and items needing operational validation. Findings below are source-based unless labeled as unverified or prospective.

## Implemented and exercised

- Tenant-scoped onboarding, equipment and compatibility validation, intake reconciliation and correction; tests in `app/tests/rebuild.test.ts`.
- Distinct preparation, review, release, physical pick-pack, label, tender, and evidence-backed carrier custody actions; training accounts cannot create real dispatches.
- Delivery separated from installation; independent failed-unit return, assessment revisions, treatment authorization, repair execution, functional verification and physical replenishment.
- Demo-only repair approval, expenditure ceiling, repair-result, independent QA and placement records preserve actual equipment condition and spare counts.
- Currency input normalization into integer cents; rate approval, authorization ceilings, invoice accounting, credits and external settlement records.
- Scrypt password hashes; random hashed session tokens; role checks; origin checks on writes; per-email login throttling; SHA-256 verification on evidence download.

## Blocking findings — P0

### P0-1: Recovery of the complete system has not been demonstrated
`app/src/lib/store.ts` persists all domain state as a JSON document in `depot_v2_state`. Evidence bytes are separately stored on disk (`DEPOT_EVIDENCE_PATH`) while their metadata and hashes are in the domain state. PostgreSQL and evidence must be restored as one consistent recovery point or explicitly reconciled after recovery. `docs/REBUILD.md` instructs backup of both but does not document an implemented scheduled backup, tested restore, key custody, immutable off-host copy, or quantified RPO/RTO. No production claim should be made until a backup/restore exercise checks records, hashes, permissions, sessions and reconciled custody.

### P0-2: Role-based response minimization needs hardening
`scoped()` in `app/src/lib/domain.ts` returns **all tenant audit records, request objects, operational events and team metadata to any role with `view`**, while only rates/activities/invoices receive finer filtering. Audit details can contain financial and security-sensitive information, and client-side internal bin positions are masked only in equipment fields, not necessarily in audit/event/request payloads. Validate role-specific visibility for CLIENT_ADMIN, HELPDESK, CLIENT_BILLING, AUDITOR, OPERATIONS and FINANCE; explicitly define which fields each may see, and add API tests with financial/custody information deliberately seeded. This is a **potential intra-tenant overexposure**, not a confirmed cross-tenant breach.

### P0-3: Public deployment identity controls are incomplete
`docs/REBUILD.md` explicitly states no MFA, email verification, password recovery, team deactivation interface, or malware scanning. `app/src/app/api/[...path]/route.ts` has no session-revocation or account-locking UI, and evidence upload validates category/MIME but is not malware scanned. Restrict deployment to trusted development access until identity lifecycle and untrusted-file controls are designed and tested. Consider explicit privileged action reauthentication and separate client approval identity.

### P0-4: Actual live custody and financial controls have not been end-to-end integration tested
The 66 standard tests operate at the domain layer. `app/package.json` defines `test:http` separately; routine `npm test` **does not run** `app/tests/http.test.ts`. Its HTTP suite currently boots an ephemeral SQLite-backed dev instance. `docs/REBUILD.md` expressly requires a PostgreSQL integration run. Add a production-like, isolated PostgreSQL/evidence integration suite and independent role tests covering REST authorization, concurrent requests, failed uploads/transactions, and idempotency before a real customer pilot.

## High-priority findings — P1

### P1-1: Persistence and concurrency architecture
The single JSON-aggregate row is serialized/locked for every mutation. This is acceptable for workflow prototyping and a 1000-device test, but it serializes unrelated tenants and requires loading/rewriting the entire state on every action. Split into tenant-keyed indexed relational entities and immutable event/ledger tables before concurrent client production. Plan migrations preserving original observations and evidence hashes.

### P1-2: Audit integrity and evidentiary defensibility
Audit and milestone records are appended through application logic inside a mutable JSON aggregate, not held in an independently protected append-only ledger. A database administrator or application defect could alter prior records without an independently verifiable history. Add tamper-evident event sequencing (hash chain or signed checkpoints), immutable retention policy, clock provenance, and evidence custody/disclosure logs; verify exports and restores.

### P1-3: Financial approval boundaries
`approveFailedTreatment` currently authorizes a versioned scope/reference, but the live `openRecoveryRepair` flow does not include a separately recorded repair expenditure ceiling analogous to the demo. The original request ceiling governs billable `activity` records, not necessarily purchasing/subcontractor costs or repair materials. Introduce a separate approved treatment spending ceiling, cost recognition, amendment/stop-work path and scope-to-charge reconciliation. No automatic payment or refund is currently implemented, which is accurately documented.

### P1-4: Physical storage as a first-class model
Restock records free-text facility and position and verified serial/evidence. There is not yet a normalized facility/zone/bin inventory capacity and access model, nor source-of-truth region, slot or handling constraints. `operations-metrics.ts` deliberately reports several regional/storage indicators unavailable. Create location identities, capacity/reservation rules, cycle counts and discrepancy paths before contractual stock-availability promises.

### P1-5: File durability and upload hygiene
`route.ts` writes evidence to filesystem before committing metadata, deleting files when metadata transaction throws. Crash windows may create orphaned bytes. File category validation is MIME-based; no antivirus scan, content inspection, evidence retention/hold policy or object-storage durability control is shown. Implement staged uploads, independent file integrity scans, reconciliation jobs and bounded retention/access.

### P1-6: Report history and time consistency
`operations-metrics.ts` calculates current ready inventory from present mutable equipment state and filters some event counts by as-of. Do not interpret a historical `asOf` as a reconstructed historical inventory balance. Explicit snapshot/event sourcing needed for point-in-time SLA reporting. Review `docs/OPERATIONS_METRICS_CONTRACT.md` for definitions changed since initial writing.

## P2 — customer and operator usability

- Evidence picker labels should clearly distinguish photographs from text documentation; observed training rejection was valid but confusing.
- `app/README.md` remains generic Next.js boilerplate and lacks operational runbooks, troubleshooting and data-contract documentation.
- Confirm role-based Team navigation and user lifecycle in each portal role; UI screenshots show menu visibility changes by account.
- Add accessible lifecycle summaries and distinct statuses for recovery completion, failed-unit handling, replenishment and pending approvals. Validate account-level reconciliation and available stock dashboards with user scenarios.
- Document courier, OEM, finance and storage-provider manual handoffs, limitations and escalation owners; do not imply external integrations exist.

## Recommended gates and order of work

1. **Gate A — data security:** role-specific scoped payload schemas, audit/event redaction, server-side access regression tests, privileged account lifecycle, policy for evidentiary access.
2. **Gate B — recoverability:** backups of PostgreSQL and evidence, retention/immutability, restoration rehearsal to an isolated instance, record/hash/custody reconciliation with measured RPO/RTO.
3. **Gate C — transaction correctness:** PostgreSQL HTTP/integration testing and failure injection, separate-client concurrency, duplicate/replay tests, reconciliation for filesystem and database split writes.
4. **Gate D — financial authorization:** live treatment expense ceiling, approval/amendment authority, segregation of internal cost from client charge, client-facing dispute/statement process.
5. **Gate E — physical operations:** facility/bin schema, cycle counts, condition/readiness expiration and stock placement acceptance, exception and loss processes.
6. **Gate F — controlled pilot:** internal controlled production rehearsal under actual TLS/ops monitoring, an explicit nonbillable test customer, checklist sign-off, runbook and recovery drill. Only then consider real custody or charges.

## Explicitly not verified

- VM configuration, effective database URL, mounted storage, real backup jobs or recovery point; only application source reviewed.
- Current TLS termination, reverse proxy, firewall/SSH exposure, host patch status, key/secret management, alerting and log retention.
- `npm run test:http`, load tests, browser accessibility/security tests, independent security review, disaster recovery drill, real courier/OEM/payment integrations.
- Whether any live deployment has features differing from the reviewed branch.

**Decision rule:** no operational readiness claim without both code controls and demonstrated deployment tests with logged, independently reviewable results.
