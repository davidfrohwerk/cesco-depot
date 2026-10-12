import { randomUUID } from 'node:crypto';
import { sparePlan } from './planning.ts';
import { parseCsv, rowsToObjects } from './csv.ts';
export type Role = 'SYSTEM_ADMIN' | 'OPERATIONS' | 'FINANCE' | 'CLIENT_ADMIN' | 'HELPDESK' | 'CLIENT_BILLING' | 'AUDITOR';
export type User = {
    id: string;
    email: string;
    name: string;
    password: string;
    orgId: string;
    role: Role;
};
export type Base = {
    id: string;
    orgId: string;
};
export type Organization = {
    id: string;
    name: string;
    termsDays: number;
    currency: string;
};
export type Endpoint = Base & {
    externalId: string;
    name: string;
    siteType: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    market: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    accessNotes: string;
    active: boolean;
};
export type Equipment = Base & {
    externalId: string;
    manufacturer: string;
    model: string;
    serial: string;
    configuration: string;
    pool: string;
    purpose: 'SUPPORTED' | 'SPARE';
    endpointId: string | null;
    status: string;
    condition: string;
    location: string;
    position: string;
    custodian: string;
    testedAt: string | null;
    testDue: string | null;
    intakeId: string | null;
    requestId: string | null;
    volume: number;
    recoveryTargetHours: number | null;
};
export type Intake = Base & {
    number: string;
    assetIds: string[];
    status: string;
    tracking: string;
    workOrder: string | null;
    acceptedAt: string | null;
    notes: string;
};
export type Rate = Base & {
    name: string;
    category: string;
    unit: string;
    cents: number;
    version: string;
    active: boolean;
    approvedBy: string | null;
    approvedAt: string | null;
};
export type Request = Base & {
    number: string;
    endpointId: string;
    equipmentId: string;
    type: string;
    scope: string;
    status: string;
    ceiling: number;
    authorizedBy: string | null;
    authorizedAt: string | null;
    termsVersion: string;
    spareId: string | null;
    tracking: string;
    etaHours: number | null;
    createdAt: string;
    completedAt: string | null;
    workOrder: string | null;
    pendingCeiling: number | null;
    resumeStatus: string | null;
};
export type Activity = Base & {
    requestId: string | null;
    intakeId: string | null;
    assetId: string | null;
    rateId: string;
    rateVersion: string;
    description: string;
    quantity: number;
    unit: string;
    unitCents: number;
    amount: number;
    status: string;
    performedAt: string;
    performedBy: string;
    periodStart: string | null;
    periodEnd: string | null;
    costCents: number;
    invoiceId: string | null;
};
export type Invoice = Base & {
    number: string;
    activityIds: string[];
    total: number;
    issuedAt: string;
    dueAt: string;
    status: string;
    termsDays: number;
};
export type Settlement = Base & {
    invoiceId: string | null;
    kind: 'PAYMENT' | 'CREDIT' | 'APPLY_CREDIT' | 'REFUND';
    cents: number;
    reference: string;
    createdAt: string;
};
export type Audit = Base & {
    at: string;
    actor: string;
    action: string;
    entityId: string;
    detail: string;
};
export type ImportJob = Base & {
    kind: string;
    csv: string;
    mapping: Record<string, string>;
    status: string;
    count: number;
    errors: string[];
    createdAt: string;
    actor: string;
};
export type Evidence = Base & {
    entityId: string;
    name: string;
    sha256: string;
    key: string;
    size: number;
    mime: string;
    actor: string;
    at: string;
    description: string;
};
export type Invite = Base & {
    email: string;
    role: Role;
    tokenHash: string;
    expiresAt: string;
    used: boolean;
};
export type Plan = Base & {
    pool: string;
    configuration: string;
    population: number;
    afr: number;
    days: number;
    level: number;
    contingency: number;
    source: string;
    notes: string;
    at: string;
    result: ReturnType<typeof sparePlan>;
};
export type State = {
    plans: Plan[];
    organizations: Organization[];
    users: User[];
    endpoints: Endpoint[];
    equipment: Equipment[];
    intakes: Intake[];
    rates: Rate[];
    requests: Request[];
    activities: Activity[];
    invoices: Invoice[];
    settlements: Settlement[];
    audit: Audit[];
    imports: ImportJob[];
    evidence: Evidence[];
    invites: Invite[];
};
export const emptyState = (): State => ({ plans: [], organizations: [], users: [], endpoints: [], equipment: [], intakes: [], rates: [], requests: [], activities: [], invoices: [], settlements: [], audit: [], imports: [], evidence: [], invites: [] });
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function assert(value: unknown, message: string): asserts value { if (!value)
    throw Error(message); }
