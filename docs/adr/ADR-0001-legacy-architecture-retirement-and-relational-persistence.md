# ADR-0001: Supersede legacy application architectures; retain rebuild functional baseline

- **Status:** Accepted
- **Decision date:** 2026-10-20
- **Scope:** CESCo Depot application lineage, persistence architecture and archival controls
- **Branch of record:** `rebuild/customer-to-invoice`
- **Production authorization:** None; operational-readiness Gates A–F remain open

## Context and provenance

The original CESCo Depot application on `main` used PostgreSQL and a Prisma relational schema. Subsequent work on `architecture-reset-2026-10` sought to adapt that application to the actual operational service. The historical *Enterprise IT SLA Example* conversation (archived in `docs/history/Enterprise IT SLA Example.pdf`, especially pages 18–22) records the explicit decision to stop adapting those implementations and start over. The reasons given were persistent mismatches involving asset-centered service requests, endpoint dependencies, mandatory or manual internal asset tagging, fragmented navigation, and receiving workflows not naturally grounded in customer onboarding. The record distinguishes the *software architecture* problem from the underlying technology and recommends preserving old branches and databases as references.

The *Project Platform Vision* conversation (`docs/history/Project Platform Vision.pdf`, pages 1–5) records the rebuilt model and specifically elevates billing to a core operating function. Its acceptance scenario is grounded in clients' supported endpoints, equipment population and client-owned spares; expected intake; verified custody and readiness; authorized fulfillment; returns; and approved charges, payments, credits and refunds. Further operational requirements and qualifications are recorded in `Calculate Cold Spares Needs.pdf`, `Climate Controlled Storage Research.pdf`, `Azure VM Validation Fix.pdf`, and `Asset upload validation error.pdf`. Preserve original records rather than reducing them to this summary.

Repository examination confirmed `main` and `architecture-reset-2026-10` have Prisma/PostgreSQL schemas, while `rebuild/customer-to-invoice` implements the current domain through `app/src/lib/domain.ts` and `app/src/lib/store.ts`. The rebuilt store selects PostgreSQL if `DEPOT_DATABASE_URL` is supplied; otherwise it uses SQLite, and in either case persists a single serialized domain-state document (`depot_v2_state`) rather than normalized domain tables.

Read-only VM observations as supplied by the operator showed:
- PostgreSQL 17.11, database `depot`, role `depot_app`.
- 44 user-visible tables including `_prisma_migrations`, associated with the earlier relational implementation.
- 22 migrations recorded as applied, October 6–11, 2026; no rollback timestamps in the displayed results.
- Estimated nonzero row counts in multiple tables, including `Asset`, `Organization`, `WorkOrderEvent`, `Permission` and `RolePermission`. These are PostgreSQL statistics, not exact counts or evidence of production data.
- Migration checksums were displayed but have **not yet been independently matched** against migration SQL files or a verified database dump.

The record therefore supports treating the old database as populated **historical development evidence**, not a validated target schema for the current application. Exact table constraints, contents, migration parity, backup/restore completeness and whether any records have unique retention obligations remain to be established.

See `docs/HISTORICAL_ARCHITECTURE_RECONCILIATION_2026-10-19.md` and `docs/OPERATIONAL_READINESS_REVIEW_2026-10-19.md`.

## Decision

1. **Supersede `main` and `architecture-reset-2026-10` as operational application designs.** Do not restart feature development on these branches or merge their schemas and workflows wholesale into the rebuild. Keep them intact as historical source.
2. **Select `rebuild/customer-to-invoice` as the continuing functional and acceptance-test baseline.** Retain its current client onboarding, custody, fulfillment, repair, financial, and evidence requirements, subject to further verification and correction.
3. **Replace the rebuild's aggregate-document persistence as a long-term architecture.** Design an isolated, tenant-aware, normalized PostgreSQL persistence model from the *validated current domain and business requirements*; do not copy the old Prisma schema by default. Prisma itself is not disqualified and may be assessed as an implementation option.
4. **Preserve the historical PostgreSQL `depot` database** and associated evidence/files until a verified, restorable backup and retention review are complete. Treat it as read-only for architecture discovery. Do not use it for destructive migration experiments or new integration tests.
5. **Use a separate PostgreSQL test database and controlled migration** for new relational persistence, with parallel verification against the rebuild's acceptance cases. Protect the existing SQLite development state and running dev server while staging the transition.
6. **Preserve evidentiary distinctions:** customer-declared inventory vs verified receipt, equipment identity vs ownership vs custody vs physical location, delivery vs operational recovery, and approved/earned charges vs payment or adjustments.
7. **No production approval is implied.** Operational-readiness Gates A–F (security and authorization; recoverability; transactions/concurrency; financial approval; physical capacity/custody; controlled pilot) continue to gate real customer custody, untrusted evidence and live financial operations.

## Rationale

The earlier schemas demonstrate valuable technical work, but their existence and 22 applied migrations do not resolve the application-domain mismatches documented contemporaneously. Reinstating them would risk reintroducing rejected assumptions. The rebuild establishes a more coherent operational transaction and acceptance basis, but its serialized whole-state writes raise cross-tenant concurrency, transaction granularity, scaling and recovery concerns even when hosted in PostgreSQL. Relational persistence should be designed for the rebuilt domain, not used as a reason to revive the old UI and workflows.

## Consequences and follow-up

- Preserve and hash the source conversations, branches, migration history and historical DB backup before eventual retirement.
- Assess source schema elements individually for potential reuse, with explicit evidence of suitability; no blanket rejection of PostgreSQL or Prisma.
- Define tenant-owned tables, foreign/unique/check constraints, append-oriented custody/evidence/financial ledgers, evidence object identity, and migration/rollback behavior.
- Test simultaneous reservation, authenticated tenant isolation, idempotent billing, evidence restoration, and complete custody/financial reconciliation on isolated PostgreSQL.
- Resolve the incidental Next.js HTTP test artifacts (`.next-http-test` and generated `tsconfig.json` paths) separately; this ADR authorizes no code/configuration change.

## Alternatives considered

- **Continue repairing original branches:** rejected due to repeated domain/workflow mismatches recorded in the source conversations.
- **Adopt existing relational schema wholesale:** rejected; structural completeness and behavior are unverified and the domain assumptions were superseded.
- **Keep serialized aggregate persistence as the production design:** rejected as the long-term target; acceptable only as an existing development baseline pending controlled replacement.
- **Delete old branches/database:** rejected because it would destroy provenance, useful reference code and potentially significant data.

## Open uncertainties

- Whether all 22 migration file checksums match the live PostgreSQL history.
- The exact nature and required retention of historical records and externally stored evidence.
- Effective running process persistence configuration beyond the previously inspected environment.
- Final relational schema shape, ORM choice, cutover method, and performance envelope; to be decided through design and tests, not by this ADR.
