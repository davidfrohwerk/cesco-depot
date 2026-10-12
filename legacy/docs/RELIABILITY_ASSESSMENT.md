# CESCo Depot Reliability and Resilience Assessment

## Purpose

This document defines the analytical boundary for CESCo Depot's future infrastructure-resilience assessment.

The assessment is intended to answer five separate questions:

1. Which infrastructure matters enough to warrant strategic recovery planning?
2. How much failure demand should the client plan for?
3. How many useful spare units should exist?
4. Where should those units be positioned to satisfy recovery objectives?
5. What will it cost the client and CESCo to maintain that recovery capability?

Those questions must not be collapsed into a single opaque "recommended spares" number.

## Analytical chain

```
client infrastructure inventory
        |
        v
compatibility / equipment populations
        |
        v
criticality + BIA + recovery objective
        |
        v
reliability evidence selection
        |
        v
failure-demand scenarios
        |
        v
repair pipeline + contingency reserve
        |
        v
candidate spare pool
        |
        v
Central / spoke placement analysis
        |
        v
coverage, cost, confidence, remaining risk
```

## Reliability is evidence, not a magic constant

Annual failure rate is often uncertain because actual field behavior depends on age, revision, environment, power quality, workload, thermal conditions, maintenance, handling, firmware, batch effects, and the definition of "failure."

Depot should therefore store evidence and provenance rather than one authoritative AFR field.

An OEM MTBF number, an observed customer failure rate, and an equipment-class research estimate are different kinds of evidence and should remain distinguishable.

## Initial source hierarchy

The initial research program should prioritize published, independently sourced evidence:

1. exact-model empirical public/OEM field evidence
2. exact-model OEM predicted MTBF/MTTF
3. model-family empirical evidence
4. government reliability handbooks, datasets, and technical repositories
5. licensed electronic / nonelectronic reliability databases
6. published equipment-class research
7. documented conservative planning assumptions when no stronger published source exists

Customer and CESCo operational history may be retained for service provenance and internal analysis, but the customer-facing resilience assessment should not depend on unpublished CESCo-derived AFR claims. If CESCo ever develops original reliability estimates as a separate research product, that work requires its own methodology, validation, governance, and review boundary.

Candidate external source families include:

- OEM technical specifications and reliability statements
- public empirical fleet datasets such as storage-device field data
- published academic / industry field-reliability studies
- Quanterion EPRD / NPRD / related commercial reliability data
- IEC 61709 methods for using and adapting failure-rate data
- IEC TR 63162 generic failure-rate reference data

Licensing, copyright, attribution, and redistribution constraints must be reviewed before external data is embedded in the product.

## Metric normalization

Depot should be capable of storing source metrics in their native form:

- AFR
- failures per operating hour
- FIT / failures per billion device-hours
- MTBF
- MTTF
- probability of failure over a stated interval

Conversions should be derived rather than overwriting the source value.

For constant-hazard planning only:

```
lambda = 1 / MTBF

P(failure during t) = 1 - exp(-t / MTBF)
```

The UI must state that this conversion assumes an exponential / constant-hazard model and is not an observed field AFR.

## Population definition

A useful reliability estimate applies to a population, not merely a product name.

A population may be grouped by:

- manufacturer
- model
- hardware revision
- asset class
- compatibility class
- configuration
- age band
- environment
- duty cycle
- geography
- other class-specific exposure factors

Depot should favor pooling when assets are operationally interchangeable and should avoid pooling superficially similar assets that cannot actually substitute for one another.

## Published evidence adequacy

When Depot uses published empirical field data, the source record should preserve enough context to judge whether the published rate is applicable.

Where the source makes them available, preserve:

- population size
- accumulated device-hours, device-days, months, years, pages, cycles, or other relevant exposure
- observed failures
- observation period
- environment
- equipment age / model scope
- exclusions, censoring, or retirement treatment
- confidence interval or uncertainty statement
- source methodology