export function str(value: unknown, label: string, max = 1000) { assert(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} is required (maximum ${max} characters).`); return value.trim(); }
export function num(value: unknown, label: string, min = 0, max = 1e9) { const n = Number(value); assert(value !== '' && value !== null && value !== undefined && Number.isFinite(n) && n >= min && n <= max, `${label} must be between ${min} and ${max}.`); return n; }
export function cents(value: unknown, label = 'Amount') { const n = num(value, label); assert(Number.isSafeInteger(n), `${label} must be whole cents.`); return n; }
export function log(s: State, u: User, orgId: string, action: string, entityId: string, detail: string) { s.audit.push({ id: id(), orgId, at: now(), actor: u.email, action, entityId, detail }); }
export function isInternal(u: User) { return ['SYSTEM_ADMIN', 'OPERATIONS', 'FINANCE'].includes(u.role); }
export function allowed(u: User, orgId: string, cap: string) {
    if (u.role === 'SYSTEM_ADMIN')
        return true;
    if (!isInternal(u) && u.orgId !== orgId)
        return false;
    const roles: Record<string, string[]> = { view: ['OPERATIONS', 'FINANCE', 'CLIENT_ADMIN', 'HELPDESK', 'CLIENT_BILLING', 'AUDITOR'], onboard: ['CLIENT_ADMIN', 'OPERATIONS'], request: ['CLIENT_ADMIN', 'HELPDESK', 'OPERATIONS'], authorize: ['CLIENT_ADMIN', 'CLIENT_BILLING'], operate: ['OPERATIONS'], finance: ['FINANCE'], billing: ['FINANCE', 'CLIENT_ADMIN', 'CLIENT_BILLING'], team: ['CLIENT_ADMIN'], rates: ['FINANCE'] };
    return (roles[cap] || []).includes(u.role);
}
export function requireCap(u: User, orgId: string, cap: string) { assert(allowed(u, orgId, cap), 'You do not have permission for this action.'); }
export function get<T extends Base>(rows: T[], entityId: unknown, orgId: string) { const x = rows.find(v => v.id === entityId && v.orgId === orgId); assert(x, 'Record not found in this account.'); return x; }
export function balance(s: State, inv: Invoice) { return inv.total - s.settlements.filter(x => x.invoiceId === inv.id).reduce((a, x) => a + (x.kind === 'REFUND' ? -x.cents : x.cents), 0); }
export function creditBalance(s: State, orgId: string) { return s.settlements.filter(x => x.orgId === orgId).reduce((a, x) => a + (x.kind === 'CREDIT' ? x.cents : x.kind === 'APPLY_CREDIT' ? -x.cents : 0), 0); }
export function compatible(a: Equipment, b: Equipment) { return a.orgId === b.orgId && a.pool === b.pool && a.configuration === b.configuration && a.purpose === 'SUPPORTED' && b.purpose === 'SPARE'; }
export function ready(a: Equipment) { return a.status === 'READY' && a.condition === 'GOOD' && !!a.testedAt && !!a.testDue && new Date(a.testDue).getTime() > Date.now(); }
export function candidates(s: State, asset: Equipment) { return s.equipment.filter(x => compatible(asset, x) && ready(x)); }
export const fields = {
    endpoints: ['externalId', 'name', 'siteType', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country', 'market', 'contactName', 'contactEmail', 'contactPhone', 'accessNotes', 'active'],
    equipment: ['externalId', 'manufacturer', 'model', 'serial', 'configuration', 'pool', 'purpose', 'endpointId', 'volume', 'recoveryTargetHours']
};
export function previewImport(s: State, orgId: string, kind: string, csv: string, mapping: Record<string, string> = {}) {
    assert(kind === 'endpoints' || kind === 'equipment', 'Choose endpoints or equipment.');
    assert(csv.length <= 8000000, 'CSV limit is 8 MB.');
    const rows = rowsToObjects(parseCsv(csv.replace(/^\uFEFF/, '')));
    assert(rows.length > 0 && rows.length <= 10000, 'Import 1–10,000 rows at a time.');
    const errors: string[] = [];
    const seen = new Set<string>();
    const serials = new Set<string>();
    const records: Record<string, string>[] = [];
    for (const row of rows) {
        const r: Record<string, string> = {};
        for (const field of fields[kind as keyof typeof fields])
            r[field] = row.record[mapping[field] || field] || '';
        try {
            if (kind === 'endpoints') {
                str(r.externalId, 'Endpoint ID', 100);
                str(r.name, 'Endpoint name', 200);
                str(r.addressLine1, 'Street / address line 1');
                assert(!s.endpoints.some(x => x.orgId === orgId && x.externalId === r.externalId), 'Endpoint ID already exists.');
                if (r.active) {
                    const active = r.active.trim().toLowerCase();
                    assert(['yes', 'true', '1', 'no', 'false', '0'].includes(active), 'Active must be yes/no, true/false, or 1/0.');
                }
            }
            else {
                str(r.externalId, 'Client equipment ID', 100);
                str(r.manufacturer, 'Manufacturer', 100);
                str(r.model, 'Model', 100);
                str(r.serial, 'Serial', 200);
                str(r.configuration, 'Configuration', 200);
                str(r.pool, 'Compatibility pool', 200);
                assert(['SUPPORTED', 'SPARE'].includes(r.purpose), 'Purpose must be SUPPORTED or SPARE.');
                if (r.volume)
                    num(r.volume, 'Volume', 0, 1e6);
                if (r.recoveryTargetHours)
                    num(r.recoveryTargetHours, 'Recovery target', 0.1, 8760);
                assert(!s.equipment.some(x => x.orgId === orgId && x.externalId === r.externalId), 'Client equipment ID already exists.');
                const key = `${r.manufacturer.toLowerCase()}|${r.serial.toLowerCase()}`;
                assert(!serials.has(key) && !s.equipment.some(x => x.orgId === orgId && `${x.manufacturer.toLowerCase()}|${x.serial.toLowerCase()}` === key), 'Duplicate manufacturer/serial in this account.');
                serials.add(key);
                if (r.purpose === 'SUPPORTED' || r.endpointId)
                    assert(s.endpoints.some(x => x.orgId === orgId && x.externalId === r.endpointId), 'Endpoint ID must refer to an onboarded endpoint.');
                if (r.purpose === 'SPARE')
                    assert(s.equipment.some(x => x.orgId === orgId && x.purpose === 'SUPPORTED' && x.pool === r.pool && x.configuration === r.configuration) || rows.some(v => (v.record[mapping.purpose || 'purpose'] === 'SUPPORTED') && (v.record[mapping.pool || 'pool'] === r.pool) && (v.record[mapping.configuration || 'configuration'] === r.configuration)), 'Spare must support an onboarded compatibility pool/configuration.');
            }
            const key = r.externalId;
            assert(!seen.has(key), 'Duplicate client identifier in CSV.');
            seen.add(key);
            records.push(r);
        }
        catch (e) {
            errors.push(`Row ${row.rowNumber}: ${(e as Error).message}`);
        }
    }
    return { count: rows.length, records, errors };
}
export function mutate(s: State, u: User, orgId: string, action: string, p: Record<string, unknown>) {
    const org = s.organizations.find(x => x.id === orgId);
    assert(org, 'Account not found.');
    let entityId = orgId;
    switch (action) {
        case 'plan': {
            requireCap(u, orgId, 'onboard');
            const pool = str(p.pool, 'Compatibility pool');
            const configuration = str(p.configuration, 'Configuration');
            const population = s.equipment.filter(x => x.orgId === orgId && x.purpose === 'SUPPORTED' && x.pool === pool && x.configuration === configuration).length;
            assert(population, 'No supported equipment exists for that pool and configuration.');
            const afr = num(p.afr, 'Annual failure probability', 0, 1), days = num(p.days, 'Replenishment / repair exposure window', .1, 3650), level = num(p.level, 'Target probability of sufficient independent-failure stock', .5, .9999), contingency = num(p.contingency, 'Contingency reserve', 0, 100000);
            assert(Number.isInteger(contingency), 'Contingency reserve must be a whole number.');
            const plan: Plan = { id: id(), orgId, pool, configuration, population, afr, days, level, contingency, source: str(p.source, 'Evidence source or explicit planning assumption'), notes: str(p.notes, 'Applicability, uncertainty, and operational assumptions'), at: now(), result: sparePlan(population, afr, days, level, contingency) };
            s.plans.push(plan);
            entityId = plan.id;
            break;
        }
        case 'endpoint': {
            requireCap(u, orgId, 'onboard');
            const externalId = str(p.externalId, 'Endpoint ID', 100);
            assert(!s.endpoints.some(x => x.orgId === orgId && x.externalId === externalId), 'Endpoint ID already exists.');
            const e: Endpoint = {
                id: id(),
                orgId,
                externalId,
                name: str(p.name, 'Name', 200),
                siteType: String(p.siteType || '').trim(),
                addressLine1: str(p.addressLine1, 'Street / address line 1'),
                addressLine2: String(p.addressLine2 || '').trim(),
                city: String(p.city || '').trim(),
                state: String(p.state || '').trim(),
                postalCode: String(p.postalCode || '').trim(),
                country: String(p.country || '').trim(),
                market: String(p.market || '').trim(),
                contactName: String(p.contactName || '').trim(),
                contactEmail: String(p.contactEmail || '').trim(),
                contactPhone: String(p.contactPhone || '').trim(),
                accessNotes: String(p.accessNotes || '').trim(),
                active: true
            };
            s.endpoints.push(e);
            entityId = e.id;
            break;
        }
        case 'importPreview': {
            requireCap(u, orgId, 'onboard');
            const kind = str(p.kind, 'Import kind');
            const csv = str(p.csv, 'CSV', 8e6);
            const mapping = (p.mapping || {}) as Record<string, string>;
            const result = previewImport(s, orgId, kind, csv, mapping);
            const job = { id: id(), orgId, kind, csv, mapping, status: 'PREVIEW', count: result.count, errors: result.errors, createdAt: now(), actor: u.email };
            s.imports.push(job);
            entityId = job.id;
            break;
        }
        case 'importCommit': {
            requireCap(u, orgId, 'onboard');
            const job = get(s.imports, p.id, orgId);
            assert(job.status === 'PREVIEW', 'Import already committed.');
            const result = previewImport(s, orgId, job.kind, job.csv, job.mapping);
            assert(result.errors.length === 0, result.errors.slice(0, 4).join(' '));
            for (const r of result.records) {
                if (job.kind === 'endpoints')
                    s.endpoints.push({
                        id: id(), orgId, externalId: r.externalId, name: r.name,
                        siteType: r.siteType || '', addressLine1: r.addressLine1,
                        addressLine2: r.addressLine2 || '', city: r.city || '',
                        state: r.state || '', postalCode: r.postalCode || '',
                        country: r.country || '', market: r.market || '',
                        contactName: r.contactName || '', contactEmail: r.contactEmail || '',
                        contactPhone: r.contactPhone || '', accessNotes: r.accessNotes || '',
                        active: !r.active || ['yes', 'true', '1'].includes(r.active.trim().toLowerCase())
                    });
                else
                    s.equipment.push({ id: id(), orgId, externalId: r.externalId, manufacturer: r.manufacturer, model: r.model, serial: r.serial, configuration: r.configuration, pool: r.pool, purpose: r.purpose as Equipment['purpose'], endpointId: s.endpoints.find(x => x.orgId === orgId && x.externalId === r.endpointId)?.id || null, status: r.purpose === 'SUPPORTED' ? 'INSTALLED' : 'CLIENT_HELD', condition: 'UNKNOWN', location: r.purpose === 'SUPPORTED' ? s.endpoints.find(x => x.orgId === orgId && x.externalId === r.endpointId)?.name || 'Client' : 'Client', position: '', custodian: 'Client', testedAt: null, testDue: null, intakeId: null, requestId: null, volume: Number(r.volume || 0), recoveryTargetHours: r.recoveryTargetHours ? Number(r.recoveryTargetHours) : null });
            }
            job.status = 'COMMITTED';
            job.errors = [];
            entityId = job.id;
            break;
        }
        case 'intake': {
            requireCap(u, orgId, 'onboard');
            assert(Array.isArray(p.assetIds) && p.assetIds.length > 0, 'Select client-held spares.');
            const assets = p.assetIds.map(x => get(s.equipment, x, orgId));
            assert(new Set(p.assetIds).size === assets.length, 'Duplicate selection.');
            assert(assets.every(x => x.purpose === 'SPARE' && x.status === 'CLIENT_HELD' && !x.intakeId), 'Only client-held spares can be included.');
            const t: Intake = { id: id(), orgId, number: `IN-${s.intakes.length + 1}`, assetIds: assets.map(x => x.id), status: 'EXPECTED', tracking: '', workOrder: null, acceptedAt: null, notes: str(p.notes, 'Shipment purpose') };
            s.intakes.push(t);
            for (const a of assets) {
                a.intakeId = t.id;
                a.status = 'EXPECTED';
            }
            entityId = t.id;
            break;
        }
        case 'acceptIntake': {
            requireCap(u, orgId, 'operate');
            const t = get(s.intakes, p.id, orgId);
            assert(t.status === 'EXPECTED', 'Shipment already accepted.');
            t.tracking = str(p.tracking, 'Carrier acceptance / tracking reference');
            t.status = 'IN_TRANSIT';
            t.acceptedAt = now();
            t.workOrder = `WO-${s.intakes.filter(x => x.workOrder).length + s.requests.filter(x => x.workOrder).length + 1}`;
            for (const aid of t.assetIds) {
                const a = get(s.equipment, aid, orgId);
                a.status = 'INBOUND';
                a.custodian = 'Carrier';
                a.location = 'In transit to CESCo';
            }
            entityId = t.id;
            break;
        }
        case 'receive': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(a.status === 'INBOUND' && a.intakeId, 'Asset is not expected inbound.');
            const t = get(s.intakes, a.intakeId, orgId);
            assert(t.workOrder, 'Carrier acceptance must precede receiving.');
            const observed = str(p.serial, 'Observed serial');
            const matches = observed === a.serial;
            const condition = str(p.condition, 'Condition');
            assert(['GOOD', 'DAMAGED', 'FAILED'].includes(condition), 'Invalid condition.');
            a.condition = condition;
            a.status = matches ? 'RECEIVED' : 'EXCEPTION';
            a.location = str(p.location, 'Depot / stocking location');
            a.position = str(p.position, 'Internal storage position');
            a.custodian = 'CESCo';
            if (t.assetIds.every(x => !['INBOUND'].includes(get(s.equipment, x, orgId).status)))
                t.status = t.assetIds.some(x => get(s.equipment, x, orgId).status === 'EXCEPTION') ? 'EXCEPTION' : 'RECEIVED';
            entityId = a.id;
            log(s, u, orgId, 'RECEIPT', a.id, `Observed ${observed}; expected ${a.serial}; ${condition}; ${a.location}; ${a.position}; ${String(p.notes || '')}`);
            break;
        }
        case 'verify': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(['RECEIVED', 'RETURNED', 'REPAIR'].includes(a.status), 'Receive or repair this unit before testing.');
            assert(a.condition === 'GOOD', 'Only good-condition equipment may become ready.');
            assert(str(p.configuration, 'Verified configuration') === a.configuration, 'Configuration must match the approved profile.');
            const days = num(p.validDays, 'Test validity days', 1, 3650);
            const note = str(p.notes, 'Test result');
            a.testedAt = now();
            a.testDue = new Date(Date.now() + days * 86400000).toISOString();
            a.status = 'READY';
            entityId = a.id;
            log(s, u, orgId, 'READINESS_VERIFIED', a.id, note);
            break;
        }
        case 'request': {
            requireCap(u, orgId, 'request');
            const a = get(s.equipment, p.equipmentId, orgId);
            assert(a.purpose === 'SUPPORTED' && a.endpointId, 'Choose supported endpoint equipment.');
            const type = str(p.type, 'Service type');
            assert(['RECOVERY', 'REPAIR', 'OEM', 'DECOMMISSION', 'DONATION'].includes(type), 'Unsupported service.');
            const r: Request = { id: id(), orgId, number: `SR-${s.requests.length + 1}`, endpointId: a.endpointId, equipmentId: a.id, type, scope: str(p.scope, 'Requested outcome'), status: 'REQUESTED', ceiling: 0, authorizedBy: null, authorizedAt: null, termsVersion: '', spareId: null, tracking: '', etaHours: null, createdAt: now(), completedAt: null, workOrder: null, pendingCeiling: null, resumeStatus: null };
            s.requests.push(r);
            entityId = r.id;
            break;
        }
        case 'amendQuote': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.authorizedAt && r.status !== 'COMPLETED' && r.status !== 'WAITING_AUTHORIZATION', 'An active authorized request is required.');
            const ceiling = cents(p.ceiling, 'Revised ceiling');
            assert(ceiling >= s.activities.filter(x => x.requestId === r.id).reduce((a, x) => a + x.amount, 0), 'Revised ceiling cannot be below performed work.');
            r.pendingCeiling = ceiling;
            r.resumeStatus = r.status;
            r.status = 'WAITING_AUTHORIZATION';
            r.termsVersion = str(p.termsVersion, 'Revised quote version');
            entityId = r.id;
            break;
        }
        case 'approveAmendment': {
            requireCap(u, orgId, 'authorize');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'WAITING_AUTHORIZATION' && r.pendingCeiling !== null && r.resumeStatus, 'Revised quote required.');
            r.ceiling = r.pendingCeiling;
            r.pendingCeiling = null;
            r.status = r.resumeStatus;
            r.resumeStatus = null;
            r.authorizedBy = u.id;
            r.authorizedAt = now();
            entityId = r.id;
            log(s, u, orgId, 'REVISED_AUTHORIZATION', r.id, JSON.stringify({ scope: r.scope, ceiling: r.ceiling, terms: r.termsVersion, actor: u.email }));
            break;
        }
        case 'acceptService': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'AUTHORIZED' && r.type === 'REPAIR' && !r.workOrder, 'Authorize a repair shipment first.');
            r.tracking = str(p.tracking, 'Carrier acceptance reference');
            r.workOrder = `WO-${s.intakes.filter(x => x.workOrder).length + s.requests.filter(x => x.workOrder).length + 1}`;
            r.status = 'INBOUND';
            const a = get(s.equipment, r.equipmentId, orgId);
            a.requestId = r.id;
            a.status = 'INBOUND';
            a.custodian = 'Carrier';
            a.location = 'In transit to CESCo';
            entityId = r.id;
            break;
        }
        case 'serviceReceipt': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(['INBOUND', 'OEM_OUT'].includes(r.status) && r.workOrder, 'Accepted repair/OEM shipment required.');
            const a = get(s.equipment, r.equipmentId, orgId);
            const serial = str(p.serial, 'Observed serial');
            a.condition = str(p.condition, 'Condition');
            assert(['GOOD', 'FAILED', 'DAMAGED'].includes(a.condition), 'Invalid condition.');
            a.status = serial === a.serial ? 'RECEIVED' : 'EXCEPTION';
            a.location = str(p.location, 'Receiving depot');
            a.position = str(p.position, 'Internal position');
            a.custodian = 'CESCo';
            r.status = 'RECEIVED';
            entityId = r.id;
            log(s, u, orgId, 'SERVICE_RECEIPT', a.id, `Observed ${serial}; expected ${a.serial}; ${a.condition}`);
            break;
        }
        case 'quote': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(['REQUESTED', 'QUOTED', 'AUTHORIZED'].includes(r.status), 'Quote cannot change after execution begins.');
            r.ceiling = cents(p.ceiling, 'Quote ceiling');
            r.termsVersion = str(p.termsVersion, 'Terms / quote version');
            r.status = 'QUOTED';
            r.authorizedBy = null;
            r.authorizedAt = null;
            entityId = r.id;
            break;
        }
        case 'authorize': {
            requireCap(u, orgId, 'authorize');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'QUOTED', 'A current quote is required.');
            r.authorizedBy = u.id;
            r.authorizedAt = now();
            r.status = 'AUTHORIZED';
            entityId = r.id;
            log(s, u, orgId, 'AUTHORIZATION', r.id, JSON.stringify({ scope: r.scope, ceiling: r.ceiling, terms: r.termsVersion, actor: u.email }));
            break;
        }
        case 'reserve': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.type === 'RECOVERY' && r.status === 'AUTHORIZED', 'Authorize a recovery request first.');
            const source = get(s.equipment, r.equipmentId, orgId);
            const a = get(s.equipment, p.spareId, orgId);
            assert(compatible(source, a) && ready(a), 'Spare must be compatible, verified, current, and available.');
            a.status = 'RESERVED';
            a.requestId = r.id;
            source.requestId = r.id;
            r.spareId = a.id;
            r.status = 'RESERVED';
            entityId = r.id;
            break;
        }
        case 'dispatch': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'RESERVED' && r.spareId, 'Reserve a spare first.');
            const a = get(s.equipment, r.spareId, orgId);
            assert(a.testDue && new Date(a.testDue) > new Date(), 'Readiness test expired; retest before dispatch.');
            r.tracking = str(p.tracking, 'Shipment / handoff reference');
            r.etaHours = num(p.etaHours, 'Delivery and installation estimate', .1, 8760);
            r.status = 'DISPATCHED';
            r.workOrder = `WO-${s.intakes.filter(x => x.workOrder).length + s.requests.filter(x => x.workOrder).length + 1}`;
            a.status = 'OUTBOUND';
            a.custodian = str(p.custodian, 'Carrier / technician');
            a.location = 'In transit to endpoint';
            entityId = r.id;
            break;
        }
        case 'deliver': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'DISPATCHED' && r.spareId, 'Dispatch first.');
            const a = get(s.equipment, r.spareId, orgId);
            const e = get(s.endpoints, r.endpointId, orgId);
            str(p.notes, 'Delivery / installation evidence');
            a.status = 'INSTALLED';
            a.purpose = 'SUPPORTED';
            const failed = get(s.equipment, r.equipmentId, orgId);
            failed.purpose = 'SPARE';
            failed.status = 'RETURN_PENDING';
            failed.endpointId = null;
            a.location = e.name;
            a.position = '';
            a.custodian = 'Client';
            a.endpointId = e.id;
            r.status = 'DELIVERED';
            entityId = r.id;
            break;
        }
        case 'return': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(['DELIVERED', 'RETURNING'].includes(r.status), 'Delivery must be recorded first.');
            const a = get(s.equipment, r.equipmentId, orgId);
            a.status = 'RETURNED';
            a.condition = 'FAILED';
            a.custodian = 'CESCo';
            a.location = str(p.location, 'Return depot');
            a.position = str(p.position, 'Internal position');
            r.status = 'RETURNED';
            entityId = a.id;
            break;
        }
        case 'repair': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(['RETURNED', 'RECEIVED', 'EXCEPTION', 'REPAIR', 'OEM_OUT'].includes(a.status), 'Equipment cannot enter repair from this state.');
            a.status = 'REPAIR';
            a.condition = 'GOOD';
            str(p.notes, 'Repair result / exception resolution');
            if (a.requestId) {
                const r = get(s.requests, a.requestId, orgId);
                assert(r.type !== 'DONATION', 'Donation scope does not authorize repair.');
            }
            entityId = a.id;
            break;
        }
        case 'restock': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(a.status === 'READY' && a.purpose === 'SUPPORTED', 'Repair and test returned equipment first.');
            a.purpose = 'SPARE';
            a.endpointId = null;
            entityId = a.id;
            break;
        }
        case 'external': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'AUTHORIZED' && r.type === 'OEM', 'Authorize OEM service first.');
            const a = get(s.equipment, r.equipmentId, orgId);
            r.status = 'OEM_OUT';
            r.workOrder = `WO-${s.intakes.filter(x => x.workOrder).length + s.requests.filter(x => x.workOrder).length + 1}`;
            r.tracking = str(p.tracking, 'OEM case / shipment');
            a.requestId = r.id;
            a.status = 'OEM_OUT';
            a.custodian = str(p.custodian, 'OEM provider');
            a.location = 'OEM service';
            entityId = r.id;
            break;
        }
        case 'disposition': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'AUTHORIZED' && ['DONATION', 'DECOMMISSION'].includes(r.type), 'Specific disposition authorization required.');
            str(p.notes, 'Disposition / title transfer evidence');
            const a = get(s.equipment, r.equipmentId, orgId);
            a.status = r.type === 'DONATION' ? 'DONATED' : 'DECOMMISSIONED';
            a.custodian = r.type === 'DONATION' ? 'CESCo (title transferred)' : 'Disposition provider';
            r.workOrder = `WO-${s.intakes.filter(x => x.workOrder).length + s.requests.filter(x => x.workOrder).length + 1}`;
            r.status = 'COMPLETED';
            r.completedAt = now();
            entityId = r.id;
            break;
        }
        case 'complete': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(['DELIVERED', 'RETURNED', 'RECEIVED'].includes(r.status), 'Request is not ready to complete.');
            assert(r.type !== 'RECOVERY' || ['DELIVERED', 'RETURNED'].includes(r.status), 'Recovery delivery required.');
            assert(!['DONATION', 'DECOMMISSION'].includes(r.type), 'Record authorized disposition first.');
            if (['REPAIR', 'OEM'].includes(r.type)) {
                const a = get(s.equipment, r.equipmentId, orgId);
                assert(a.status === 'READY', 'Repair/OEM service requires verified good equipment before completion.');
            }
            r.status = 'COMPLETED';
            r.completedAt = now();
            entityId = r.id;
            break;
        }
        case 'rate': {
            requireCap(u, orgId, 'rates');
            const r: Rate = { id: id(), orgId, name: str(p.name, 'Service name', 200), category: str(p.category, 'Category', 100), unit: str(p.unit, 'Pricing unit', 100), cents: cents(p.cents, 'Unit price'), version: str(p.version, 'Agreement version', 200), active: true, approvedBy: null, approvedAt: null };
            assert(['RECEIVING', 'LABOR', 'PART', 'DISPATCH', 'SHIPPING', 'TESTING', 'STORAGE', 'SLA', 'DISPOSITION'].includes(r.category), 'Unknown rate category.');
            s.rates.push(r);
            entityId = r.id;
            break;
        }
        case 'approveRate': {
            requireCap(u, orgId, 'authorize');
            const rate = get(s.rates, p.id, orgId);
            assert(!rate.approvedAt, 'Agreement already approved.');
            rate.approvedBy = u.id;
            rate.approvedAt = now();
            entityId = rate.id;
            log(s, u, orgId, 'RATE_AUTHORIZATION', rate.id, `${rate.name}; ${rate.cents} cents / ${rate.unit}; ${rate.version}`);
            break;
        }
        case 'move': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(['READY', 'RECEIVED', 'REPAIR'].includes(a.status) && a.custodian === 'CESCo', 'Only unreserved CESCo-held inventory can be repositioned.');
            const before = a.location;
            a.location = str(p.location, 'New hub / stocking location');
            a.position = str(p.position, 'Internal position');
            entityId = a.id;
            log(s, u, orgId, 'STOCK_REPOSITIONED', a.id, `${before} → ${a.location}; ${str(p.notes, 'Custody handoff / placement evidence')}`);
            break;
        }
        case 'terms': {
            requireCap(u, orgId, 'finance');
            org.termsDays = num(p.termsDays, 'Net payment days', 0, 365);
            assert(Number.isInteger(org.termsDays), 'Use whole days.');
            break;
        }
        case 'activity': {
            requireCap(u, orgId, 'operate');
            const rate = get(s.rates, p.rateId, orgId);
            assert(rate.active && rate.approvedAt, 'Client must approve the agreement rate before billing work.');
            const request = p.requestId ? get(s.requests, p.requestId, orgId) : null;
            const intake = p.intakeId ? get(s.intakes, p.intakeId, orgId) : null;
            assert(!!request !== !!intake, 'Link work to either a request or an intake work order.');
            assert(!intake || intake.workOrder, 'Shipment acceptance must create the work order first.');
            assert(!request || (request.authorizedAt && request.workOrder && request.status !== 'WAITING_AUTHORIZATION'), 'Accepted, authorized work order required before charging.');
            const quantity = num(p.quantity, 'Quantity', .001, 1e6);
            const amount = Math.round(quantity * rate.cents);
            assert(Number.isSafeInteger(amount), 'Amount too large.');
            if (request) {
                const accrued = s.activities.filter(x => x.requestId === request.id).reduce((a, x) => a + x.amount, 0);
                assert(accrued + amount <= request.ceiling, 'Authorization ceiling exceeded. Obtain a revised authorization before charging additional work.');
            }
            const asset = p.assetId ? get(s.equipment, p.assetId, orgId) : null;
            if (asset && intake)
                assert(intake.assetIds.includes(asset.id), 'Equipment is outside this intake.');
            const periodStart = p.periodStart ? str(p.periodStart, 'Period start') : null, periodEnd = p.periodEnd ? str(p.periodEnd, 'Period end') : null;
            if (['STORAGE', 'SLA'].includes(rate.category)) {
                assert(periodStart && periodEnd && Number.isFinite(Date.parse(periodStart)) && Date.parse(periodEnd) > Date.parse(periodStart), 'Recurring charges require a valid start and end period.');
                assert(!s.activities.some(x => x.orgId === orgId && x.rateId === rate.id && x.assetId === (asset?.id || null) && x.intakeId === (intake?.id || null) && x.requestId === (request?.id || null) && x.periodStart && x.periodEnd && Date.parse(x.periodStart) < Date.parse(periodEnd) && Date.parse(x.periodEnd) > Date.parse(periodStart)), 'This agreement already has a charge covering that period.');
                assert(!asset || asset.custodian === 'CESCo', 'Storage requires actual CESCo custody.');
            }
            const a: Activity = { id: id(), orgId, requestId: request?.id || null, intakeId: intake?.id || null, assetId: asset?.id || null, rateId: rate.id, rateVersion: rate.version, description: str(p.description, 'Performed service'), quantity, unit: rate.unit, unitCents: rate.cents, amount, status: 'PENDING_REVIEW', performedAt: now(), performedBy: u.email, periodStart, periodEnd, costCents: cents(p.costCents ?? 0, 'Internal service cost'), invoiceId: null };
            s.activities.push(a);
            entityId = a.id;
            break;
        }
        case 'review': {
            requireCap(u, orgId, 'finance');
            const a = get(s.activities, p.id, orgId);
            assert(a.status === 'PENDING_REVIEW', 'Charge already reviewed.');
            a.status = 'APPROVED';
            entityId = a.id;
            break;
        }
        case 'invoice': {
            requireCap(u, orgId, 'finance');
            const rows = s.activities.filter(x => x.orgId === orgId && x.status === 'APPROVED' && !x.invoiceId);
            assert(rows.length, 'No approved unbilled charges.');
            const inv: Invoice = { id: id(), orgId, number: `CES-${String(s.invoices.length + 1).padStart(6, '0')}`, activityIds: rows.map(x => x.id), total: rows.reduce((a, x) => a + x.amount, 0), issuedAt: now(), dueAt: new Date(Date.now() + org.termsDays * 86400000).toISOString(), status: 'ISSUED', termsDays: org.termsDays };
            s.invoices.push(inv);
            for (const a of rows) {
                a.invoiceId = inv.id;
                a.status = 'INVOICED';
            }
            entityId = inv.id;
            break;
        }
        case 'settle': {
            requireCap(u, orgId, 'finance');
            const kind = str(p.kind, 'Settlement type');
            assert(['PAYMENT', 'CREDIT', 'APPLY_CREDIT', 'REFUND'].includes(kind), 'Invalid settlement type.');
            const amount = cents(p.cents);
            assert(amount > 0, 'Enter a positive amount.');
            const reference = str(p.reference, 'External transaction / credit memo reference', 200);
            assert(!s.settlements.some(x => x.orgId === orgId && x.reference === reference), 'Reference already recorded.');
            const inv = kind === 'CREDIT' ? null : get(s.invoices, p.invoiceId, orgId);
            if (inv) {
                if (kind === 'REFUND') {
                    const refundable = s.settlements.filter(x => x.invoiceId === inv.id && ['PAYMENT', 'REFUND'].includes(x.kind)).reduce((a, x) => a + (x.kind === 'PAYMENT' ? x.cents : -x.cents), 0);
                    assert(amount <= refundable, 'Refund exceeds externally paid amount.');
                }
                else
                    assert(amount <= balance(s, inv), 'Payment/credit exceeds invoice balance.');
            }
            if (kind === 'APPLY_CREDIT')
                assert(amount <= creditBalance(s, orgId), 'Insufficient account credit.');
            s.settlements.push({ id: id(), orgId, invoiceId: inv?.id || null, kind: kind as Settlement['kind'], cents: amount, reference, createdAt: now() });
            if (inv)
                inv.status = balance(s, inv) === 0 ? 'PAID' : 'ISSUED';
            entityId = inv?.id || orgId;
            break;
        }
        default: throw Error('Unknown action.');
    }
    log(s, u, orgId, action, entityId, String(p.notes || p.description || 'Recorded in portal'));
    return entityId;
}
export function scoped(s: State, u: User, orgId: string) { requireCap(u, orgId, 'view'); const bill = allowed(u, orgId, 'billing'); return { plans: s.plans.filter(x => x.orgId === orgId), organization: s.organizations.find(x => x.id === orgId), organizations: isInternal(u) ? s.organizations : s.organizations.filter(x => x.id === u.orgId), user: { id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.orgId }, endpoints: s.endpoints.filter(x => x.orgId === orgId), equipment: s.equipment.filter(x => x.orgId === orgId).map(x => ({ ...x, position: isInternal(u) ? x.position : 'Managed by CESCo' })), intakes: s.intakes.filter(x => x.orgId === orgId), requests: s.requests.filter(x => x.orgId === orgId), rates: (bill || isInternal(u)) ? s.rates.filter(x => x.orgId === orgId) : [], activities: (bill || isInternal(u)) ? s.activities.filter(x => x.orgId === orgId).map(x => ({ ...x, costCents: isInternal(u) ? x.costCents : 0 })) : [], invoices: bill ? s.invoices.filter(x => x.orgId === orgId).map(x => ({ ...x, balance: balance(s, x) })) : [], settlements: bill ? s.settlements.filter(x => x.orgId === orgId) : [], credit: bill ? creditBalance(s, orgId) : 0, audit: s.audit.filter(x => x.orgId === orgId), imports: s.imports.filter(x => x.orgId === orgId).map(({ csv, ...x }) => ({ ...x, headers: parseCsv(csv)[0], sample: rowsToObjects(parseCsv(csv)).slice(0, 5).map(x => x.record) })), evidence: s.evidence.filter(x => x.orgId === orgId).map(({ key, ...x }) => x), team: s.users.filter(x => x.orgId === orgId).map(({ password, ...x }) => x) }; }
