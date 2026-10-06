# CESCo Depot Platform — Build Record

## Project purpose

CESCo Depot is being developed as a client-facing platform supporting:

- depot repair services
- client asset and inventory management
- strategic stocking / cold-spare programs
- hardware and software configuration management
- dispatch of known-good replacement equipment
- return-to-stock workflows
- decommissioning and disposition
- charitable donation of eligible decommissioned equipment to CESCo
- reuse, refurbishment, parts harvesting, and recycling
- chain of custody and asset provenance
- future workforce-development and circular-economy metrics

The current Azure VM is the first development/reference implementation.

## Current checkpoint

As of 2026-10-06:

- Azure VM is operational
- SSH access works
- Ubuntu is updated
- Hostname is `depot-dev-01`
- Docker Engine and Docker Compose are operational
- PostgreSQL 17 is healthy
- Redis 7 is healthy
- Next.js 16.3.8 project exists
- Tailwind CSS 4 is installed
- Prisma 7.10.0 is operational
- PostgreSQL connectivity works
- Prisma schema validates
- Initial database migration has been applied
- Application feature development has not yet begun

---

## Azure deployment history

The first Azure VM deployment failed preflight validation with:

`InvalidTemplateDeployment`

Azure Monitor attempted to create the metric alert:

`Percentage CPU - depot`

The generated Action Group resource ID contained an invalid resource-group reference:

`resourceGroups/De;l\\_group`

The malformed value appeared in multiple generated deployment references.

Rather than continue repairing a deployment with stale/malformed resource references, the initial deployment was discarded and the VM was recreated cleanly.

The replacement VM deployed successfully.

---

## SSH access

Azure SSH public-key authentication is used.

Linux administrative account:

`depot`

An initial Windows OpenSSH connection failed because the downloaded private key inherited permissions granting access to:

`CESCO-LAPTOP\CodexSandboxUsers`

OpenSSH therefore rejected the key as insufficiently protected.

The Windows ACL was corrected using `icacls`, inheritance was removed, and access was restricted appropriately.

SSH authentication then succeeded.

---

## Host and project layout

The operating-system hostname was changed to:

`depot-dev-01`

The naming convention is intended to support future systems such as:

- `depot-dev-01`
- `depot-stage-01`
- `depot-prod-01`

Project root:

`/opt/cesco/depot`

Project directories:

- `app`
- `backups`
- `docs`
- `infra`
- `scripts`

Git has been initialized with the `main` branch.

---

## Docker infrastructure

Docker Engine was installed from Docker's official Ubuntu repository.

The current Docker Compose stack contains:

### PostgreSQL

- Image: `postgres:17`
- Container: `depot-postgres`
- Database: `depot`
- Database user: `depot_app`
- Persistent volume: `postgres_data`

PostgreSQL is bound to:

`127.0.0.1:5432`

It is not intentionally exposed on the VM's public network interface.

### Redis

- Image: `redis:7-alpine`
- Container: `depot-redis`
- Persistent volume: `redis_data`
- AOF persistence enabled

Redis remains internal to the Docker network.

Both containers currently report healthy status.

---

## Next.js application

Application path:

`/opt/cesco/depot/app`

Current principal dependencies:

- Next.js 16.3.8
- React 19.2.8
- React DOM 19.2.8
- TypeScript 5
- Tailwind CSS 4
- ESLint 9

The initial npm audit identified high-severity findings in development/lint dependencies.

At the initial checkpoint:

`npm audit --omit=dev`

reported zero runtime vulnerabilities.

`npm audit fix --force` was deliberately avoided because npm proposed breaking dependency changes.

---

## Prisma history

Prisma was initially installed without pinning a major version.

That installed a Prisma 8 release candidate.

The Prisma 8 RC dependency tree and configuration differed from the intended stable environment, so it was removed.

Stable Prisma 7 was then installed.

Current version:

`Prisma CLI 7.10.0`

The Prisma 8 configuration left behind a `prisma.config.ts` using an incompatible configuration function.

That file was rewritten for Prisma 7 using `defineConfig`.

The Prisma schema also initially contained the older datasource form:

`url = env("DATABASE_URL")`

Prisma 7 rejected that property inside the schema.

The database URL was therefore moved to `prisma.config.ts`, and the schema datasource now defines only the PostgreSQL provider.

The generated Prisma Client is written to:

`app/generated/prisma`

---

## Database credential issue

The original PostgreSQL password was generated using:

`openssl rand -base64 36`

The resulting password contained characters that caused URI parsing problems when embedded in the PostgreSQL connection URL.

Prisma reported:

`P1013: The provided database string is invalid. invalid port number in database URL.`

Because the database contained no application data yet, a URL-safe hexadecimal password was generated using:

`openssl rand -hex 32`

The development database volume was recreated using the new credentials.

Database connectivity subsequently succeeded.

---

## Initial database schema

The initial schema contains:

- Organization
- Site
- Asset
- AssetEvent
- WorkOrder

The Asset model is intended to be the central domain object.

Ownership, custody, location, service history, lifecycle state, and eventual disposition are intended to remain distinguishable.

AssetEvent is intended to form the basis of append-oriented provenance and chain-of-custody history.

---

## Initial migration

The first migration was successfully created and applied:

`20261006134503_initial_core`

Prisma currently reports:

`Database schema is up to date!`

---

## Architectural decisions

The initial application will be a modular monolith rather than a microservice architecture.

Planned functional areas include:

- identity and accounts
- organizations
- sites
- assets
- depot repair
- inventory
- strategic stocking
- logistics
- donations
- disposition
- reporting
- administration

Important design principles established so far:

1. The asset is the central domain object.
2. Ownership and physical custody are separate concepts.
3. Important lifecycle changes should create durable event records.
4. Strategic stocking must capture configuration and SLA requirements, not merely inventory counts.
5. Infrastructure should ultimately be reproducible from source rather than manually cloned.

---

## Unresolved and follow-up items

- Re-run `npm audit --omit=dev` after the final Prisma 7 installation.
- Authentication has not yet been implemented.
- Authorization and tenant isolation have not yet been implemented.
- The Next.js application is not publicly exposed.
- Reverse proxy and TLS are not configured.
- Database backup and restore procedures are not yet implemented.
- Production secrets management has not yet been selected.
- AssetEvent immutability is not yet enforced by application logic.
- Strategic stocking models are not yet implemented.
- Donation, title-transfer, and disposition models are not yet implemented.
- Data-sanitization workflows are not yet implemented.
- File/photo object storage has not yet been selected.
- Production deployment and scaling architecture remain future work.

---

## Next functional milestone

The next implementation sequence is:

`Organizations -> Sites -> Assets -> Asset History`

The first application slice should demonstrate creation of an organization and site, registration and receipt of an asset, and durable recording of its lifecycle history.
