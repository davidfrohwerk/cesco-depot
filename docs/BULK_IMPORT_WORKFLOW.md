# CESCo Depot Bulk Import Workflow

## Purpose

Bulk import is the primary scalable onboarding path for customers with more than a small number of endpoints, assets, parts, or configuration attributes.

Manual entry remains available, but customers should not be forced to rebuild an existing inventory record one object at a time.

## Import architecture

Use one reusable import pipeline for CSV first and XLSX later.

Import stages:

1. Upload
2. Parse
3. Map
4. Normalize
5. Validate
6. Match existing records
7. Preview
8. Confirm
9. Commit
10. Report
11. Audit

No database writes occur before confirmation.

## ImportJob

Suggested state model:

UPLOADED
-> MAPPING
-> VALIDATING
-> READY
-> COMMITTING
-> COMPLETED

Failure/alternate states:

VALIDATION_FAILED
COMMIT_FAILED
CANCELLED

Suggested fields:

- id
- organizationId
- submittedByUserId
- entityType
- sourceFormat
- originalFilename
- sourceSha256
- status
- duplicatePolicy
- submittedAt
- validatedAt
- confirmedAt
- committedAt
- totalRows
- validRows
- invalidRows
- createCount
- updateCount
- skipCount
- errorCount

## ImportRow

Retain row-level results long enough to support review and audit.

Suggested fields:

- importJobId
- rowNumber
- rawData / normalizedData
- action: CREATE | UPDATE | SKIP | ERROR
- matchedRecordId
- validationErrors
- warnings

For very large imports, raw source data may eventually live in durable object storage while the database holds summarized row results.

## Stable identifiers

CESCo identifiers and customer identifiers serve different purposes.

### Endpoint

Recommended keys:

- CESCo endpoint ID
- organization-scoped external endpoint ID supplied by customer
- display name

The importer should prefer the external ID for updates.

### Asset

Recommended keys:

- CESCo asset ID
- CESCo assetTag
- organization-scoped external asset ID supplied by customer
- serial number where present

Do not assume serial number is globally unique across every manufacturer.

## Endpoint CSV v1

Recommended columns:

- external_endpoint_id
- name
- endpoint_type
- address_line_1
- address_line_2
- city
- state
- postal_code
- country
- region
- contact_name
- contact_email
- contact_phone
- service_notes
- active

Required:

- external_endpoint_id OR another explicitly selected unique key
- name

## Asset CSV v1

Recommended columns:

- external_asset_id
- asset_tag
- endpoint_external_id
- manufacturer
- model
- serial_number
- asset_class
- compatibility_class
- configuration_version
- status
- description
- last_readiness_verified_at
- next_readiness_due_at
- readiness_notes

Required:

- external_asset_id or asset_tag according to chosen import key

Endpoint references should use endpoint_external_id wherever possible.

## Column mapping

The user may upload columns named differently from CESCo fields.

Example:

Customer CSV:
Store Number, Device ID, OEM, Product, Serial

Mapped to:
endpoint_external_id, external_asset_id, manufacturer, model, serial_number

Mapping should be saved as an optional reusable ImportProfile for later repeat imports.

## Normalization

Normalization may:

- trim whitespace
- standardize blank/null values
- normalize country/state values where unambiguous
- parse dates
- normalize enum case
- normalize boolean values

Normalization must not silently change identity values in a way that could merge different records.

## Validation

Validation happens before commit.

### Endpoint validation

Check:

- organization scope
- required identifier/name
- duplicate external ID in file
- duplicate external ID in database
- endpoint type validity
- postal/country formatting where applicable
- email format where provided

### Asset validation

Check:

- organization scope
- selected identity key
- duplicate identity key in file
- existing asset-tag conflicts
- endpoint reference exists in current organization or same confirmed import set
- asset status validity
- date parsing
- readiness due date does not precede verification date
- compatibility/configuration values are syntactically acceptable

## Duplicate policies

The user must explicitly choose a policy.

### CREATE_ONLY

Existing match:
-> error or skip

No match:
-> create

### UPDATE_MATCHED

Existing unambiguous match:
-> update permitted fields

No match:
-> create

Ambiguous match:
-> error

### SKIP_EXISTING

Existing match:
-> skip

No match:
-> create

Never implement silent fuzzy overwrite.

## Cross-file dependency

Recommended onboarding order:

1. endpoints
2. assets
3. readiness/configuration updates
4. parts

Later, a bundled onboarding import may accept multiple sheets/files and validate the entire dependency graph before commit.

## Preview screen

Before commit, show:

- filename
- entity type
- total rows
- creates
- updates
- skips
- errors
- warnings
- first sample rows
- downloadable error report

The Confirm Import button remains disabled while blocking errors exist unless the user explicitly selects a valid-rows-only policy designed for that import type.

For initial onboarding, prefer all-or-nothing commit for each import job so the resulting state is easier to understand.

## Commit behavior

Use bounded database transactions/batches.

For the first implementation:

- small/medium CSVs can commit transactionally
- update/create only fields included in the approved mapping
- preserve server-owned fields
- never permit organizationId from the file to override the authenticated organization
- record user and importJob provenance
- create appropriate asset/import audit events

## Error reporting

Each invalid row should explain exactly what failed.

Examples:

Row 42:
asset_tag "POS-1007" already exists.

Row 81:
endpoint_external_id "STORE-301" was not found.

Row 93:
next_readiness_due_at occurs before last_readiness_verified_at.

The customer should be able to download errors as CSV, correct the source file, and retry.

## Export workflow

Organization
-> Export
-> choose entity
-> choose current/all fields
-> generate CSV

Initial exports:

- endpoints
- assets
- strategic spare/readiness inventory

Exports must be organization-scoped and permission controlled.

## Permissions

Suggested permissions:

- import.view
- import.create
- import.commit
- export.create

CLIENT_ADMIN:
- all four for own organization

Future custom client roles:
- separately assignable

CESCo internal operations:
- cross-organization capability under existing internal trust boundary

## Security controls

- organization is always derived from authenticated scope
- reject formulas/macros; CSV parser treats cells as data
- XLSX support must not execute macros
- file size and row-count limits
- MIME/extension validation
- source file SHA-256
- filename sanitization
- CSV injection protection on exported values
- authorization checked again at commit time
- import cannot assign internal roles or cross organization boundaries
- audit who uploaded, mapped, confirmed, and committed

## First implementation slice

Build only:

- ImportJob schema
- endpoint CSV template
- asset CSV template
- CSV upload
- fixed-field mapping UI
- validation preview
- duplicate policy
- confirmed commit
- error CSV
- endpoint export
- asset export

This is enough to prove that a customer can onboard a useful inventory without repetitive manual entry.

## Functional acceptance test

Create a disposable client organization.

Prepare:

- 25 endpoints
- 1,000 assets
- 10 deliberately invalid rows
- 5 duplicate asset tags
- 5 references to nonexistent endpoints

Expected:

- upload completes
- preview reports exact counts
- invalid rows identify actionable causes
- no records are written before confirmation
- after correction, 25 endpoints and 1,000 assets import
- imported assets resolve to correct endpoints
- export reproduces the organization-scoped inventory
- another client cannot view/import/update/export those records
