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


## Second-tier equipment-class evidence matrix

The second research pass covers servers / edge compute, enterprise PCs / POS controllers, storage devices, UPS / power systems, and specialty printers / scanners. These classes show much more uneven public reliability evidence than enterprise networking equipment, which is exactly why Depot must preserve source type and confidence instead of forcing every class into one AFR field.

| Equipment class | Free OEM evidence availability | Government / public evidence | Quanterion fit | Customer inputs Depot should request | Initial evidence posture | Strategic-spares suitability |
| --- | --- | --- | --- | --- | --- | --- |
| Servers / edge compute | Mixed. OEMs publish detailed component, lifecycle, warranty, thermal and service information, but exact-model whole-server AFR/MTBF is not consistently exposed in current product documentation. | Strong class-level public research exists. Microsoft Research reported that about 8% of servers in a large cloud population experienced at least one hardware incident in a year; disks were the most frequently replaced component. Other large studies cover hundreds of thousands of server failure reports. These are empirical class-level references, not SKU AFRs. | Strong for PSU, fan, storage, connector, memory, board and other component/assembly surrogates; FMD can help identify common failure modes. | server model/revision, age, drive count/type, DIMM count, redundant PSU/fan/storage architecture, virtualization role, workload, thermal environment, spare-node/failover capacity, restore/rebuild time, RTO | MODERATE for equipment-class empirical behavior; LOW-MODERATE for exact-model failure probability unless OEM or field evidence exists | VERY HIGH when a branch/edge server is a single local dependency; lower when clustered, virtualized or rapidly recoverable elsewhere |
| Enterprise PCs / POS controllers | Usually weak for whole-system AFR. OEMs provide service manuals, diagnostics, component options, warranty and lifecycle information; exact-model reliability figures are uncommon. | Useful public class-level evidence exists. Microsoft Research analyzed hardware faults across one million consumer PCs and showed strong dependence on subsystem, workload and recurrence, demonstrating that a desktop/POS controller should not be treated as one homogeneous failure process. | Strong for storage, memory, PSU, fan, board, connector and electromechanical component surrogates. | exact model/form factor/revision, age, SSD/HDD type, duty cycle, thermal/dust environment, standardized image/config, peripheral dependencies, local substitutes, zero-touch/imaging ability, replacement time, business impact, RTO | LOW-MODERATE at whole-system level; MODERATE for well-characterized subsystems | HIGH for proprietary or tightly configured POS/store controllers; MODERATE/LOW for commodity PCs that can be sourced and imaged quickly |
| Storage devices | Excellent for HDDs and increasingly useful for SSDs. Exact-model OEM MTTF/UBER/workload specs are common. | VERY STRONG. Backblaze publishes downloadable model-level HDD/SSD fleet data with drive-days, failures and AFR; academic field studies show actual replacement rates can materially exceed datasheet-MTTF-derived expectations. | Strong for drive mechanisms, electronics, bearings/motors and related component failure modes, especially when a specific model lacks public field exposure. | exact model, media type, capacity, age, power-on hours/drive-days, workload, RAID/redundancy, write volume where relevant, environment, rebuild time, replacement lead time, data criticality | HIGH when applicable model-level public field data exists; MODERATE when using OEM-only predictions | HIGH for standalone/edge storage and array members with long procurement lead time; spare policy must account for RAID/rebuild architecture rather than treating every drive failure as an outage |
| UPS / power systems | Good for lifecycle/service variables; whole-unit AFR is less commonly published. OEMs publish battery chemistry, expected battery life, environmental limits, load guidance, self-test behavior and replacement intervals. | Public OEM guidance is highly actionable even without AFR. APC states VRLA batteries commonly last about 3-5 years under optimal conditions and that elevated temperature materially reduces life; APC also states typical UPS chassis/electronics life around 7-10 years for single-phase units. | Strong for batteries, capacitors, fans, relays, connectors and other electromechanical/electronic subassemblies. | UPS model, battery chemistry, battery manufacture/install date, ambient temperature, load percentage, discharge history, self-test status, input power quality, redundancy/topology, runtime requirement, replacement/bypass procedure, RTO | MODERATE for lifecycle/risk modeling; LOW for a single whole-unit AFR unless model-specific evidence exists | VERY HIGH for sites where UPS failure removes critical runtime or orderly shutdown; battery packs may warrant separate lifecycle stocking from whole UPS units |
| Specialty printers / scanners | Good for duty cycle, recommended monthly volume, consumable/component yields, environmental limits and warranty/service terms; exact whole-device AFR is usually weak. | Public field AFR is sparse. OEM usage specifications can support exposure-sensitive planning. For the Lexmark MS521dn, Lexmark publishes a recommended monthly volume of 2,000-15,000 pages, a 120,000-page maximum monthly duty cycle and an imaging-unit yield around 60,000 pages. | Strong for rollers, motors, power supplies, sensors, fusers, imaging systems and other electromechanical failure-mode evidence. | exact model, age, pages/scans per month, cumulative meter, job profile, environment/dust, consumable and maintenance history, local substitute devices, special media/peripheral requirements, repair turnaround, RTO | LOW for whole-device AFR; MODERATE for usage/lifecycle-based planning | HIGH for specialized label, receipt, check, badge, medical or other workflow-critical devices; LOW for ordinary office printers with nearby substitutes |

### Evidence examples establishing the second-tier matrix

#### Servers / edge compute

