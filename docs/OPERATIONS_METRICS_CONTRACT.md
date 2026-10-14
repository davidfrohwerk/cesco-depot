# CESCo Depot — Operations & Metrics Contract (v1)

## Purpose and service boundary
CESCo Depot manages client-owned IT custody, strategic stocking, fulfillment, returned-unit intake, depot assessment, repair, configuration, warranty coordination, and authorized disposition. The customer's field technicians perform endpoint installation and removal. Depot fulfillment does **not** imply CESCo performs field installation.

The standard exchange is **one verified spare shipped, one failed device expected back**. The original dispatch and the failed-device return are related obligations, not the same event. A returned failed unit must never count as a ready spare until the customer's chosen disposition, required work, and independent verification have completed.

## Measurement rules
1. All metrics are tenant scoped, date-stamped and versioned.
2. Every unit, denominator, inclusion/exclusion rule and clock start/stop must be documented.
3. Null/unavailable is not zero. A dashboard must never pretend an SLA was met when events or targets are missing.
4. Record physical observations, client claims, CESCo verification and carrier confirmations separately.
5. Corrections append explanations and references; they do not erase original custody/evidence.
6. Keep recorded service charges, issued invoices, payments, credits and cost of service distinct.
7. A historical claim requires stored event milestones/snapshots. Current-state inventory cannot be projected backward.
8. Changes to definitions require a new contract version; reports identify the version used.

## Currently measurable using the rebuild's records
- **Verified ready stock**: spare + READY + GOOD + CESCo custody + unexpired, independently recorded verification + no active allocation.
- **Ready by compatibility**: group ready stock by approved compatibility pool and configuration, not merely model.
- **Open recovery requests**: nonterminal recovery requests.
- **Pending failed-device return**: recovery requests DELIVERED or RETURNING, not yet returned.
- **Awaiting assessment**: FAILED units marked RETURNED in CESCo custody.
- **Receipt discrepancies**: equipment with EXCEPTION status.
- **Unverified client-owned spares in custody**: CESCo-held spares not counted as READY.
- **Recorded service charges**: activity amounts filtered by performedAt within the reporting period; these are neither cash receipts nor full fulfillment costs.

## Requires further instrumentation before reporting values
| Metric | Necessary source events or dimensions |
|---|---|
| Regional availability | Stable facility and region identifiers for physical stock locations; transport service coverage |
| Spare requirement deficit | Client-approved requirement by pool, configuration, geography and effective period |
| Warehouse utilization | Usable capacity and occupied volume with matching unit and allocation policy |
| Fulfillment performance | Request confirmation, accepted fulfillment option, reservation, pick, pack, carrier scan, delivery and exceptions |
| Expected return aging | Replacement delivery, return due, customer carrier handoff, CESCo receipt and reconciliation |
| Warranty turnaround | OEM submission, acceptance, resolution, return received and independently verified |
| Repair turnaround | Bench assessment, separately authorized work, start/pause events and verified completion |
| Replenishment time | Link outbound spare, failed return, approved remediation and return-to-ready replacement stock |
| Upgrade/rollout progress | Plan revisions, target inventory and endpoints, wave execution, deployment confirmations |
| Recurring cost | Contracted rate versions, charge period, custody allocation, billable activity, invoice and settlement |

## Minimum future event envelope
`eventId`, `orgId`, `entityType`, `entityId`, `eventType`, `occurredAt`, `recordedAt`, `actor`, `source`, `payloadVersion`, `correlationId`, `evidenceIds`, `metadata`, `supersedesEventId?`.

Existing audit entries are not silently recast as complete operational milestones: many currently contain free-text details without an authoritative clock boundary. Preserve them as legacy observations and supplement them as new event types are introduced.

## Required next workflows
1. Standing service agreement and versioned fulfillment tariff.
2. Package profile, verified physical stock location, endpoint destination and carrier-rate adapter.
3. Customer confirms delivery option and displayed cost; CESCo allocates/picks/packs/ships with traceability.
4. Return obligation linked to original replacement order, but tracked independently.
5. Customer authorizes warranty handling, bench assessment/repair, return-as-is, continued storage or donation review.
6. After assessment/repair/imaging, independent readiness verification before stock replenishment.
7. Outcome dashboard and historical series based on event timestamps and meaningful denominators.

The current operations metrics implementation is a **baseline of live measurements and explicitly unavailable measures**, not a completed historic performance reporting system.
