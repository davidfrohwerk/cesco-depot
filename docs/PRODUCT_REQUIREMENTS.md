# CESCo Depot Product Requirements Brief

## Product objective

CESCo Depot is the operational middleware between client organizations, their distributed technical assets, downstream customer endpoints, carriers, storage providers, field technicians, repair resources, and financial/accounting services.

The product should make a complex national asset lifecycle feel simple to the customer.

The customer should be able to:

1. Bring CESCo their existing asset and location data.
2. Identify what outcome is needed.
3. See which asset, spare, service location, carrier, or field resource can satisfy that need.
4. Authorize only what their role permits.
5. Track custody, condition, placement, work, evidence, cost, and next action from one place.
6. Export their own data without lock-in.

## Primary customer problem

The alternative is fragmented coordination across spreadsheets, ticketing systems, carrier portals, repair vendors, storage facilities, technician notes, accounting systems, and institutional knowledge.

CESCo Depot should reduce that fragmentation without forcing the customer to recreate their operation manually inside the platform.

## Core product principles

### 1. Existing customer data comes first

Manual entry remains available for small accounts and exceptions, but bulk onboarding is the normal path for any organization with meaningful scale.

The platform must support bulk import and export for:

- endpoints
- assets
- asset readiness and compatibility metadata
- parts / stocked components
- eventually users and role assignments under stricter controls

CSV should be the first implementation format because it is simple, portable, and easy to validate. XLSX support should follow using the same import pipeline.

### 2. Ownership, custody, placement, and condition are independent

The platform must never infer ownership from where an asset is located or who currently holds it.

### 3. Location types are distinct

The platform distinguishes:

- client organization
- downstream/client endpoint
- CESCo-managed or partner service location
- storage position within a service location
- transit/custody state

### 4. Movement is bidirectional

The same model must support:

Endpoint
-> carrier/technician
-> service location
-> storage/repair/readiness
-> carrier/technician
-> another endpoint

and the reverse.

### 5. CESCo is middleware plus execution

CESCo may perform work directly or coordinate execution through carriers, couriers, storage operators, repair partners, or national field-service networks.

The platform must preserve provenance regardless of who performs the physical step.

### 6. Customer experience hides provider complexity

Customers should not need to visit separate carrier, storage, payment, or field-service portals to understand routine CESCo-managed work.

Provider-specific integrations should be replaceable adapters behind CESCo Depot.

### 7. Operational authority and financial authority are separate

Helpdesk, dispatch, field, billing, audit, and administrator roles must remain independently permissioned.

### 8. Core records remain under CESCo control

Carrier APIs, payment processors, storage systems, and accounting integrations may contribute events and actions, but CESCo Depot remains authoritative for the operational record.

## Required customer journeys

### Self-service onboarding

Public landing page
-> create account
-> create client organization
-> first user becomes CLIENT_ADMIN
-> import endpoints/assets or add manually
-> invite users
-> assign client roles
-> begin service workflows

### Bulk onboarding

Download template or upload existing file
-> identify entity type
-> map columns
-> validate
-> review errors and duplicates
-> preview changes
-> confirm import
-> commit
-> import summary
-> retained audit history

### Strategic spare response

Trouble ticket
-> request compatible spare
-> rank known-good candidates
-> reserve
-> create dispatch
-> provider accepts custody
-> deliver/install
-> optionally collect failed unit
-> route return to service network
-> repair/restock/dispose

### Service and reverse logistics

Endpoint
-> shipment/dispatch
-> service location
-> receiving
-> storage/repair/readiness
-> redeploy or return

### Carrier-neutral shipment

Customer chooses shipment action
-> CESCo Depot selects/uses carrier adapter
-> label/tracking created
-> normalized tracking events ingested
-> custody/workflow state updated
-> delivery/exceptions visible in one portal

### Financial settlement

Operational event
-> charge/estimate/invoice logic in CESCo Depot
-> payment handled by external processor
-> payment result returned by webhook
-> optional accounting synchronization

## First implementation priorities

### Priority 1 - Bulk asset and endpoint import

Build a safe CSV import path before adding more manual-entry UI depth.

MVP requirements:

- organization-scoped import permission
- endpoint template
- asset template
- upload CSV
- map source columns to CESCo fields
- dry-run validation
- duplicate detection
- explicit create/update/skip behavior
- row-level error report
- preview counts
- confirmation before write
- import audit record
- export endpoint and asset CSV

### Priority 2 - Integration adapter interfaces

Define internal interfaces for:

- carrier
- payment processor
- accounting synchronization
- storage access
- field-service provider

Do not couple core models to one vendor.

### Priority 3 - Storage qualification

Extend ServiceLocation with a qualification profile and separate protected access-secret model.

### Priority 4 - Guided customer navigation

Reduce user dependence on knowing domain object names.

Customer-oriented actions should read more like:

- Import my locations
- Import my assets
- Request service
- Request a replacement
- Send equipment back
- Track shipments
- View stocked spares
- Invite my team

## MVP bulk-import acceptance criteria

