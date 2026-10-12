# Replacement operating platform — 12 October 2026

## Product decisions carried forward

Registration is free. There is no portal-access membership charge. Onboarding establishes supported endpoints, equipment, configurations and compatibility pools. Supported equipment and held spares are separate. Cold spares are client-owned. Expected intake is shipment-based. Carrier acceptance opens the work order; registration, imports and expected intake do not. Receiving reconciles what actually arrived. Readiness is a CESCo observation with a validity interval, not a client assertion or automatic consequence of receiving.

The central hub can place inventory at strategic stocking locations. CESCo manages shelf/bin positions; clients see the location, custody, condition, readiness and recovery progress. A client equipment identifier is required for repeatable imports; the internal UUID is generated automatically. Manufacturer/serial identity is checked within the account rather than treated as globally unique. Spare compatibility requires the approved pool and configuration, not manufacturer/model similarity alone.

An authenticated service authorization captures actor, scope, ceiling, terms version and timestamp. Operational requests and financial approvals have separate permissions. Revised ceilings pause execution until approved. Donation/disposition requires its own specific service authorization and recorded evidence; custody does not confer ownership.

Billing supports agreed pricing units, performed quantities, contractual rate snapshots, recurring/storage periods, actual internal costs, finance review, invoice issuance, Net terms, account funding/credit memos, credit application, externally verified payments and refunds. Payment collection and service authorization remain separate. Storage measurement, rates, proration basis and cadence are configurable account decisions, not fabricated defaults. No subscription, deposit or processor selection is assumed. Storage/recurring quantities are entered against the approved measurement basis and explicit period; overlapping accrual for the same source/rate is rejected.

## Active implementation

- Next.js 16 / React 19 / TypeScript, a fresh responsive client and operations interface, without legacy navigation.
- Server-side organization scope and role checks on each read/mutation; authenticated sessions use hashed random tokens, 12-hour expiry and HttpOnly cookies. Production cookies require HTTPS. Passwords use scrypt; minimum length is 12. Origin checks reject cross-origin writes. Authentication attempts are throttled per email.
- PostgreSQL on Azure via `DEPOT_DATABASE_URL`; persistent SQLite fallback via `DEPOT_DATABASE_PATH` for local single-host development. Neither consumes the previous `DATABASE_URL` automatically. New tables are prefixed `depot_v2_` and never alter historical tables. Use a dedicated database in deployment.
- The first rebuild stores the domain as one transactionally locked aggregate, with immutable issued-charge snapshots and append-only financial/audit records. PostgreSQL uses a row lock; SQLite uses a write transaction and an in-process queue. This is suitable for validating the complete workflow and the tested thousand-device onboarding case. It is not a horizontally scaled enterprise data model: split the aggregate into indexed relational tables before substantial concurrent multi-client production use.
- Tenant-scoped CSV imports support mapping, validation, explicit confirmation, duplicate checks, retained source records and error exports. Commit revalidates against current data. Imports are create-only; existing records are never silently overwritten. CSV exports neutralize spreadsheet formula prefixes.
- Evidence originals are stored outside the database under random keys with SHA-256 hashes, actor and linked entity. Downloads enforce scope, verify bytes and create an access event. Files are served as attachments.
- Independent-failure planning uses Poisson quantiles (a labeled normal approximation at large demand). Inputs include an attributable annual failure assumption, exposure window, target probability and separately stated contingency reserve. Population and assumptions are snapshotted. The calculation is decision support and does not establish geographic coverage or an SLA.

## Roles

| Role | Capabilities |
|---|---|
| System administrator | All functions; created only from the server console |
| Operations | Client onboarding, custody, readiness, work execution; cannot review/issue invoices or approve client financial scope |
| Finance | Agreements, review, invoices, external settlement; cannot execute custody workflows |
| Client administrator | Own account onboarding, requests, financial approvals, billing, team invitations |
| Helpdesk | Own account operational visibility and request creation, without settlement or authorization authority |
| Client billing | Own account financial visibility and financial/service approval |
| Auditor | Own account read-only operational and provenance visibility |

