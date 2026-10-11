# CESCo Depot Reliability Source Map

## Purpose

CESCo Depot should ground customer-facing infrastructure resilience assessments in known, attributable reliability evidence rather than create unsupported AFR claims.

This source map identifies high-value source families for research, enrichment, and model inputs.

## Source classes

### 1. OEM technical sources

Use first when exact-model or model-family reliability information exists.

Useful source material may include:

- MTBF / MTTF values
- environmental operating limits
- duty-cycle limits
- expected service life
- component life
- maintenance intervals
- hardware revision information
- reliability prediction methodology
- warranty / service documentation

The original OEM metric must be preserved. If Depot converts MTBF to a planning failure probability, that converted value is a CESCo-derived metric, not an OEM AFR.

### 2. U.S. Department of Defense / DLA / NAVSEA

The Defense Logistics Agency ASSIST / QuickSearch system is a primary public source for military handbooks and standards.

MIL-HDBK-217, Reliability Prediction of Electronic Equipment, remains an active DoD handbook for uniform prediction methods for mature electronic equipment designs.

NAVSEA / NSWC Crane also publishes reliability guidance for semiconductor and microcircuit classes and explicitly references MIL-HDBK-217 methods.

Use cases for Depot:

- prediction methodology
- electronic component failure-rate models
- environmental and quality factors
- component-class surrogate evidence
- terminology and methodological cross-checks

These sources generally support prediction or component-level analysis rather than exact modern commercial-product field AFR.

### 3. IEC dependability sources

IEC 61709 provides reference-condition and stress-conversion methodology for component failure rates.

IEC TR 63162:2025 provides generic component failure rates at IEC 61709 reference conditions.

Use cases for Depot:

- compare failure-rate information from different conditions
- preserve reference-condition context
- adapt compatible component-level evidence to operating conditions where the standard permits
- avoid treating numbers gathered under unlike environments as directly interchangeable

IEC documents are standards publications and may require licensed access. Depot should store citations and permitted derived data without redistributing copyrighted source content beyond license terms.

### 4. NIST statistical reliability resources

NIST's Engineering Statistics Handbook and Dataplot resources provide public reliability methods and example datasets, including:

- exponential life models
- Weibull and lognormal models
- censored data
- accelerated life testing
- Bayesian reliability approaches
- reliability test planning

Use cases for Depot:

- statistical method validation
- confidence / uncertainty handling
- avoiding misuse of small samples
- distinguishing test design from field observation

NIST reliability examples are methodological resources; they are not a finished-product AFR catalog.

### 5. FCC Equipment Authorization

The FCC Equipment Authorization System and OET Knowledge Database can identify and enrich radio-frequency devices.

Potentially useful records include:

- FCC ID
- grantee / manufacturer
- equipment class
- test reports
- internal / external photographs when public
- operating frequencies
- radio technologies
- certification context

Use cases for Depot:

- device identity enrichment
- model / family disambiguation
- technical characteristics for wireless equipment
- linking poorly described customer inventory to a documented product family

FCC certification data demonstrates regulatory compliance. It is not an AFR database and should not be treated as reliability field evidence.

### 6. Public empirical fleet datasets

Where available, public fleet studies are especially valuable because they report actual operating exposure and failures.

Examples include large storage-device fleet datasets and academic / industry field-reliability studies.

Use cases for Depot:

- equipment-class or exact-model empirical evidence
- sanity checking OEM predictions
- understanding age, environment, and workload effects
- deriving planning ranges where the published population is applicable

Depot should preserve the source population, period, exposure, and failure definition rather than copy only the headline AFR.

### 7. Quanterion EPRD / NPRD / ROADS

EPRD provides large collections of field failure-rate data for electronic components and assemblies. Related datasets provide nonelectronic reliability and failure-mode information.

Use cases for Depot:

- commercial / military component and assembly surrogate data
- population, failures, operating hours/cycles, environment, and part characteristics
- filling evidence gaps where exact commercial-device field data does not exist

This is a licensed source family. CESCo should review subscription, API/data-use, attribution, and redistribution terms before embedding data into production.

## Evidence handling rules

For each source record, Depot should preserve:

- publisher
- document / dataset title
- source URL or formal identifier
- publication / revision date
- retrieval date
- manufacturer / model / class applicability
- native metric and native unit
- operating/reference conditions
- whether observed or predicted
- methodology where stated
- population/exposure/failures where stated
- limitations
- licensing / redistribution notes

Depot should never silently replace the source metric with a transformed value.

## Derived-value rule

A derived metric must cite its source record and transformation.

Example:

```
Source:
OEM MTBF = 2,026,793 hours at 25 C

CESCo transformation:
annual failure probability = 1 - exp(-8760 / MTBF)

Assumption:
constant hazard / exponential lifetime during useful life

Result:
derived planning value
```

The result is not an OEM-provided AFR.

## Initial equipment-class research order

Research should proceed in the order most likely to support CESCo's strategic-spares service:

1. routers / firewalls
2. managed switches
3. wireless access points
4. cellular / edge gateways
5. servers / edge compute
6. enterprise PCs / POS controllers
7. storage devices
8. UPS / power systems
9. specialty printers / scanners
10. display / signage controllers and other specialized endpoint hardware

For each class, identify:

- best free exact-model sources
- best free model-family sources
- government methodology or component data
- relevant public field studies
- likely paid/licensed source if free evidence is insufficient
- operational variables Depot should request from the customer

## Decision rule

When no credible published evidence exists, Depot should say so.

The correct system behavior is:

```
evidence unavailable / weak
-> disclose uncertainty
-> use a documented planning range if needed
-> show sensitivity of the spare recommendation
```

not:

```
evidence unavailable
-> invent a precise AFR
```