A CLIENT_ADMIN with a new organization containing no assets should be able to import at least 1,000 asset rows without manually creating those assets one by one.

The system must:

- reject rows outside the user's organization scope
- detect duplicate CESCo asset tags
- allow a stable client-provided external ID
- resolve endpoints through stable identifiers rather than only names
- show all validation failures before commit
- never silently overwrite an ambiguous record
- preserve an auditable ImportJob record
- produce an error file or equivalent row-level report
- allow the customer to export the resulting records

## Non-goals for first bulk-import slice

The first implementation does not need:

- arbitrary ETL scripting
- continuous bidirectional synchronization
- direct CMDB/RMM integrations
- background million-row ingest
- automatic fuzzy merge
- automatic financial reconciliation

Those should build on the same validation/import service later.

## Infrastructure resilience assessment

CESCo Depot should support a prospective or existing client uploading a broad inventory of mission-critical IT infrastructure, rather than requiring one asset at a time, and produce an explainable strategic-spares assessment.

The assessment is advisory decision support. It must not present uncertain reliability estimates as facts or imply that a mathematically generated spare count guarantees availability.

### Assessment sequence

The intended sequence is:

1. Ingest endpoints and assets.
2. Group assets into compatible equipment populations.
3. Identify potentially mission-critical classes.
4. Collect or infer the operational variables needed to assess consequence and recovery.
5. Select the best available reliability evidence for each equipment population.
6. Model expected failure demand over the replenishment / repair exposure window.
7. Add repair-pipeline and correlated-event considerations where applicable.
8. Calculate alternative spare-pool scenarios at explicit service levels.
9. Test candidate inventory placements against recovery-time and geographic constraints.
10. Present Central-only and Central-plus-spoke alternatives with cost, coverage, assumptions, uncertainty, and remaining risk.

### Reliability evidence registry

Depot must not reduce reliability knowledge to a single unqualified AFR field.

Reliability evidence is a versioned body of evidence. A record should be able to preserve:

- manufacturer
- model / model family
- asset class
- metric type: FIELD_AFR, FAILURE_RATE, MTBF, MTTF, FAILURE_PROBABILITY
- value and unit
- evidence type
- equipment specificity
- source and source date
- methodology
- observed population and exposure
- failure count where available
- operating environment
- temperature / duty-cycle or class-specific exposure factors
- observed versus predicted status
- confidence
- applicability notes
- effective / superseded dates
- provenance

Evidence types should include at least:

- CLIENT_FIELD
- CESCO_FIELD
- PUBLIC_FIELD
- OEM_FIELD
- OEM_PREDICTED
- COMMERCIAL_SURROGATE
- RESEARCH_SURROGATE
- PLANNING_ASSUMPTION

Specificity should include at least:

- EXACT_MODEL
- MODEL_FAMILY
- ASSEMBLY_CLASS
- COMPONENT_CLASS
- EQUIPMENT_CLASS

Reliability evidence is append-only for analytical purposes. New evidence may supersede the planning basis without destroying the historical basis used for earlier recommendations.

### Evidence-selection hierarchy

When multiple sources are applicable, the inference engine should prefer published evidence approximately in this order, subject to methodological quality and environmental applicability:

1. exact-model empirical public or OEM field data
2. exact-model OEM predicted reliability
3. model-family empirical data
4. government reliability handbooks, datasets, and technical repositories
5. comparable assembly/component surrogate field data
6. equipment-class research
7. documented conservative planning assumption

Client and CESCo operational history may support lifecycle provenance and internal analysis, but it should not automatically become a customer-facing reliability estimate.

A higher-ranked source should not automatically win if exposure is too small, conditions are materially different, or the observation period is inappropriate.

### Confidence and uncertainty

Every generated recommendation must report confidence and uncertainty.

At minimum, Depot should distinguish:

- HIGH: strong applicable empirical exposure and adequate sample
- MODERATE: exact-model prediction or credible comparable empirical evidence
- LOW: broad surrogate or planning assumption
- INSUFFICIENT: not enough evidence for a useful point estimate

Where AFR or failure demand is uncertain, Depot should present a range or scenario set rather than a falsely precise recommendation.

Example:

- low-failure scenario
- planning scenario
- stress scenario

The customer should be able to see how the recommended spare pool changes across those scenarios.

### Exposure models are equipment-class specific

Depot should not assume calendar time is the only meaningful exposure variable.

Examples:

- network equipment: powered hours, temperature, load, PoE load, environment
- printers: page volume, job volume, maintenance cycles, age
- storage devices: drive-days, power-on hours, workload, age
- UPS systems: battery age, discharge cycles, temperature, load
- PCs / edge systems: age, duty cycle, storage type, thermal environment and subsystem history

The reliability model may therefore request different supplemental data depending on the asset class.

### Business-impact and recovery inputs

Failure probability alone does not determine whether a spare should be stocked.

The assessment should capture or request:

