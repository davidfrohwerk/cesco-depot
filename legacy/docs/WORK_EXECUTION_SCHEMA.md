# Phase B Schema: Work Execution, Provenance, Labor, Parts, and Evidence

This phase extends CESCo Depot beyond receiving into the actual execution of technical work.

## Why this phase exists

The prototype demonstrated that asset status changes alone are not enough to explain what happened to client property.

A defensible operational record needs to answer:

- who performed the work
- what they did
- when they did it
- how long it took
- what condition they observed
- what parts were needed or installed
- what evidence supports the record
- how the work-order state changed over time

Internal labor measurement remains separate from customer billing.

## Added domain models

### WorkOrderEvent

Append-oriented operational timeline for a work order.

Supports:
- event type
- from/to work-order status
- actor user when available
- actor label during the pre-authentication prototype
- notes
- system-generated flag
- evidence linked directly to the event

This becomes the detailed answer to:

> What happened during this job?

### WorkActivity

Records labor and operational activity independently of pricing.

Supports:
- work order
- worker user when available
- worker label for prototype/manual operation
- supervisor
- activity type
- start and end time
- duration
- notes
- billable flag
- training flag
- supervised flag
- verification flag

This allows flat-rate, hourly, donated, training, and non-billable work to use the same operational measurement system.

### AssetObservation

Condition observations are separate from asset lifecycle status.

Supports conditions such as:
- known good
- shipping damage
- failed
- intermittent
- repairable
- nonrepairable
- parts-only
- test pending

Observations are timestamped and append-oriented.

### WorkOrderPart

Tracks material and part flow through a job.

Supports:
- required
- ordered
- backordered
- received
- installed
- removed
- returned
- consumed
- cancelled

Includes quantity, cost metadata, source, and lifecycle timestamps.

### Evidence

Creates a first-class metadata record for evidence.

Can be linked to:
- organization
- asset
- work order
- work-order event
- package
- receipt
- uploader

Supports:
- evidence type
- description
- original filename
- MIME type
- storage key
- SHA-256 hash
- capture timestamp
- upload timestamp
- original/derived indicator

This migration creates evidence metadata only. Actual file-storage/upload plumbing is intentionally deferred so CESCo can choose a FLOSS/self-hosted storage implementation deliberately.

## Added enums

- AssetCondition
- WorkActivityType
- WorkOrderPartStatus
- EvidenceType

## Migration safety

All new relations from existing records are optional or represented by new tables, so the existing prototype and intake records should remain valid.

Before migration:

```bash
npx prisma format
npx prisma validate
```

Recommended migration name:

```text
work_execution_foundation
```

Then:

```bash
npx prisma migrate dev --name work_execution_foundation
npx prisma generate
npm run build
```

## Next application slice after migration

The first UI built against this schema should focus on a single received work order and support:

1. Begin intake/inspection.
2. Record a condition observation.
3. Start/log technician activity.
4. End/log technician activity and calculate duration.
5. Add a required part.
6. Set the work order to WAITING_PARTS when appropriate.
7. Record part receipt.
8. Resume repair.
9. Append all meaningful changes as WorkOrderEvent records.
10. Display the operational timeline and total labor on the work-order page.

Evidence upload should follow after the operational record works cleanly.