Microsoft Research's large cloud-hardware study is a useful class-level empirical anchor. It found that approximately 8% of servers experienced at least one hardware incident in a year and identified hard disks as the most commonly replaced component. The study is valuable as evidence that whole-server incident rates are driven by component count and architecture; it should not be transferred directly to a particular PowerEdge, ProLiant, or edge-server SKU.

A separate four-year study of data-center hardware analyzed more than 290,000 hardware failure reports across hundreds of thousands of servers, reinforcing that component, batch, repeat-failure and temporal effects matter at fleet scale.

#### Enterprise PCs / POS controllers

Microsoft Research's study of one million consumer PCs found that hardware-induced failures are not necessarily independent or transient. CPU, DRAM and disk behavior varied with workload and machine characteristics, and a machine that had already suffered a hardware-related crash was much more likely to crash again.

For Depot, the important conclusion is methodological: a store controller or POS PC should be represented as a configured system with subsystem evidence and operational substitutability, not assigned an arbitrary desktop-class AFR.

#### Storage devices

Backblaze's open Drive Stats dataset is unusually strong source material because it publishes model-level operating exposure and failures. Its 2025 analysis covered 344,196 qualifying hard drives across 30 models and reported an overall annual AFR of 1.36%. Backblaze also imposes minimum drive-count and drive-day thresholds before including models in annual and lifetime comparison tables.

Historical field research from Carnegie Mellon / USENIX studied about 100,000 disks and found that annual field replacement rates commonly ran 2-4%, with some populations much higher, despite datasheet MTTFs implying nominal rates below 1%. This is a standing warning against treating MTTF-derived annual probability as observed AFR.

#### UPS / power systems

APC's published guidance states that VRLA UPS batteries generally last around 3-5 years under optimal conditions. APC further states that elevated temperature significantly shortens battery life and gives a rule-of-thumb that an 8 C increase can roughly halve battery life. Separate APC guidance states that single-phase UPS chassis/electronics often have a typical life around 7-10 years, with fans and electrolytic capacitors also having finite service lives.

Therefore Depot should model a UPS as at least two lifecycle populations:

```
UPS electronics / chassis
+
replaceable battery subsystem
```

A battery replacement plan is not the same thing as a cold spare for the entire UPS.

#### Specialty printers / scanners

Printer reliability is strongly usage-dependent. Lexmark's published specifications for the MS521dn give a recommended monthly page volume of 2,000-15,000 pages, a maximum monthly duty cycle of 120,000 pages, and an imaging-unit estimated yield of about 60,000 pages.

These values are not AFRs. They are useful exposure and maintenance variables that can support a workload-sensitive planning model when whole-device field failure rates are unavailable.

## Additional per-class assessment questions

### Servers / edge compute

Ask:

- Is the workload clustered, replicated, virtualized, or tied to one physical host?
- How many disks, DIMMs, PSUs and fans are installed?
- Which components are hot-swappable?
- Can another host absorb the workload?
- Is a spare server useful without matching firmware, storage, licenses or configuration?
- How long does bare-metal restore, imaging, VM restore or application validation take?
- Is replacement constrained by rack depth, rails, power, NIC/HBA type or proprietary peripherals?
- What is the business impact if the local compute function disappears completely?

### Enterprise PCs / POS controllers

Ask:

- Is the device truly commodity hardware or does it have proprietary ports/peripherals?
- Is the software image standardized and escrowed/current?
- Can another approved model substitute?
- Does replacement require local data restoration, licensing, device certificates or payment-key injection?
- What peripherals depend on the controller?
- Is a spare useful if shipped blank, or must it be preconfigured?
- How quickly can a field technician swap and validate it?

### Storage devices

Ask:

- Is the drive standalone, mirrored, RAID-protected, erasure-coded, or part of a replicated system?
- What exact model/firmware/capacity compatibility constraints exist?
- What are drive age and accumulated drive-days/power-on hours?
- What is the workload/write volume?
- How long does rebuild/resilvering take?
- Does a second drive failure during rebuild materially change risk?
- Is data availability protected at another system/site?
- Is the desired spare a drive, tray/caddy, controller, or whole storage appliance?

### UPS / power systems

Ask:

- What battery chemistry and replacement battery cartridge/module is installed?
- What is the battery manufacture/install date?
- What is the normal load percentage?
- What is ambient/internal temperature?
- How often does the UPS discharge and how deeply?
- Does the site have redundant UPS paths or bypass?
- Can the load tolerate a battery-only failure while the UPS electronics remain healthy?
- Does replacement require shutdown or electrician/vendor involvement?
- Is the desired resilience strategy spare batteries, a whole spare UPS, or both?

### Specialty printers / scanners

Ask:

- Is the device a normal office convenience or a workflow dependency?
- What is the monthly/cumulative page or scan count?
- What media path, cutter, scanner, label, MICR, badge, receipt or specialty features are required?
- Is there another compatible device on site?
- Can a different model temporarily substitute?
- What maintenance kit / imaging / roller / fuser intervals exist?
- Is the correct spare a whole unit or a smaller field-replaceable module?
- How much business stops when the device is unavailable?

## Assessment implication

The second-tier research confirms that Depot should support more than one evidence model.

```
NETWORK APPLIANCE
often exact-model OEM MTBF

STORAGE DEVICE
often exact-model empirical field AFR + OEM specification

UPS
age / temperature / cycle / subsystem lifecycle

PRINTER
usage / page-count / maintenance lifecycle

PC / POS / SERVER
system architecture + subsystem evidence + substitutability
```

The assessment engine should therefore select an evidence strategy by equipment class before it calculates a spare quantity.