- mission criticality
- business impact
- recovery time objective / maximum tolerable downtime
- local redundancy
- substitutable models / compatibility pools
- procurement lead time
- repair turnaround
- field replacement time
- configuration / imaging time
- technician requirement
- customer downtime cost where the customer can supply it

NIST-style business-impact and recovery planning informs the consequence and recovery side of the recommendation. Reliability evidence informs failure demand. These must remain conceptually separate.

### Statistical demand model

For relatively independent failures, Depot may use a Poisson demand model as an initial planning method.

For an installed population N, annual failure rate AFR, and exposure window L days:

```
expected annual failures = N * AFR
expected failures during exposure window = N * AFR * (L / 365)
```

Depot should choose a spare quantity against an explicit target service level rather than merely rounding expected failures upward.

The calculation must preserve the assumptions used, including whether the failure rate was observed, predicted, or assumed.

Poisson is not appropriate for every failure process. Correlated events, aging populations, common-mode failures, batch defects, environmental events, software/firmware defects, and other non-independent mechanisms must be treated separately or surfaced as model limitations.

### Repair pipeline and repairable-spares planning

For repairable equipment, Depot should distinguish:

- total spares owned
- available spares
- deployment-ready spares
- failed assets
- assets in transit
- assets awaiting repair
- assets under repair
- assets awaiting QA
- assets returning to stock

Expected repair-pipeline inventory can be estimated from failure demand and average repair turnaround, then refined with observed operational data.

A METRIC-type multi-echelon approach is appropriate for optimizing repairable spare pools across a Central hub and regional spokes, but it should consume the reliability and recovery assumptions rather than replace them.

### Correlated-event reserve

A statistically adequate pool for independent failures may still be insufficient for common-mode events.

Depot should support a separately identified contingency reserve for events such as:

- firmware defects
- manufacturing-lot problems
- severe weather
- power events
- cyber incidents
- configuration mistakes propagated across a fleet
- complete-store or site-level loss

A complete-store recovery kit is one example of contingency capacity that serves a different purpose from ordinary component-level statistical reserve.

### Coverage and placement

Quantity and placement are separate decisions.

After calculating a candidate spare pool, Depot should evaluate placement against:

- endpoint geography
- carrier / courier transit times
- service-location retrieval time
- field-technician availability
- installation / configuration time
- customer RTO

A spare only contributes to coverage when it can reasonably be delivered and placed into service inside the applicable recovery target.

The product should eventually compare scenarios such as:

- current customer inventory
- Indianapolis Central only
- Central plus one spoke
- Central plus two or more spokes

For each scenario, show:

- spare capital required
- CESCo custody / storage cost
- initial positioning and expected rebalancing cost
- modeled endpoint coverage
- estimated recovery window
- confidence
- remaining uncovered risk

### Standards-grounded, not standards-branded

Depot may use established bodies of practice and published methods, including NIST continuity/BIA guidance, IEC reliability methods, Poisson demand modeling, and METRIC-type repairable-spares optimization.

The product must identify which method contributes to which part of the analysis and must not imply that a recommendation is itself certified, guaranteed, or endorsed by a standards body.

### Recommendation provenance

Every recommendation must preserve a reproducible analytical record containing at least:

- organization / assessment
- asset population and compatibility pool
- source inventory snapshot or import job
- criticality and recovery assumptions
- reliability evidence records selected
- reliability estimate / range used
- confidence
- replenishment and repair assumptions
- statistical method and parameters
- target service level
- correlated-event reserve assumption
- placement scenario
- generated recommendation
- generation timestamp
- model / ruleset version

A later recommendation may change when evidence or assumptions change, but the prior recommendation and its basis must remain auditable.

### Source and inference boundary

Customer-facing reliability assessments should rely on known, attributable published evidence wherever possible.

Depot must preserve the distinction between:

- publisher-supplied facts
- CESCo-derived conversions or normalization
- selected planning assumptions
- statistical model outputs
- CESCo recommendations

CESCo operational history remains valuable for provenance, service improvement, and possible future research, but the product should not present internally observed rates as authoritative external reliability benchmarks without a separate validated research program.

### Prospective-customer assessment experience

A prospect should be able to upload an infrastructure inventory and receive an initial resilience assessment without first converting every row into an active service obligation.

The first-pass assessment should:

- identify asset populations
- identify probable mission-critical equipment classes
- flag missing information that materially affects the recommendation
- show where model-specific reliability evidence exists or is weak
- avoid fabricating AFR values
- produce provisional low / planning / stress scenarios where uncertainty is meaningful
- identify compatibility pooling opportunities
- identify obvious single points of recovery exposure
- recommend which additional questions the client should answer
- preserve a path from assessment to an actual strategic-stocking proposal

The assessment should demonstrate CESCo's value before the client commits physical inventory to CESCo custody.

## Product test

Every major feature should answer at least one of these better than the customer's fragmented alternative:

- What do we have?
- Where is it?
- Who has it?
- What condition is it in?
- Is it ready?
- What happened?
- What needs to happen next?
- Who can authorize it?
- What will it cost?
- What evidence proves the handoff?