Depot should not recompute or embellish unavailable source statistics merely to make records look complete. Missing source context is itself an applicability limitation.

## Demand scenarios

When the reliability evidence is uncertain, produce multiple scenarios rather than one false point estimate.

Example labels:

- LOW
- PLANNING
- STRESS

Each scenario preserves:

- failure-rate assumption
- source evidence
- confidence
- replenishment/repair exposure window
- target service level
- calculated spare requirement

## Recovery objective

A spare has operational value only if it can restore the service within the required time.

A simplified recovery-time composition is:

```
detection / approval
+ CESCo dispatch decision
+ retrieval
+ transport
+ field arrival
+ installation
+ configuration
+ validation
<= recovery target
```

Depot should make each component increasingly empirical as CESCo accumulates operational history.

## Central and spoke logic

The Indianapolis Central hub is initially the receiving, identity, allocation, deep-stock, repair, and rebalancing node.

A spoke exists to reduce recovery time, not merely to provide cheaper physical space.

Central should generally hold:

- deeper reserve
- complete recovery kits
- lower-frequency / expensive spares
- inbound inventory awaiting allocation
- overflow
- repair and readiness work
- rebalancing stock

Spokes should generally hold:

- curated high-criticality inventory
- deployment-ready assets
- capacity selected for actual endpoint coverage

Initial positioning from Central to a spoke is a real cost and should be accounted for separately from passive monthly custody.

## Economic test

For every recommended spare or recovery kit, Depot should eventually compare:

```
expected / modeled cost of downtime exposure
versus
capital + positioning + custody + readiness + expected handling cost
```

A spare that never deploys may still have delivered value by maintaining recovery capability.

The purpose is not to maximize the number of assets stored by CESCo. It is to identify where pooled redundancy reduces lifecycle and downtime cost economically.

## Example evidence outcomes for current test data

The current development test inventory contains useful examples of different evidence states:

- Cisco CBS350-24T-4G: exact-model OEM MTBF is publicly available; useful as a predicted exact-model prior, not an observed AFR.
- Dell OptiPlex 7090: no strong public exact-model whole-system AFR has been established in the current research; use broader evidence and request customer history.
- Lexmark MS521dn: strong usage/duty-cycle information is available, but no strong public whole-device AFR has been established; request page volume and service history and use usage-sensitive assumptions.

These examples are for validating the assessment architecture. They are not production reliability recommendations.

## Prospective client workflow

```
Upload endpoints + mission-critical assets
-> validate / group populations
-> identify missing criticality and recovery inputs
-> enrich with reliability evidence
-> show evidence confidence
-> calculate low/planning/stress reserve scenarios
-> test Central/spoke placement
-> show coverage and cost
-> allow client to refine assumptions
-> preserve final assessment
-> optionally convert recommendation into a CESCo strategic-stocking proposal
```

The client should be able to inspect why each recommendation exists.

## Non-goals for the first assessment slice

The first implementation should not:

- claim to predict exact future failures
- scrape unverified AFR numbers into an authoritative database
- optimize every possible national logistics path
- claim certification or endorsement by NIST, IEC, or any other standards body
- automatically order spare equipment
- automatically commit CESCo storage capacity
- combine tenant operational data across clients without an explicit governed aggregation policy

## First implementation slice

The first software slice should be deliberately narrow:

1. Analyze an organization's existing imported inventory.
2. Group assets by manufacturer/model/compatibility class.
3. Let the user mark or confirm mission-critical groups.
4. Capture RTO, local redundancy, procurement lead time, repair turnaround, and substitutability.
5. Associate one or more reliability-evidence records with a group.
6. Allow low/planning/stress failure assumptions.
7. Calculate a Poisson-based candidate reserve for a selected service level.
8. Display the assumptions and confidence alongside the result.
9. Do not yet optimize geography automatically.
10. Preserve the assessment so a later placement module can consume it.

