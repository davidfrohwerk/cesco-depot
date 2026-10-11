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


## Initial equipment-class evidence matrix

This matrix is the first operating template for strategic-spares reliability research. It is intentionally evidence-oriented: it identifies what is usually available, what Depot should ask the customer, and what confidence is reasonable before any spare recommendation is generated.

| Equipment class | Free OEM evidence availability | Government / public evidence | Quanterion fit | Customer inputs Depot should request | Initial evidence posture | Strategic-spares suitability |
| --- | --- | --- | --- | --- | --- | --- |
| Routers / firewalls | Often good. Major network OEMs frequently publish MTBF, operating temperature, power, redundancy, and lifecycle specifications for exact models or families. | DoD/NAVSEA component-reliability methods can support lower-level surrogate analysis; FCC records can enrich models with cellular/radio capability but are not AFR evidence. Public whole-product fleet AFR is usually sparse. | Strong for electronic assemblies/components and failure-mode support when exact-model field data is absent. | exact model/revision, age, powered hours, ambient temperature, redundancy/failover, WAN diversity, configuration restore time, procurement lead time, replacement labor, RTO | MODERATE when exact-model OEM MTBF exists; LOW-MODERATE when relying on surrogate evidence | VERY HIGH for single-site edge/firewall devices where failure can disconnect a site |
| Managed switches | Often very good. Cisco and similar OEMs commonly publish exact-model MTBF; PoE and fan/no-fan variants can have materially different predicted reliability. | Component methods are available through DoD sources. Public whole-switch fleet AFR is limited. | Strong for PSU, fan, capacitor, connector, semiconductor and other assembly/component evidence. | model/revision, PoE/non-PoE, PoE load, fan configuration, temperature, uplink redundancy, stack/chassis redundancy, port count/utilization, config restore time, RTO | MODERATE-HIGH for OEM-predicted exact-model data; lower for field-performance claims | VERY HIGH for access/distribution switches that create site-wide or multi-device outages |
| Wireless access points | Good for many enterprise OEMs. MTBF and thermal/environmental data are often published. Some OEM documentation exposes how MTBF changes materially with temperature. | FCC authorization is especially useful for identity, radio family, frequency/band, and technical enrichment. DoD methods can support electronics surrogates. Public AP fleet AFR is sparse. | Strong for radio/electronic assemblies and component failure modes; useful when OEM exact-model MTBF is unavailable. | exact model/revision, indoor/outdoor, powered hours, PoE source, temperature, client/load profile, AP density, coverage overlap, controller dependency, replacement/mounting time, RTO | MODERATE where exact-model OEM MTBF exists; LOW-MODERATE otherwise | HIGH when a site has low AP redundancy or special mounting/configuration; lower where dense AP overlap permits graceful degradation |
| Cellular / edge gateways | Mixed but promising. Industrial/edge vendors often publish MTBF or calculated reliability, sometimes with the prediction method and temperature conditions. Consumer/SMB devices are less consistent. | FCC records are highly useful for device identity, modem/radio variants, bands, antennas, and certification documents. DoD methods help with component-level surrogates. Public whole-device AFR is limited. | Strong because gateways combine electronic, connector, power, and sometimes electromechanical/environmental exposure; EPRD/NPRD/FMD can help characterize surrogate assemblies and modes. | exact hardware/modem revision, carrier/bands, antenna configuration, temperature/environment, power source, duty cycle, primary vs failover role, firmware, remote-recovery capability, provisioning/config time, RTO | MODERATE for industrial products with published prediction data; LOW where only broad surrogate data exists | VERY HIGH when gateway is the only WAN path, out-of-band recovery path, or critical IoT/edge controller |

### Evidence examples establishing the matrix

The first research pass already demonstrates why the matrix needs to preserve exact model, temperature, and configuration rather than just equipment class.

- Cisco lists the CBS350-24T-4G managed switch at an MTBF of 2,026,793 hours at 25 C. The same product family contains PoE and fan-equipped variants with substantially lower published MTBF values, so family name alone is not enough.
- Cisco lists the ISR1100-4G router at approximately 1.6 million hours MTBF at 25 C ambient.
- Cisco lists the Catalyst 9136I access point at 312,422 hours MTBF at 25 C and 171,539 hours at 50 C, demonstrating that thermal conditions can materially change a prediction even for the exact same model.
- Quanterion ROADS provides searchable EPRD, NPRD, and FMD records by part number/category, manufacturer, NSN, environment, and quality level, making it a useful surrogate-data layer when whole-product field AFR is unavailable.

These source facts should enter Depot as evidence records in their native units and conditions. Any conversion to annual probability is a separate CESCo transformation.

## Per-class assessment questions

The first client-facing assessment should ask only questions that materially change the recommendation.

### Routers / firewalls

Ask:

- Is there an HA pair, secondary firewall, SD-WAN failover, or alternate WAN?
- Would failure disconnect the whole site or only reduce capacity?
- Can the replacement be zero-touch provisioned?
- Does licensing or entitlement delay replacement?
- How long does it take to restore configuration and validate routing/security?
- Is the unit rack-mounted, branch desktop, or integrated with cellular/PoE?
- What is the maximum acceptable site outage?

### Managed switches

Ask:

- Is the switch standalone, stacked, chassis-based, or redundant?
- Does it provide PoE to phones, APs, cameras, or other mission-critical devices?
- Are spare ports/uplinks available to bypass a partial failure?
- Is configuration standardized and backed up?
- Is the replacement fanless or fan-cooled?
- What proportion of a site becomes unavailable if it fails?

### Wireless access points

Ask:

- How much RF coverage overlap exists?
- Can neighboring APs temporarily absorb the failed AP's clients?
- Is the AP difficult to access physically?
- Does the replacement require special mounting, antenna alignment, or outdoor sealing?
- Can the controller/cloud platform automatically provision it?
- Is failure of one AP a degraded-service event or a business outage?

### Cellular / edge gateways

Ask:

- Is the gateway the primary WAN, failover WAN, or out-of-band management path?
- Does the replacement require carrier/SIM/eSIM activation?
- Is the modem/radio variant interchangeable in the destination region?
- Does the site require external antennas or special cabling?
- Can configuration be restored remotely?
- Is the unit installed in a harsh/industrial environment?
- What other site functions depend on the gateway?

## Suitability rule

Mission-criticality is not implied by device class.

Depot should consider pooled strategic stocking strongest when all or most of the following are true:

- failure creates significant operational impact
- local redundancy is absent or insufficient
- procurement lead time exceeds the recovery objective
- a compatible spare can be preconfigured or rapidly restored
- the device is reasonably transportable
- replacement can materially reduce downtime
- pooling across many endpoints is cheaper than one-for-one local redundancy

The system should explicitly decline or de-emphasize strategic stocking when local redundancy, commodity availability, or low business impact makes a managed spare economically irrational.