System administrator can test every role's workflow but all approvals identify that actor. Production separation should use distinct users. Internal Operations/Finance accounts are provisioned by the server-console `npm run create-staff` command; there is no public internal-role escalation endpoint. Client invitation links are shown for authorized manual sharing; the application sends no invitation email.

## Deploy next to the existing Azure development app

The existing application and database have not been changed remotely by this work. Run the rebuild from another worktree or clone, with Node 24+. Keep the previous application available for rollback.

```bash
cd /opt/cesco/depot
git fetch origin
git worktree add /opt/cesco/depot-rebuild rebuild/customer-to-invoice
cd /opt/cesco/depot-rebuild/app
npm ci
cp .env.example .env.local
```

If the branch is not yet local, create the worktree from `origin/rebuild/customer-to-invoice`. For PostgreSQL, create a **new** `depot_v2` database using the existing database administrator, then put its URL in `.env.local` as `DEPOT_DATABASE_URL`. Use `127.0.0.1:5432` when the Next.js process runs on the host. URL-encode special characters in the password. Set an absolute, durable `DEPOT_EVIDENCE_PATH`. Only `depot_v2_*` tables are initialized. No reset, migration of existing customer data, or destructive operation is required.

For a local SSH-tunnel review, leave `DEPOT_ORIGIN=http://127.0.0.1:3001`, bootstrap the administrator from environment variables, and run:

```bash
npm run dev -- --port 3001
```

Forward local port 3001 to remote `127.0.0.1:3001`. Browse `http://127.0.0.1:3001`. This permits review without replacing port 3000. For a deployment, set `DEPOT_ORIGIN` to the actual HTTPS portal URL, run `npm run build`, and run `npm start -- --port 3001` behind the HTTPS reverse proxy. Store the database/evidence on durable volumes and back up both together. SQLite fallback requires Node 24, one durable host, and a consistent SQLite backup rather than copying a live database file without its WAL.

## Verification and operational limits

Domain and HTTP tests cover bulk scale, duplicate handling, stale imports, identity scope, receiving exceptions, compatibility, readiness expiry, reservation exclusion, delivery/return/restock, repair/OEM, donation authorization, charge ceilings/change orders, immutable rate snapshots, review/issuance, credits, refunds, storage-overlap rejection, origin checks, invitations, evidence download, transaction rollback and queued concurrent writes. TypeScript and the optimized production build are also checked.

The local test environment has no PostgreSQL service; the PostgreSQL branch is type-checked, and its row-lock transaction logic requires an integration run on the Azure database before accepting live customers. Browser layout verification was unavailable; responsive CSS is implemented but has not been inspected in an actual browser here.

This is a functioning replacement for end-to-end review, not a claim that third-party services are connected. Carrier acceptance, delivery estimates, OEM progress, and external payments/refunds are explicitly recorded by authorized staff. No carrier label/tracking API, field-network API, payment checkout/webhook or accounting sync is configured. No actual payment or refund is initiated. Invoice export is text/CSV; taxation, credit-note compliance and accounting mappings need the chosen commercial/accounting configuration. Recurring charges have protected periods but are not automatically scheduled. There is no direct XLSX ingest, import update/merge, automated public reliability-source lookup, optimizer for geographic stocking, workforce training metrics, MFA, email verification/password recovery, team deactivation interface or client bootstrap migration. Uploaded-file antivirus scanning is not configured. These are concrete follow-on integration/production tasks, not simulated features.

## Source ownership

The Git repository is the source of truth. Historical schemas/specifications are archived in `legacy/`; they do not participate in the rebuild runtime. The rebuild database is initialized empty except for the deliberately bootstrapped administrator. No sample rates, invented inventory or default credentials are created.
