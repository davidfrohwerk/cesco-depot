# CESCo Depot

Managed IT custody, client-owned strategic spares, recovery execution, and accountable billing. This replacement is on `rebuild/customer-to-invoice`. The previous screens have been removed from the active application; historical specifications and migrations are in `legacy/`.

## Run locally

Requires Node.js 24 or newer. The application keeps a persistent local database without needing PostgreSQL for development.

```bash
cd app
npm ci
cp .env.example .env.local
read -r -p 'Administrator email: ' DEPOT_ADMIN_EMAIL
read -r -s -p 'Administrator password (12+ characters): ' DEPOT_ADMIN_PASSWORD
export DEPOT_ADMIN_EMAIL DEPOT_ADMIN_PASSWORD
npm run bootstrap
unset DEPOT_ADMIN_PASSWORD
npm run dev
```

Open `http://127.0.0.1:3000`. Sign in with the administrator account to use operations and finance. Create a separate free client account to test the client perspective. There is no default password or demo bypass. For separate internal staff accounts, set `DEPOT_STAFF_EMAIL`, `DEPOT_STAFF_PASSWORD` and `DEPOT_STAFF_ROLE` (`OPERATIONS` or `FINANCE`) in your shell, run `npm run create-staff`, then unset the password.

## Test the complete transaction

1. Register a free client organization. Registration creates no work order or charges.
2. In Onboarding, download/import endpoint CSV; validate the preview, inspect source rows, and confirm. Import supported equipment and spares next. Use your own column names through mapping.
3. In Intakes, select the client-held spares and declare what is being sent and why.
4. As operations, select that client account. Record carrier acceptance to create the work order. Reconcile observed serial, condition, depot, and internal position on receipt. A mismatch becomes an exception.
5. In Equipment, record test results against the approved configuration and a validity interval. Received equipment is not ready until tested. Reposition verified inventory to strategic stocking locations with custody evidence as needed.
6. As the client, request recovery for supported endpoint equipment. Operations prepares the quote; the client approves scope, terms version, and ceiling. Operations reserves a compatible current spare, records dispatch and delivery/installation, then failed-unit return, repair, and verification as applicable.
7. In Billing, finance creates the agreed rate. The client approves it. Operations records completed services against accepted intake or service work orders. Finance approves charges, issues an invoice, and records verified external payments, prepaid credits, applied credits, or refunds.
8. Download the invoice, billing CSV, equipment CSV, and audit history. Evidence files retain integrity hashes and are checked at download.

Planning scenarios use the installed population and supplied failure/exposure assumptions. They retain the analytical snapshot and show ordinary spare demand, separately stated contingency stock, current ready stock, and quantity gaps. Delivery estimates are compared against endpoint recovery targets during dispatch.

## Validation

```bash
cd app
npm test
npm run test:http
npm run build
```

Domain tests include the 100-endpoint / 1,000-supported-device / 20-spare acceptance case through invoice issuance. The HTTP suite uses an isolated temporary database and exercises authentication, origin checks, client isolation, imports, evidence downloads, invitations, and transaction rollback/concurrency.

## Azure deployment

Use a separate checkout and a separate database for this branch. Do not run historical Prisma migrations. See [docs/REBUILD.md](docs/REBUILD.md) for the architecture, exact isolation requirements, deployment, and remaining integration work.