This slice is sufficient to prove that Depot can turn an uploaded infrastructure inventory into explainable decision support without pretending uncertainty does not exist.


## Implemented foundation

The first product foundation now includes persistent models and workspaces for:

- curated published reliability evidence
- organization-scoped infrastructure assessments
- snapshot equipment populations tied to the source assets
- customer criticality and recovery inputs
- links from an assessment population to one or more published evidence records
- an explicit current planning-basis evidence selection
- future LOW / PLANNING / STRESS scenario records

Current application routes:

- `/reliability` - CESCo internal reliability evidence registry
- `/organizations/[id]/resilience` - client-scoped infrastructure resilience assessment workspace

Creating an assessment snapshots the current asset population into groups using manufacturer, model, asset class, and compatibility class, and records the individual source assets in each population. This preserves the analytical basis even if the live inventory later changes.

The current slice intentionally stops before automatically deriving failure probabilities or spare quantities. The next implementation stage should:

1. define approved transformations from native published metrics to planning inputs
2. calculate a planning failure probability only when the source metric and assumptions support it
3. implement Poisson service-level reserve calculations
4. create LOW / PLANNING / STRESS scenarios
5. keep contingency reserve separate from independent-failure demand
6. display the full source -> transformation -> model-input -> output chain


## Implemented statistical engine boundary

The first calculation engine now supports a deliberately narrow set of automatic transformations:

- MTBF or MTTF expressed in hours -> annual unit failure probability using `1 - exp(-8760 / MTBF)`
- published FIELD_AFR expressed as percent -> annual unit probability by dividing by 100
- published FIELD_AFR or FAILURE_PROBABILITY already expressed as a unit probability -> used as supplied

Unsupported metric/unit pairs, including unqualified generic failure rates or FIT values, are not guessed. They remain evidence until an approved transformation is implemented.

For a supported annual probability `p`, population `N`, and exposure window `L` days:

```
expected annual failures = N * p
expected demand in window = N * p * (L / 365)
```

The statistical reserve is the smallest integer `S` for which:

```
P(Poisson(expected demand) <= S) >= target service level
```

The calculated statistical reserve and an explicit contingency reserve remain separate. The initial engine records repair-pipeline reserve as zero rather than double-counting repair exposure; repair-pipeline optimization belongs in the later METRIC-type multi-echelon stage.

LOW and STRESS sensitivity scenarios are optional. Depot does not impose default multipliers. If an analyst/customer supplies a multiplier, it is preserved as a planning assumption rather than represented as publisher-supplied uncertainty.


## Automated source-enrichment requirement

Reliability research is a platform responsibility, not a customer data-entry task.

The intended customer flow is:

```
customer imports assets
-> Depot identifies manufacturer/model/class
-> Depot queries/matches approved reliability sources
-> Depot parses native source metrics and conditions
-> Depot ranks applicable evidence
-> Depot selects a defensible planning basis when one exists
-> Depot calculates scenarios
-> customer reviews the recommendation and only supplies operational facts
   that Depot cannot infer from public technical data
```

The customer should not be asked to locate MTBF/AFR values, interpret OEM reliability documents, select a Quanterion record, or manually attach evidence to a model.

The internal reliability registry is an evidence cache / provenance store and an administrative fallback, not the normal workflow.

The source-enrichment engine should support adapters for:

- OEM technical/documentation sources
- government technical and reliability repositories
- FCC equipment-authorization enrichment where applicable
- public empirical fleet datasets
- licensed Quanterion EPRD/NPRD/FMD/ROADS data when CESCo has rights to automate access
- other approved published sources

Each adapter should return structured candidate evidence with source provenance, native metric, conditions, specificity, confidence signals, and licensing metadata. The engine then ranks candidates against the client asset population.

When no defensible source is found, Depot should report the evidence gap automatically rather than ask the client to research it.

Manual evidence entry remains available only as an internal research/admin override for unusual sources, corrected metadata, or sources that cannot yet be machine-ingested.
