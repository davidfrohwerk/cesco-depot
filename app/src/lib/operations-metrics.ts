import type { State } from './domain.ts';

/**
 * Operations metric definitions. Null means the measurement cannot yet be
 * established from verified source records, never zero or a favorable result.
 * Monetary figures are integer cents; physical volume retains the source unit.
 */
export const metricContractVersion = 'operations-v1';
export const metricDefinitions = {
    readySpareCount: { unit: 'equipment', basis: 'SPARE + READY + GOOD + unexpired CESCo verification + CESCo custody + no active allocation', owner: 'CESCo operations' },
    openRecoveryRequests: { unit: 'requests', basis: 'Recovery requests not completed or cancelled', owner: 'Client/CESCo' },
    pendingReturns: { unit: 'requests', basis: 'Replacement delivered or returning but failed unit not reconciled', owner: 'Client return / CESCo receiving' },
    pendingAssessment: { unit: 'equipment', basis: 'Returned, failed equipment at CESCo not yet assessed', owner: 'CESCo bench' },
    receiptExceptions: { unit: 'equipment', basis: 'Equipment with unresolved receiving exception', owner: 'CESCo receiving' },
    unverifiedSpareCount: { unit: 'equipment', basis: 'CESCo-held spares without current readiness', owner: 'CESCo operations' },
    recordedServiceCostCents: { unit: 'cents', basis: 'Recorded activity charges with performedAt inside reporting interval; excludes credits and payments', owner: 'CESCo finance' },
    warehouseUtilization: { unit: 'percent', basis: 'Requires measured facility-specific occupied and usable capacity in matching units', owner: 'CESCo facilities' },
    warrantyTurnaroundHours: { unit: 'hours', basis: 'Requires accepted warranty submission and confirmed replacement return timestamps', owner: 'OEM/CESCo coordination' },
    repairTurnaroundHours: { unit: 'hours', basis: 'Requires separately recorded repair authorization, bench start and verified completion', owner: 'CESCo bench' },
    replenishmentHours: { unit: 'hours', basis: 'Requires linked spare dispatch and return-to-ready stock events', owner: 'CESCo operations' }
} as const;

export function operationsMetrics(s: Pick<State, 'equipment' | 'requests' | 'activities'> & Partial<Pick<State, 'operationalEvents'>>, orgId: string, asOf = new Date().toISOString(), periodStart?: string) {
    const time = Date.parse(asOf);
    if (!Number.isFinite(time)) throw Error('Invalid metrics as-of timestamp.');
    const start = periodStart === undefined ? null : Date.parse(periodStart);
    if (start !== null && (!Number.isFinite(start) || start > time)) throw Error('Invalid metrics reporting period.');
    const equipment = s.equipment.filter(x => x.orgId === orgId);
    const requests = s.requests.filter(x => x.orgId === orgId && Date.parse(x.createdAt) <= time);
    const activities = s.activities.filter(x => x.orgId === orgId);
    const ready = equipment.filter(x => x.purpose === 'SPARE' && x.status === 'READY' && x.custodian === 'CESCo' &&
        x.condition === 'GOOD' && !!x.testedAt && !!x.testDue && Date.parse(x.testedAt) <= time && Date.parse(x.testDue) > time && !x.requestId);
    const byPool = new Map<string, { pool: string; configuration: string; ready: number; supported: number }>();
    for (const a of equipment) {
        const key = JSON.stringify([a.pool, a.configuration]);
        if (!byPool.has(key)) byPool.set(key, { pool: a.pool, configuration: a.configuration, ready: 0, supported: 0 });
        if (a.purpose === 'SUPPORTED') byPool.get(key)!.supported++;
    }
    for (const a of ready) {
        const key = JSON.stringify([a.pool, a.configuration]);
        if (!byPool.has(key)) byPool.set(key, { pool: a.pool, configuration: a.configuration, ready: 0, supported: 0 });
        byPool.get(key)!.ready++;
    }
    const amounts = activities.filter(a => {
        const t = Date.parse(a.performedAt);
        return Number.isFinite(t) && t <= time && (start === null || t >= start);
    });
    const events = (s.operationalEvents || []).filter(e => e.orgId === orgId && Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= time && (start === null || Date.parse(e.at) >= start));
    const eventCount = (type: string) => events.filter(e => e.type === type).length;
    return {
        fulfillmentMilestones: {
            reserved: eventCount('SPARE_RESERVED'),
            dispatched: eventCount('SPARE_DISPATCHED'),
            delivered: eventCount('DELIVERY_RECORDED'),
            failedReturnsReceived: eventCount('FAILED_RETURN_RECEIVED'),
            replenished: eventCount('SPARE_REPLENISHED')
        },
        contract: metricContractVersion,
        asOf,
        periodStart: periodStart ?? null,
        readySpareCount: ready.length,
        readyByCompatibility: [...byPool.values()].sort((a,b) => a.pool.localeCompare(b.pool) || a.configuration.localeCompare(b.configuration)),
        openRecoveryRequests: requests.filter(x => x.type === 'RECOVERY' && !['COMPLETED', 'CANCELLED'].includes(x.status)).length,
        pendingReturns: requests.filter(x => x.type === 'RECOVERY' && ['DELIVERED', 'RETURNING'].includes(x.status)).length,
        pendingAssessment: equipment.filter(x => x.custodian === 'CESCo' && x.status === 'RETURNED' && x.condition === 'FAILED').length,
        receiptExceptions: equipment.filter(x => x.status === 'EXCEPTION').length,
        unverifiedSpareCount: equipment.filter(x => x.purpose === 'SPARE' && x.custodian === 'CESCo' && !ready.includes(x)).length,
        recordedServiceCostCents: amounts.reduce((sum, a) => sum + a.amount, 0),
        recordedServiceCount: amounts.length,
        // Do not infer regional service coverage from unstructured facility labels.
        readyByRegion: null,
        // Capacity denominators and event-paired turnaround measurements not yet captured.
        warehouseUtilization: null,
        warrantyTurnaroundHours: null,
        repairTurnaroundHours: null,
        replenishmentHours: null,
        limitations: [
            'Current-state inventory metrics cannot be reconstructed for earlier dates from this snapshot.',
            'Regional availability requires a facility/region registry; customer endpoint geography is not the stock location.',
            'Storage utilization requires usable capacity and occupied volume with explicit matching units.',
            'Time-based service metrics require recorded lifecycle milestones; no missing duration is treated as zero.',
            'Recorded service charges are not equivalent to invoiced, paid, or all-in customer costs.'
        ]
    };
}
