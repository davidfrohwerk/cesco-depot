import { normalizeRateUnit } from './rate-units.ts';
import { randomUUID } from 'node:crypto';
import { sparePlan } from './planning.ts';
import { parseCsv, rowsToObjects } from './csv.ts';
import { inferMapping } from './import-mapping.ts';
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
    demo?: boolean;
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
    customerAssetTag?: string;
    deviceType?: string;
    description?: string;
    declaredStatus?: string;
    declaredVerifiedAt?: string;
    declaredNextVerificationAt?: string;
    declaredVerificationNotes?: string;
    manufacturer: string;
    model: string;
    serial: string;
    configuration: string;
    pool: string;
    purpose: 'SUPPORTED' | 'SPARE' | 'UNCLASSIFIED';
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
    packageProfile?: { packageId: string; packaging: string; lengthCm: number; widthCm: number; heightCm: number; weightKg: number; measurementStatus?: 'SIMULATED' | 'CUSTOMER_DECLARED' | 'CESCO_VERIFIED' | 'LEGACY_UNVERIFIED'; enteredUnit?: 'METRIC' | 'US'; enteredMeasurements?: { length: number; width: number; height: number; weight: number }; updatedAt: string; updatedBy: string };
    receipt?: { at: string; actor: string; observedSerial: string; packageCondition: string; condition: string; handoffReference: string; notes: string; sourceIntakeId: string };
    receiptCorrections?: Array<{ at: string; actor: string; previousSerial: string; correctedSerial: string; reason: string; evidenceId: string | null; resolved: boolean }>;
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
export type TechnicalAssessment = {version?:number;at:string;actor:string;diagnosis:string;warranty:string;feasibility:string;estimatedCostCents:number|null;estimatedDays:number|null;recommendation:'REPAIR'|'OEM'|'REPLACE'|'HOLD'|'DISPOSITION';notes:string;evidenceId:string;evidenceSha256:string;approval?:{at:string;actor:string;reference:string;notes:string;assessmentVersion?:number}};
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
    deliveryReceipt?: { at: string; actor: string; recipient: string; reference: string; notes: string };
    installation?: { at: string; actor: string; technician: string; evidenceId: string; evidenceSha256: string; notes: string };
    technicalAssessment?: TechnicalAssessment;
    assessmentHistory?: TechnicalAssessment[];
    repairExecution?: {workOrder:string;openedAt:string;openedBy:string;assessmentVersion:number;authorizationReference:string;result?:{at:string;actor:string;outcome:'SUCCESS'|'UNSUCCESSFUL';notes:string;evidenceId:string;evidenceSha256:string}};
    failedReturn?: { authorization?: {at:string;actor:string;reference:string;destination:string;instructions:string}; inbound?: {at:string;actor:string;carrier:string;tracking:string;shipper:string}; receipt?: {at:string;actor:string;observedSerial:string;condition:string;location:string;position:string;evidenceId:string;evidenceSha256:string} };
    pickPack?: { at: string; actor: string; observedSerial: string; packageId: string; packageRevisionAt: string; sourcePosition: string; stagingLocation: string; condition: string; evidenceReference: string };
    shippingLabel?: { at: string; actor: string; carrier: string; service: string; tracking: string; labelReference: string; rateReference: string; destination: string; packageRevisionAt: string };
    tenderReady?: { at: string; actor: string; evidenceReference: string; tracking: string; packageRevisionAt: string };
    carrierHandoff?: { at: string; actor: string; acceptedBy: string; proofReference: string; evidenceId: string; evidenceSha256: string; tracking: string }; 
    shipmentPreparation?: { id: string; requestId: string; spareId: string; packageId: string; packageRevisionAt: string; packageStatus: string; dimensionsCm: [number, number, number]; weightKg: number; sourcePosition: string; sourceCustodian: string; destinationEndpointId: string; destination: string; serviceLevel: string; offerMode: string; state: 'DRAFT' | 'REVIEWED' | 'STALE' | 'RELEASE_AUTHORIZED'; recordedAt: string; recordedBy: string; reviewedAt?: string; reviewedBy?: string; reviewNotes?: string; releaseAuthorizedAt?: string; releaseAuthorizedBy?: string }; 
    fulfillment?: { offerMode?: 'SIMULATED' | 'LIVE'; spareId: string; handlingRateId: string; handlingCents: number; shippingCents: number; shippingSource: string; serviceLevel: string; destination: string; termsVersion: string; totalCents: number; preparedAt: string; confirmedAt: string | null; confirmedBy: string | null };
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
export type OperationalEvent = Base & { requestId: string; equipmentId: string; type: 'SPARE_RESERVED' | 'SPARE_DISPATCHED' | 'DELIVERY_RECORDED' | 'INSTALLATION_CONFIRMED' | 'FAILED_RETURN_RECEIVED' | 'SPARE_REPLENISHED'; at: string; actor: string; reference: string; relatedEquipmentId: string | null; version: 1; };
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
    proposedChanges?: Array<{ equipmentId: string; fields: string[] }>;
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
    category?: string;
    receiptCorrectionIndex?: number;
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
    operationalEvents?: OperationalEvent[];
    imports: ImportJob[];
    evidence: Evidence[];
    invites: Invite[];
};
export const emptyState = (): State => ({ plans: [], organizations: [], users: [], endpoints: [], equipment: [], intakes: [], rates: [], requests: [], activities: [], invoices: [], settlements: [], audit: [], operationalEvents: [], imports: [], evidence: [], invites: [] });
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export function assert(value: unknown, message: string): asserts value { if (!value)
    throw Error(message); }
export function str(value: unknown, label: string, max = 1000) { assert(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${label} is required (maximum ${max} characters).`); return value.trim(); }
export function num(value: unknown, label: string, min = 0, max = 1e9) { const n = Number(value); assert(value !== '' && value !== null && value !== undefined && Number.isFinite(n) && n >= min && n <= max, `${label} must be between ${min} and ${max}.`); return n; }
export function cents(value: unknown, label = 'Amount') { const n = num(value, label); assert(Number.isSafeInteger(n), `${label} must be whole cents.`); return n; }
export function log(s: State, u: User, orgId: string, action: string, entityId: string, detail: string) { s.audit.push({ id: id(), orgId, at: now(), actor: u.email, action, entityId, detail }); }
export function operationalEvent(s: State, u: User, orgId: string, requestId: string, equipmentId: string, type: OperationalEvent['type'], reference = '', relatedEquipmentId: string | null = null) {
    (s.operationalEvents ||= []).push({ id: id(), orgId, requestId, equipmentId, type, at: now(), actor: u.email, reference, relatedEquipmentId, version: 1 });
}
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
    equipment: ['externalId', 'manufacturer', 'model', 'serial', 'configuration', 'pool', 'purpose', 'endpointId', 'customerAssetTag', 'deviceType', 'description', 'declaredStatus', 'declaredVerifiedAt', 'declaredNextVerificationAt', 'declaredVerificationNotes', 'volume', 'recoveryTargetHours']
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
                for (const key of ['customerAssetTag', 'deviceType', 'description', 'declaredStatus', 'declaredVerificationNotes'])
                    assert(r[key].length <= 2000, `Customer field ${key} exceeds 2000 characters.`);
                for (const key of ['declaredVerifiedAt', 'declaredNextVerificationAt'])
                    if (r[key]) assert(r[key].length <= 40 && !Number.isNaN(Date.parse(r[key])), `Invalid customer verification date: ${key}.`);
                if (r.purpose) assert(['SUPPORTED', 'SPARE'].includes(r.purpose), 'Purpose must be SUPPORTED or SPARE when supplied.');
                if (r.volume)
                    num(r.volume, 'Volume', 0, 1e6);
                if (r.recoveryTargetHours)
                    num(r.recoveryTargetHours, 'Recovery target', 0.1, 8760);
                assert(!s.equipment.some(x => x.orgId === orgId && x.externalId === r.externalId), 'Client equipment ID already exists.');
                const key = `${r.manufacturer.toLowerCase()}|${r.serial.toLowerCase()}`;
                assert(!serials.has(key) && !s.equipment.some(x => x.orgId === orgId && `${x.manufacturer.toLowerCase()}|${x.serial.toLowerCase()}` === key), 'Duplicate manufacturer/serial in this account.');
                serials.add(key);
                if (r.endpointId)
                    assert(s.endpoints.some(x => x.orgId === orgId && x.externalId === r.endpointId), 'Endpoint ID must refer to an onboarded endpoint.');
                if (r.purpose === 'SUPPORTED')
                    assert(r.endpointId, 'Supported equipment must reference an onboarded endpoint.');
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
export const customerDeclarationFields = ['customerAssetTag', 'deviceType', 'description', 'declaredStatus', 'declaredVerifiedAt', 'declaredNextVerificationAt', 'declaredVerificationNotes'] as const;
export type CustomerDeclarationField = typeof customerDeclarationFields[number];
export function previewEnrichment(s: State, orgId: string, source: ImportJob) {
    assert(source.orgId === orgId && source.kind === 'equipment' && source.status === 'COMMITTED', 'Choose a committed equipment import from this account.');
    const rows = rowsToObjects(parseCsv(source.csv.replace(/^\uFEFF/, '')));
    const errors: string[] = [];
    const updates: Array<{ id: string; changes: Partial<Pick<Equipment, CustomerDeclarationField>> }> = [];
    const seen = new Set<string>();
    const detected = inferMapping('equipment', parseCsv(source.csv)[0] || []);
    const mapping = { ...detected, ...source.mapping };
    for (const row of rows) {
        const read = (field: string) => String(row.record[mapping[field] || field] || '').trim();
        const externalId = read('externalId');
        const manufacturer = read('manufacturer');
        const model = read('model');
        const serial = read('serial');
        const a = s.equipment.find(x => x.orgId === orgId && x.externalId === externalId);
        if (!externalId || seen.has(externalId) || !a || !manufacturer || !model || !serial ||
            a.manufacturer.toLowerCase() !== manufacturer.toLowerCase() ||
            a.model.toLowerCase() !== model.toLowerCase() ||
            a.serial.toLowerCase() !== serial.toLowerCase()) {
            errors.push(`Row ${row.rowNumber}: Missing, repeated, or mismatched equipment identity ${externalId || '(blank)'}.`);
            continue;
        }
        seen.add(externalId);
        const changes: Partial<Pick<Equipment, CustomerDeclarationField>> = {};
        for (const field of customerDeclarationFields) {
            const incoming = read(field);
            if (!incoming) continue;
            if (incoming.length > 2000 || (field.includes('At') && (incoming.length > 40 || Number.isNaN(Date.parse(incoming))))) {
                errors.push(`Row ${row.rowNumber}: Invalid ${field} value.`);
                continue;
            }
            const current = a[field] || '';
            if (current && current !== incoming) {
                errors.push(`Row ${row.rowNumber}: ${field} conflicts with existing equipment ${externalId}; existing value will not be overwritten.`);
                continue;
            }
            if (!current) changes[field] = incoming;
        }
        if (Object.keys(changes).length) updates.push({ id: a.id, changes });
    }
    return { count: rows.length, updates, errors };
}
export function reviewBulkClassification(s: State, orgId: string, equipmentIds: unknown, purpose: unknown, recoveryTargetHours: unknown) {
    assert(Array.isArray(equipmentIds) && equipmentIds.length > 0 && equipmentIds.length <= 10000, 'Select 1–10,000 equipment records.');
    assert(equipmentIds.every(x => typeof x === 'string') && new Set(equipmentIds).size === equipmentIds.length, 'Equipment selections must be unique.');
    assert(purpose === 'SUPPORTED' || purpose === 'SPARE', 'Choose supported equipment or client-owned spare.');
    const target = purpose as 'SUPPORTED' | 'SPARE';
    const hours = recoveryTargetHours === '' || recoveryTargetHours === null || recoveryTargetHours === undefined ? null : num(recoveryTargetHours, 'Recovery target', .1, 8760);
    assert(target === 'SUPPORTED' || hours === null, 'Recovery targets apply only to supported equipment.');
    const rows = equipmentIds.map(x => get(s.equipment, x, orgId));
    for (const a of rows) {
        assert(a.purpose === 'UNCLASSIFIED' && a.status === 'REGISTERED' && a.custodian === 'Client' && !a.intakeId && !a.requestId,
            `Equipment ${a.externalId} is not eligible for initial classification.`);
        assert(a.manufacturer && a.model && a.serial && a.pool && a.configuration, `Equipment ${a.externalId} lacks required identification or compatibility details.`);
        if (target === 'SUPPORTED') {
            assert(a.endpointId && s.endpoints.some(e => e.orgId === orgId && e.id === a.endpointId && e.active),
                `Equipment ${a.externalId} needs an active onboarded endpoint.`);
        } else {
            assert(s.equipment.some(x => x.orgId === orgId && x.purpose === 'SUPPORTED' && x.pool === a.pool && x.configuration === a.configuration),
                `Spare ${a.externalId} has no confirmed supported equipment with the same pool and configuration.`);
        }
    }
    return { rows: rows.map(a => ({ id: a.id, externalId: a.externalId, model: a.model, pool: a.pool, configuration: a.configuration, endpointId: a.endpointId })),
        purpose: target, recoveryTargetHours: hours };
}
export function validateCorrectionEvidenceLink(s: State, orgId: string, equipmentId: string, correctionIndex: number) {
    assert(Number.isSafeInteger(correctionIndex) && correctionIndex >= 0, 'Invalid receiving correction reference.');
    const equipment = get(s.equipment, equipmentId, orgId);
    assert(equipment.receipt && equipment.intakeId, 'Equipment has no recorded physical receipt.');
    assert(equipment.receiptCorrections?.[correctionIndex], 'Receiving correction does not exist for this equipment.');
    return equipment;
}
export function mutate(s: State, u: User, orgId: string, action: string, p: Record<string, unknown>) {
    const org = s.organizations.find(x => x.id === orgId);
    assert(org, 'Account not found.');
    let entityId = orgId;
    if (action === 'seedLiveDemo') {
        assert(u.role === 'SYSTEM_ADMIN', 'Only a system administrator can create the isolated demo.');
        const demoId = 'cesco-live-fulfillment-demo';
        assert(!s.organizations.some(x => x.id === demoId), 'Demo account already exists. Select it from the account dropdown.');
        const stamp = now(), endpointId = id(), targetId = id(), spareId = id(), requestId = id(), rateId = id(), preparationId = id();
        const demoName = 'TRAINING ONLY - Live Fulfillment Lab';
        s.organizations.push({id:demoId,name:demoName,termsDays:30,currency:'USD',demo:true});
        const address='Training Lab, 100 Fictional Way, Indianapolis, IN, 46201, US';
        s.endpoints.push({id:endpointId,orgId:demoId,externalId:'TRAINING-ENDPOINT',name:'Training Lab',siteType:'DEMO',addressLine1:'100 Fictional Way',addressLine2:'',city:'Indianapolis',state:'IN',postalCode:'46201',country:'US',market:'TRAINING',contactName:'Demo only',contactEmail:'',contactPhone:'',accessNotes:'Fictional destination - do not tender to a carrier',active:true});
        const common = {orgId:demoId,manufacturer:'DEMO OEM',model:'Training Router',configuration:'training-v1',pool:'TRAINING-ROUTERS',condition:'GOOD',testedAt:stamp,testDue:new Date(Date.now()+30*86400000).toISOString(),intakeId:null,volume:1,recoveryTargetHours:null};
        s.equipment.push({...common,id:targetId,externalId:'TRAINING-SUPPORTED',serial:'TRAINING-TARGET-0001',purpose:'SUPPORTED',endpointId,status:'FAILED',location:'Fictional endpoint',position:'',custodian:'Client',requestId,description:'Fictional customer equipment'});
        s.equipment.push({...common,id:spareId,externalId:'TRAINING-SPARE',serial:'TRAINING-SPARE-0001',purpose:'SPARE',endpointId:null,status:'RESERVED',location:'Training depot',position:'DEMO-BIN-A1',custodian:'CESCo',requestId,description:'Fictional spare - no physical inventory',packageProfile:{packageId:'TRAINING-CARTON-001',packaging:'Training carton (fictional)',lengthCm:45,widthCm:30,heightCm:20,weightKg:5.25,measurementStatus:'CESCO_VERIFIED',updatedAt:stamp,updatedBy:'Training fixture'}});
        s.rates.push({id:rateId,orgId:demoId,name:'TRAINING - handling (not billable)',category:'DISPATCH',unit:'each',cents:2500,version:'TRAINING-ONLY',active:true,approvedBy:'training-client-fixture',approvedAt:stamp});
        s.requests.push({id:requestId,orgId:demoId,number:'TRAINING-SR-1',endpointId,equipmentId:targetId,type:'RECOVERY',scope:'TRAINING ONLY: Exercise physical pick and pack with fictitious inventory',status:'RESERVED',ceiling:7500,authorizedBy:'training-client-fixture',authorizedAt:stamp,termsVersion:'TRAINING-ONLY',spareId,tracking:'',etaHours:null,createdAt:stamp,completedAt:null,workOrder:null,pendingCeiling:null,resumeStatus:null,shipmentPreparation:{id:preparationId,requestId,spareId,packageId:'TRAINING-CARTON-001',packageRevisionAt:stamp,packageStatus:'CESCO_VERIFIED',dimensionsCm:[45,30,20],weightKg:5.25,sourcePosition:'DEMO-BIN-A1',sourceCustodian:'CESCo',destinationEndpointId:endpointId,destination:address,serviceLevel:'TRAINING-OVERNIGHT',offerMode:'LIVE',state:'RELEASE_AUTHORIZED',recordedAt:stamp,recordedBy:'training-preparer',reviewedAt:stamp,reviewedBy:'training-reviewer',reviewNotes:'Synthetic independent review. No physical inspection performed.',releaseAuthorizedAt:stamp,releaseAuthorizedBy:'training-authorizer'},fulfillment:{offerMode:'LIVE',spareId,handlingRateId:rateId,handlingCents:2500,shippingCents:5000,shippingSource:'TRAINING estimate - no carrier',serviceLevel:'TRAINING-OVERNIGHT',destination:address,termsVersion:'TRAINING-ONLY',totalCents:7500,preparedAt:stamp,confirmedAt:stamp,confirmedBy:'training-client-fixture'}});
        log(s,u,demoId,'TRAINING_FIXTURE_CREATED',requestId,'All assets, approval identities, customer agreements and charges are synthetic. No external obligations exist.');
        return demoId;
    }
    if (action === 'seedDeliveryDemo') {
        assert(u.role === 'SYSTEM_ADMIN' && org.demo && org.id === 'cesco-live-fulfillment-demo', 'Only the system administrator may initialize the isolated training delivery fixture.');
        assert(!s.requests.some(x => x.orgId === orgId && x.number === 'TRAINING-DELIVERY-1'), 'Training delivery fixture already exists.');
        const endpoint = s.endpoints.find(x => x.orgId === orgId && x.externalId === 'TRAINING-ENDPOINT');
        assert(endpoint, 'Initialize the training fulfillment lab first.');
        const stamp=now(), targetId=id(), spareId=id(), requestId=id();
        const common={orgId,manufacturer:'DEMO OEM',model:'Training Router',configuration:'training-v1',pool:'TRAINING-DELIVERY-POOL',condition:'GOOD',testedAt:stamp,testDue:new Date(Date.now()+30*86400000).toISOString(),intakeId:null,volume:1,recoveryTargetHours:null};
        s.equipment.push({...common,id:targetId,externalId:'TRAINING-DELIVERY-TARGET',serial:'TRAINING-FAILED-0002',purpose:'SUPPORTED',endpointId:endpoint.id,status:'FAILED',location:endpoint.name,position:'',custodian:'Client',requestId,description:'Synthetic failed device, never physically shipped'});
        s.equipment.push({...common,id:spareId,externalId:'TRAINING-DELIVERY-SPARE',serial:'TRAINING-SPARE-0002',purpose:'SPARE',endpointId:null,status:'OUTBOUND',location:'Synthetic transit',position:'',custodian:'TRAINING COURIER',requestId,description:'Synthetic replacement, no actual carrier custody'});
        s.requests.push({id:requestId,orgId,number:'TRAINING-DELIVERY-1',endpointId:endpoint.id,equipmentId:targetId,type:'RECOVERY',scope:'TRAINING ONLY: Record delivery, then independently verify installation',status:'DISPATCHED',ceiling:0,authorizedBy:'training-fixture',authorizedAt:stamp,termsVersion:'TRAINING-NONBILLABLE',spareId,tracking:'TRAINING-DELIVERY-TRACK',etaHours:24,createdAt:stamp,completedAt:null,workOrder:'TRAINING-DELIVERY-WO',pendingCeiling:null,resumeStatus:null});
        log(s,u,orgId,'TRAINING_DELIVERY_FIXTURE_CREATED',requestId,'Synthetic dispatched request for delivery/installation training. No carrier, custody transfer, or charges.');
        return requestId;
    }
    if (org.demo) {
        const isTrainingDelivery = ['deliver','confirmInstallation','authorizeFailedReturn','recordFailedReturnShipment','return','assessFailedUnit'].includes(action) && s.requests.some(x => x.id === p.id && x.orgId === orgId && x.number === 'TRAINING-DELIVERY-1');
        assert(isTrainingDelivery || !['dispatch','deliver','confirmInstallation','authorizeFailedReturn','recordFailedReturnShipment','return','assessFailedUnit','approveFailedTreatment','openRecoveryRepair','recordRecoveryRepairResult','verifyRecoveryRepair','external','activity','review','invoice','settle','return','repair','restock','disposition','complete','recordStorage'].includes(action), 'TRAINING ONLY: physical carrier handoff, return, completion, and financial execution are disabled for this demo account.');
    }
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
                else {
                    const purpose = (r.purpose || 'UNCLASSIFIED') as Equipment['purpose'];
                    const endpoint = s.endpoints.find(x => x.orgId === orgId && x.externalId === r.endpointId);
                    s.equipment.push({ id: id(), orgId, externalId: r.externalId, customerAssetTag: r.customerAssetTag || '', deviceType: r.deviceType || '', description: r.description || '', declaredStatus: r.declaredStatus || '', declaredVerifiedAt: r.declaredVerifiedAt || '', declaredNextVerificationAt: r.declaredNextVerificationAt || '', declaredVerificationNotes: r.declaredVerificationNotes || '', manufacturer: r.manufacturer, model: r.model, serial: r.serial, configuration: r.configuration, pool: r.pool, purpose, endpointId: endpoint?.id || null, status: purpose === 'SUPPORTED' ? 'INSTALLED' : purpose === 'SPARE' ? 'CLIENT_HELD' : 'REGISTERED', condition: 'UNKNOWN', location: endpoint?.name || 'Client', position: '', custodian: 'Client', testedAt: null, testDue: null, intakeId: null, requestId: null, volume: Number(r.volume || 0), recoveryTargetHours: r.recoveryTargetHours ? Number(r.recoveryTargetHours) : null });
                }
            }
            job.status = 'COMMITTED';
            job.errors = [];
            entityId = job.id;
            break;
        }
        case 'enrichmentPreview': {
            requireCap(u, orgId, 'onboard');
            const source = get(s.imports, p.id, orgId);
            const review = previewEnrichment(s, orgId, source);
            assert(review.updates.length || review.errors.length, 'No missing customer metadata found to enrich.');
            const job: ImportJob = { id: id(), orgId, kind: 'enrichment', csv: source.csv, mapping: { ...source.mapping, __sourceImportId: source.id }, status: 'PREVIEW', count: review.count, errors: review.errors, proposedChanges: review.updates.map(x => ({ equipmentId: x.id, fields: Object.keys(x.changes) })), createdAt: now(), actor: u.email };
            s.imports.push(job);
            entityId = job.id;
            break;
        }
        case 'enrichmentCommit': {
            requireCap(u, orgId, 'onboard');
            const job = get(s.imports, p.id, orgId);
            assert(job.kind === 'enrichment' && job.status === 'PREVIEW', 'Choose a pending enrichment review.');
            const source = get(s.imports, job.mapping.__sourceImportId, orgId);
            const review = previewEnrichment(s, orgId, source);
            assert(!review.errors.length, review.errors.slice(0, 5).join(' '));
            assert(review.updates.length, 'No eligible fields remain to enrich.');
            for (const row of review.updates) {
                const a = get(s.equipment, row.id, orgId);
                Object.assign(a, row.changes);
                log(s, u, orgId, 'CUSTOMER_METADATA_ENRICHED', a.id, `Source import ${source.id}; fields: ${Object.keys(row.changes).join(', ')}`);
            }
            job.status = 'COMMITTED';
            job.errors = [];
            entityId = job.id;
            break;
        }
        case 'bulkClassifyPreview': {
            requireCap(u, orgId, 'onboard');
            const result = reviewBulkClassification(s, orgId, p.equipmentIds, p.purpose, p.recoveryTargetHours);
            const job: ImportJob = { id: id(), orgId, kind: 'classification', csv: '', mapping: {
                equipmentIds: JSON.stringify(result.rows.map(x => x.id)),
                purpose: result.purpose,
                recoveryTargetHours: result.recoveryTargetHours === null ? '' : String(result.recoveryTargetHours)
            }, status: 'PREVIEW', count: result.rows.length, errors: [], createdAt: now(), actor: u.email };
            s.imports.push(job);
            entityId = job.id;
            break;
        }
        case 'bulkClassifyCommit': {
            requireCap(u, orgId, 'onboard');
            const job = get(s.imports, p.id, orgId);
            assert(job.kind === 'classification' && job.status === 'PREVIEW', 'Choose a pending classification review.');
            const result = reviewBulkClassification(s, orgId, JSON.parse(job.mapping.equipmentIds), job.mapping.purpose, job.mapping.recoveryTargetHours);
            for (const row of result.rows) {
                const a = get(s.equipment, row.id, orgId);
                a.purpose = result.purpose;
                a.status = result.purpose === 'SUPPORTED' ? 'INSTALLED' : 'CLIENT_HELD';
                if (result.recoveryTargetHours !== null) a.recoveryTargetHours = result.recoveryTargetHours;
                log(s, u, orgId, 'EQUIPMENT_CLASSIFIED', a.id, `Batch ${job.id}; role ${result.purpose}; recovery target ${result.recoveryTargetHours ?? 'unchanged'}`);
            }
            job.status = 'COMMITTED';
            entityId = job.id;
            break;
        }
        case 'classifyEquipment': {
            requireCap(u, orgId, 'onboard');
            const a = get(s.equipment, p.id, orgId);
            assert(a.purpose === 'UNCLASSIFIED', 'Equipment is already classified.');
            const purpose = str(p.purpose, 'Equipment role');
            assert(['SUPPORTED', 'SPARE'].includes(purpose), 'Choose supported equipment or client-owned spare.');
            if (purpose === 'SUPPORTED')
                assert(a.endpointId, 'Supported equipment must be associated with an endpoint.');
            a.purpose = purpose as Equipment['purpose'];
            a.status = purpose === 'SUPPORTED' ? 'INSTALLED' : 'CLIENT_HELD';
            if (p.recoveryTargetHours !== '' && p.recoveryTargetHours !== null && p.recoveryTargetHours !== undefined)
                a.recoveryTargetHours = num(p.recoveryTargetHours, 'Recovery target', .1, 8760);
            entityId = a.id;
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
            const packageCondition = p.packageCondition === undefined ? 'NOT_RECORDED_LEGACY' : str(p.packageCondition, 'Package condition', 40);
            assert(['INTACT', 'DAMAGED', 'OPENED', 'NOT_RECORDED_LEGACY'].includes(packageCondition), 'Invalid package condition.');
            const handoffReference = p.handoffReference === undefined ? 'NOT_RECORDED_LEGACY' : str(p.handoffReference, 'Physical handoff reference', 200);
            const receiptNotes = String(p.notes || '').trim();
            assert(receiptNotes.length <= 2000, 'Receipt notes cannot exceed 2000 characters.');
            a.receipt = { at: now(), actor: u.email, observedSerial: observed, packageCondition, condition, handoffReference, notes: receiptNotes, sourceIntakeId: t.id };
            a.condition = condition;
            a.status = matches ? 'RECEIVED' : 'EXCEPTION';
            a.location = str(p.location, 'Depot / stocking location');
            a.position = str(p.position, 'Internal storage position');
            a.custodian = 'CESCo';
            if (t.assetIds.every(x => !['INBOUND'].includes(get(s.equipment, x, orgId).status)))
                t.status = t.assetIds.some(x => get(s.equipment, x, orgId).status === 'EXCEPTION') ? 'EXCEPTION' : 'RECEIVED';
            entityId = a.id;
            log(s, u, orgId, 'RECEIPT', a.id, `Observed ${observed}; expected ${a.serial}; equipment ${condition}; package ${packageCondition}; handoff ${handoffReference}; ${a.location}; ${a.position}; ${receiptNotes}`);
            break;
        }
        case 'correctReceiptObservation': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(a.status === 'EXCEPTION' && a.intakeId && a.receipt, 'Only a received exception with an original observation can be corrected.');
            const t = get(s.intakes, a.intakeId, orgId);
            assert(t.assetIds.includes(a.id), 'Equipment does not belong to the intake.');
            const observed = str(p.serial, 'Corrected observed serial', 200);
            const reason = str(p.reason, 'Correction reason', 1000);
            const current = a.receiptCorrections?.at(-1)?.correctedSerial || a.receipt.observedSerial;
            assert(observed !== current, 'The corrected serial must differ from the latest observation.');
            const evidenceId = p.evidenceId ? str(p.evidenceId, 'Supporting evidence identifier') : null;
            if (evidenceId) {
                const evidence = get(s.evidence, evidenceId, orgId);
                assert(evidence.entityId === a.id || evidence.entityId === t.id, 'Evidence must be linked to this equipment or its intake.');
            }
            const resolved = observed === a.serial;
            const correction = { at: now(), actor: u.email, previousSerial: current, correctedSerial: observed, reason, evidenceId, resolved };
            a.receiptCorrections = [...(a.receiptCorrections || []), correction];
            if (resolved) {
                a.status = 'RECEIVED';
                t.status = t.assetIds.every(x => get(s.equipment, x, orgId).status === 'RECEIVED') ? 'RECEIVED' :
                    t.assetIds.some(x => get(s.equipment, x, orgId).status === 'EXCEPTION') ? 'EXCEPTION' : 'IN_TRANSIT';
            }
            entityId = a.id;
            log(s, u, orgId, 'RECEIPT_OBSERVATION_CORRECTED', a.id,
                `Intake ${t.number}; prior ${current}; corrected ${observed}; resolved ${resolved}; reason ${reason}; evidence ${evidenceId || 'none'}`);
            break;
        }
        case 'verify': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(['RECEIVED', 'RETURNED', 'REPAIR'].includes(a.status), 'Receive or repair this unit before testing.');
            assert(!s.requests.some(r=>r.orgId===orgId&&r.type==='RECOVERY'&&r.equipmentId===a.id&&!!r.failedReturn?.receipt),'Recovered failed equipment requires independent post-repair verification.');
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
        case 'prepareFulfillment': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.type === 'RECOVERY' && ['REQUESTED', 'QUOTED'].includes(r.status), 'Only an unexecuted recovery request can receive a fulfillment offer.');
            const affected = get(s.equipment, r.equipmentId, orgId);
            const spare = get(s.equipment, p.spareId, orgId);
            assert(compatible(affected, spare) && ready(spare) && spare.custodian === 'CESCo' && !spare.requestId, 'Choose an unallocated, compatible CESCo-held verified spare.');
            const rate = get(s.rates, p.handlingRateId, orgId);
            assert(rate.category === 'DISPATCH' && rate.active && rate.approvedAt, 'An active, client-approved dispatch handling rate is required.');
            assert(rate.unit === 'each' || rate.unit === 'fulfillment', 'Handling rate must use each or fulfillment units.');
            const offerMode = p.offerMode === undefined ? 'LIVE' : str(p.offerMode, 'Offer type');
            assert(offerMode === 'SIMULATED' || offerMode === 'LIVE', 'Choose a valid fulfillment offer type.');
            const shippingCents = cents(p.shippingCents, 'Shipping charge');
            const shippingSource = str(p.shippingSource, 'Carrier rate source / reference', 300);
            const serviceLevel = str(p.serviceLevel, 'Delivery service level', 200);
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            assert(endpoint.active, 'Endpoint must be active.');
            const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
            const totalCents = rate.cents + shippingCents;
            assert(Number.isSafeInteger(totalCents), 'Fulfillment charge exceeds supported range.');
            r.fulfillment = { offerMode, spareId: spare.id, handlingRateId: rate.id, handlingCents: rate.cents, shippingCents, shippingSource, serviceLevel, destination, termsVersion: rate.version, totalCents, preparedAt: now(), confirmedAt: null, confirmedBy: null };
            r.status = 'FULFILLMENT_OFFER';
            r.authorizedAt = null;
            r.authorizedBy = null;
            entityId = r.id;
            log(s, u, orgId, 'FULFILLMENT_OFFER_PREPARED', r.id, JSON.stringify(r.fulfillment));
            break;
        }
        case 'prepareShipment': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.type === 'RECOVERY' && r.status === 'FULFILLMENT_OFFER' && r.fulfillment, 'An active fulfillment offer is required before shipment preparation.');
            const offer = r.fulfillment;
            const spare = get(s.equipment, offer.spareId, orgId);
            const affected = get(s.equipment, r.equipmentId, orgId);
            assert(compatible(affected, spare) && ready(spare) && spare.custodian === 'CESCo' && !spare.requestId, 'Spare is not currently available for shipment preparation.');
            const profile = spare.packageProfile;
            assert(profile && profile.lengthCm > 0 && profile.widthCm > 0 && profile.heightCm > 0 && profile.weightKg > 0, 'A complete package profile is required.');
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
            assert(endpoint.active && destination === offer.destination, 'Delivery destination changed; refresh the fulfillment offer.');
            assert(offer.offerMode === 'SIMULATED' || profile.measurementStatus === 'CESCO_VERIFIED', 'Live shipment preparation requires CESCo-verified package measurements.');
            assert(!r.shipmentPreparation || r.shipmentPreparation.state !== 'DRAFT', 'Shipment preparation already exists; withdraw the offer to start a new one.');
            r.shipmentPreparation = { id: id(), requestId: r.id, spareId: spare.id, packageId: profile.packageId, packageRevisionAt: profile.updatedAt, packageStatus: profile.measurementStatus || 'LEGACY_UNVERIFIED', dimensionsCm: [profile.lengthCm, profile.widthCm, profile.heightCm], weightKg: profile.weightKg, sourcePosition: spare.position, sourceCustodian: spare.custodian, destinationEndpointId: endpoint.id, destination, serviceLevel: offer.serviceLevel, offerMode: offer.offerMode || 'LEGACY', state: 'DRAFT', recordedAt: now(), recordedBy: u.email };
            entityId = r.id;
            log(s, u, orgId, 'SHIPMENT_PREPARATION_DRAFTED', r.id, JSON.stringify(r.shipmentPreparation));
            break;
        }
        case 'reviseShipment': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'FULFILLMENT_OFFER' && r.fulfillment && r.shipmentPreparation, 'An unconfirmed prepared fulfillment offer is required.');
            assert(r.shipmentPreparation.state !== 'RELEASE_AUTHORIZED', 'Release-authorized shipment cannot be revised through the draft workflow.');
            const reason = str(p.reason, 'Revision reason', 500);
            const previous = structuredClone(r.shipmentPreparation);
            const offer = r.fulfillment;
            const spare = get(s.equipment, offer.spareId, orgId);
            const target = get(s.equipment, r.equipmentId, orgId);
            assert(compatible(target, spare) && ready(spare) && spare.custodian === 'CESCo' && !spare.requestId, 'Spare is no longer available.');
            const profile = spare.packageProfile;
            assert(profile && profile.lengthCm > 0 && profile.widthCm > 0 && profile.heightCm > 0 && profile.weightKg > 0, 'Complete package measurements are required.');
            assert(offer.offerMode === 'SIMULATED' || profile.measurementStatus === 'CESCO_VERIFIED', 'Live shipment requires verified measurements.');
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
            assert(endpoint.active && offer.destination === destination, 'Destination differs from agreed fulfillment; refresh the offer.');
            assert(previous.offerMode === offer.offerMode && previous.spareId === offer.spareId && previous.serviceLevel === offer.serviceLevel, 'Fulfillment terms have changed; refresh the offer.');
            r.shipmentPreparation = { id: id(), requestId: r.id, spareId: spare.id, packageId: profile.packageId, packageRevisionAt: profile.updatedAt, packageStatus: profile.measurementStatus || 'LEGACY_UNVERIFIED', dimensionsCm: [profile.lengthCm, profile.widthCm, profile.heightCm], weightKg: profile.weightKg, sourcePosition: spare.position, sourceCustodian: spare.custodian, destinationEndpointId: endpoint.id, destination, serviceLevel: offer.serviceLevel, offerMode: offer.offerMode || 'LEGACY', state: 'DRAFT', recordedAt: now(), recordedBy: u.email };
            entityId = r.id;
            log(s, u, orgId, 'SHIPMENT_PREPARATION_SUPERSEDED', r.id, JSON.stringify({ reason, previous, replacement: r.shipmentPreparation }));
            break;
        }
        case 'reviewShipment': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'FULFILLMENT_OFFER' && r.fulfillment && r.shipmentPreparation?.state === 'DRAFT', 'A draft shipment preparation is required.');
            const draft = r.shipmentPreparation;
            const a = get(s.equipment, draft.spareId, orgId);
            const target = get(s.equipment, r.equipmentId, orgId);
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
            assert(compatible(target, a) && ready(a) && a.custodian === 'CESCo' && !a.requestId, 'The spare is no longer available.');
            assert(a.position === draft.sourcePosition && a.packageProfile?.updatedAt === draft.packageRevisionAt && a.packageProfile?.packageId === draft.packageId, 'Stock position or package profile changed; prepare a new shipment.');
            assert(endpoint.active && destination === draft.destination && r.fulfillment.destination === draft.destination, 'Endpoint destination changed; refresh the fulfillment offer.');
            assert(r.fulfillment.spareId === draft.spareId && r.fulfillment.serviceLevel === draft.serviceLevel && r.fulfillment.offerMode === draft.offerMode, 'Fulfillment terms changed.');
            const agreement = get(s.rates, r.fulfillment.handlingRateId, orgId);
            assert(agreement.active && !!agreement.approvedAt && agreement.version === r.fulfillment.termsVersion && agreement.cents === r.fulfillment.handlingCents, 'Standing handling agreement changed; refresh the fulfillment offer.');
            draft.reviewNotes = str(p.notes, 'Review notes', 1000);
            draft.reviewedAt = now();
            draft.reviewedBy = u.email;
            draft.state = 'REVIEWED';
            entityId = r.id;
            log(s, u, orgId, 'SHIPMENT_PREPARATION_REVIEWED', r.id, JSON.stringify({ preparationId: draft.id, notes: draft.reviewNotes, mode: draft.offerMode }));
            break;
        }
        case 'authorizeShipmentRelease': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            const draft = r.shipmentPreparation;
            assert(draft && draft.state === 'REVIEWED', 'Shipment preparation must be reviewed first.');
            assert(draft.offerMode === 'LIVE' && r.fulfillment?.offerMode === 'LIVE', 'Simulated or legacy shipment cannot be released.');
            assert(r.status === 'AUTHORIZED' && r.fulfillment?.confirmedAt, 'Customer fulfillment approval is required before release authorization.');
            const a = get(s.equipment, draft.spareId, orgId);
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
            assert(a.packageProfile?.measurementStatus === 'CESCO_VERIFIED' && a.packageProfile.updatedAt === draft.packageRevisionAt && a.packageProfile.packageId === draft.packageId && a.packageProfile.lengthCm === draft.dimensionsCm[0] && a.packageProfile.widthCm === draft.dimensionsCm[1] && a.packageProfile.heightCm === draft.dimensionsCm[2] && a.packageProfile.weightKg === draft.weightKg && a.custodian === draft.sourceCustodian && a.position === draft.sourcePosition && destination === draft.destination && endpoint.active, 'Shipment source, verified packaging or destination changed.');
            assert(compatible(get(s.equipment, r.equipmentId, orgId), a) && ready(a) && a.custodian === 'CESCo' && !a.requestId, 'Spare availability changed.');
            assert(r.fulfillment.spareId === draft.spareId && r.fulfillment.serviceLevel === draft.serviceLevel && r.fulfillment.destination === draft.destination && r.fulfillment.totalCents === r.fulfillment.handlingCents + r.fulfillment.shippingCents, 'Fulfillment terms changed; prepare a fresh offer.');
            const agreement = get(s.rates, r.fulfillment.handlingRateId, orgId);
            assert(agreement.active && !!agreement.approvedAt && agreement.version === r.fulfillment.termsVersion && agreement.cents === r.fulfillment.handlingCents, 'Standing handling agreement changed; refresh the fulfillment offer.');
            assert(draft.reviewedBy !== u.email, 'Release authorization requires an independent operator.');
            draft.state = 'RELEASE_AUTHORIZED';
            draft.releaseAuthorizedAt = now();
            draft.releaseAuthorizedBy = u.email;
            entityId = r.id;
            log(s, u, orgId, 'SHIPMENT_RELEASE_AUTHORIZED', r.id, JSON.stringify({preparationId:draft.id, reviewedBy:draft.reviewedBy, authorizedBy:u.email}));
            break;
        }
        case 'withdrawFulfillment': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.type === 'RECOVERY' && r.status === 'FULFILLMENT_OFFER' && r.fulfillment, 'Only an unconfirmed fulfillment offer can be withdrawn.');
            assert(!r.fulfillment.confirmedAt && !r.authorizedAt && !r.spareId, 'Cannot withdraw an authorized or allocated fulfillment.');
            const reason = str(p.reason, 'Withdrawal reason', 500);
            const previous = structuredClone(r.fulfillment);
            log(s, u, orgId, 'FULFILLMENT_OFFER_WITHDRAWN', r.id, JSON.stringify({ reason, offer: previous }));
            r.fulfillment = undefined;
            r.shipmentPreparation = undefined;
            r.status = 'REQUESTED';
            entityId = r.id;
            break;
        }
        case 'confirmFulfillment': {
            requireCap(u, orgId, 'authorize');
            const r = get(s.requests, p.id, orgId);
            assert(r.type === 'RECOVERY' && r.status === 'FULFILLMENT_OFFER' && r.fulfillment, 'An active fulfillment offer is required.');
            const offer = r.fulfillment;
            assert(offer.offerMode !== 'SIMULATED', 'Simulated offers cannot authorize shipment.');
            const spare = get(s.equipment, offer.spareId, orgId);
            const source = get(s.equipment, r.equipmentId, orgId);
            const rate = get(s.rates, offer.handlingRateId, orgId);
            assert(compatible(source, spare) && ready(spare) && spare.custodian === 'CESCo' && !spare.requestId, 'Offered spare is no longer available; refresh the fulfillment offer.');
            assert(rate.active && !!rate.approvedAt && rate.version === offer.termsVersion && rate.cents === offer.handlingCents, 'Standing handling agreement changed; refresh the offer.');
            const destinationEndpoint = get(s.endpoints, r.endpointId, orgId);
            const destination = [destinationEndpoint.name, destinationEndpoint.addressLine1, destinationEndpoint.addressLine2, destinationEndpoint.city, destinationEndpoint.state, destinationEndpoint.postalCode, destinationEndpoint.country].filter(Boolean).join(', ');
            assert(destinationEndpoint.active && destination === offer.destination, 'Delivery destination changed; refresh the offer.');
            offer.confirmedAt = now();
            offer.confirmedBy = u.id;
            r.authorizedAt = offer.confirmedAt;
            r.authorizedBy = u.id;
            r.ceiling = offer.totalCents;
            r.termsVersion = offer.termsVersion;
            r.status = 'AUTHORIZED';
            entityId = r.id;
            log(s, u, orgId, 'FULFILLMENT_CONFIRMED', r.id, JSON.stringify({ spareId: offer.spareId, totalCents: offer.totalCents, serviceLevel: offer.serviceLevel, destination, shippingSource: offer.shippingSource }));
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
            if (r.fulfillment) assert(r.fulfillment.confirmedAt && r.fulfillment.spareId === a.id, 'Reserve only the client-confirmed spare.');
            assert(compatible(source, a) && ready(a) && a.custodian === 'CESCo' && !a.requestId, 'Spare must be compatible, verified, current, and available.');
            a.status = 'RESERVED';
            a.requestId = r.id;
            source.requestId = r.id;
            r.spareId = a.id;
            r.status = 'RESERVED';
            operationalEvent(s, u, orgId, r.id, a.id, 'SPARE_RESERVED', '', source.id);
            entityId = r.id;
            break;
        }
        case 'pickPack': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.fulfillment?.offerMode === 'LIVE' && r.status === 'RESERVED' && r.spareId, 'Pick and pack requires a reserved live fulfillment.');
            assert(!r.pickPack, 'Pick and pack already recorded. Correct through a controlled revision.');
            const draft = r.shipmentPreparation;
            assert(draft?.state === 'RELEASE_AUTHORIZED' && draft.spareId === r.spareId, 'Shipment release must be authorized before picking.');
            const a = get(s.equipment, r.spareId, orgId);
            assert(a.status === 'RESERVED' && a.requestId === r.id && a.custodian === 'CESCo', 'Reserved spare is no longer in CESCo custody.');
            assert(a.position === draft.sourcePosition && a.packageProfile?.updatedAt === draft.packageRevisionAt && a.packageProfile?.packageId === draft.packageId && a.packageProfile?.measurementStatus === 'CESCO_VERIFIED', 'Package or stocking position changed; review shipment again.');
            const observedSerial = str(p.observedSerial, 'Observed equipment serial', 200);
            assert(observedSerial === a.serial, 'Observed equipment serial does not match reserved spare.');
            const packageId = str(p.packageId, 'Observed package identifier', 200);
            assert(packageId === draft.packageId, 'Observed package does not match the reviewed shipment.');
            const stagingLocation = str(p.stagingLocation, 'Physical staging location', 200);
            const condition = str(p.condition, 'Package and equipment condition', 500);
            const evidenceReference = str(p.evidenceReference, 'Pick and pack evidence reference', 500);
            r.pickPack = { at: now(), actor: u.email, observedSerial, packageId, packageRevisionAt: draft.packageRevisionAt, sourcePosition: a.position, stagingLocation, condition, evidenceReference };
            entityId = r.id;
            log(s, u, orgId, 'SHIPMENT_PICK_PACK_RECORDED', r.id, JSON.stringify(r.pickPack));
            break;
        }
        case 'recordShippingLabel': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'RESERVED' && r.fulfillment?.offerMode === 'LIVE' && r.shipmentPreparation?.state === 'RELEASE_AUTHORIZED' && r.pickPack, 'Pick and pack and release authorization are required before recording a label.');
            assert(!r.shippingLabel, 'A shipping label is already recorded; use a controlled correction workflow.');
            const draft = r.shipmentPreparation;
            const a = get(s.equipment, r.spareId, orgId);
            assert(a.status === 'RESERVED' && a.custodian === 'CESCo' && a.requestId === r.id && a.packageProfile?.updatedAt === draft.packageRevisionAt && a.position === draft.sourcePosition, 'Reserved equipment or packaging changed.');
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
            assert(endpoint.active && destination === draft.destination && r.fulfillment.destination === draft.destination, 'Delivery destination changed.');
            const carrier = str(p.carrier, 'Carrier', 100);
            const service = str(p.service, 'Carrier service', 200);
            assert(service === draft.serviceLevel, 'Carrier service differs from authorized shipment.');
            const tracking = str(p.tracking, 'Tracking reference', 200);
            const labelReference = str(p.labelReference, 'Carrier label reference', 300);
            const rateReference = str(p.rateReference, 'Carrier rate provenance', 300);
            r.shippingLabel = { at: now(), actor: u.email, carrier, service, tracking, labelReference, rateReference, destination, packageRevisionAt: draft.packageRevisionAt };
            entityId = r.id;
            log(s, u, orgId, 'SHIPMENT_LABEL_RECORDED', r.id, JSON.stringify(r.shippingLabel));
            break;
        }
        case 'markTenderReady': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'RESERVED' && r.pickPack && r.shippingLabel && r.shipmentPreparation?.state === 'RELEASE_AUTHORIZED', 'Pick, pack, label, and release authorization are required.');
            assert(!r.tenderReady, 'Tender readiness already recorded.');
            const a = get(s.equipment, r.spareId, orgId), draft = r.shipmentPreparation;
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
            assert(a.status === 'RESERVED' && a.custodian === 'CESCo' && a.requestId === r.id && a.position === draft.sourcePosition && a.packageProfile?.updatedAt === draft.packageRevisionAt && r.pickPack.packageRevisionAt === draft.packageRevisionAt && r.shippingLabel.packageRevisionAt === draft.packageRevisionAt, 'Packaging or reserved equipment changed after review.');
            assert(endpoint.active && destination === draft.destination && r.shippingLabel.destination === destination, 'Shipment label destination changed.');
            assert(str(p.observedTracking, 'Observed printed label tracking', 200) === r.shippingLabel.tracking, 'Printed label tracking does not match the recorded label.');
            const evidenceReference = str(p.evidenceReference, 'Ready-for-tender verification evidence', 500);
            r.tenderReady = { at: now(), actor: u.email, evidenceReference, tracking: r.shippingLabel.tracking, packageRevisionAt: draft.packageRevisionAt };
            entityId = r.id;
            log(s, u, orgId, 'SHIPMENT_TENDER_READY', r.id, JSON.stringify(r.tenderReady));
            break;
        }
        case 'dispatch': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.status === 'RESERVED' && r.spareId, 'Reserve a spare first.');
            const a = get(s.equipment, r.spareId, orgId);
            assert(a.testDue && new Date(a.testDue) > new Date(), 'Readiness test expired; retest before dispatch.');
            if (r.fulfillment) {
                const draft = r.shipmentPreparation;
                assert(draft?.state === 'RELEASE_AUTHORIZED' && draft.offerMode === 'LIVE' && r.fulfillment.offerMode === 'LIVE', 'Shipment release authorization is required before dispatch.');
                const label = r.shippingLabel, tender = r.tenderReady;
                assert(label && tender && label.tracking === tender.tracking && label.packageRevisionAt === tender.packageRevisionAt, 'Recorded shipping label and tender readiness are required before carrier acceptance.');
                assert(str(p.tracking, 'Accepted package tracking', 200) === label.tracking, 'Accepted tracking does not match the shipping label.');
                const acceptedBy = str(p.acceptedBy, 'Carrier acceptance representative', 200);
                const evidenceId = str(p.evidenceId, 'Carrier acceptance evidence ID', 200);
                const proof = get(s.evidence, evidenceId, orgId);
                assert(proof.entityId === r.id && ['DISPATCH', 'RECEIPT'].includes(proof.category || ''), 'Carrier acceptance requires uploaded dispatch or receipt evidence attached to this request.');
                assert(str(p.custodian, 'Accepting carrier / technician', 200) === label.carrier, 'Accepting carrier must match recorded shipping label.');
                const pick = r.pickPack;
                assert(pick && pick.observedSerial === a.serial && pick.packageId === draft.packageId && pick.packageRevisionAt === draft.packageRevisionAt && pick.sourcePosition === a.position && a.status === 'RESERVED' && a.custodian === 'CESCo', 'Verified pick and pack is required before carrier handoff.');
                const profile = a.packageProfile;
                const endpoint = get(s.endpoints, r.endpointId, orgId);
                const destination = [endpoint.name, endpoint.addressLine1, endpoint.addressLine2, endpoint.city, endpoint.state, endpoint.postalCode, endpoint.country].filter(Boolean).join(', ');
                const rate = get(s.rates, r.fulfillment.handlingRateId, orgId);
                assert(endpoint.active && destination === draft.destination && r.fulfillment.destination === draft.destination && draft.destinationEndpointId === endpoint.id, 'Shipment destination changed; reauthorize release.');
                assert(profile?.measurementStatus === 'CESCO_VERIFIED' && profile.updatedAt === draft.packageRevisionAt && profile.packageId === draft.packageId && profile.lengthCm === draft.dimensionsCm[0] && profile.widthCm === draft.dimensionsCm[1] && profile.heightCm === draft.dimensionsCm[2] && profile.weightKg === draft.weightKg, 'Shipment packaging changed; reauthorize release.');
                assert(a.position === draft.sourcePosition && draft.sourceCustodian === 'CESCo' && r.fulfillment.spareId === a.id && r.fulfillment.serviceLevel === draft.serviceLevel, 'Shipment stock or fulfillment terms changed; reauthorize release.');
                assert(rate.active && !!rate.approvedAt && rate.version === r.fulfillment.termsVersion && rate.cents === r.fulfillment.handlingCents && r.fulfillment.totalCents === r.fulfillment.handlingCents + r.fulfillment.shippingCents, 'Standing handling agreement or fulfillment price changed; reauthorize release.');
            }
            if (r.fulfillment) {
                r.carrierHandoff = { at: now(), actor: u.email, acceptedBy: str(p.acceptedBy, 'Carrier acceptance representative', 200), proofReference: get(s.evidence, str(p.evidenceId, 'Carrier acceptance evidence ID'), orgId).name, evidenceId: str(p.evidenceId, 'Carrier acceptance evidence ID'), evidenceSha256: get(s.evidence, str(p.evidenceId, 'Carrier acceptance evidence ID'), orgId).sha256, tracking: r.shippingLabel!.tracking };
                log(s, u, orgId, 'CARRIER_ACCEPTANCE_RECORDED', r.id, JSON.stringify(r.carrierHandoff));
            }
            r.tracking = str(p.tracking, 'Shipment / handoff reference');
            r.etaHours = num(p.etaHours, 'Delivery and installation estimate', .1, 8760);
            r.status = 'DISPATCHED';
            r.workOrder = `WO-${s.intakes.filter(x => x.workOrder).length + s.requests.filter(x => x.workOrder).length + 1}`;
            a.status = 'OUTBOUND';
            a.custodian = str(p.custodian, 'Carrier / technician');
            a.location = 'In transit to endpoint';
            operationalEvent(s, u, orgId, r.id, a.id, 'SPARE_DISPATCHED', r.tracking, r.equipmentId);
            entityId = r.id;
            break;
        }
        case 'deliver': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.type === 'RECOVERY' && r.status === 'DISPATCHED' && r.spareId, 'A dispatched recovery shipment is required.');
            const spare = get(s.equipment, r.spareId, orgId);
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            assert(spare.status === 'OUTBOUND', 'Replacement is not in transit.');
            const recipient = str(p.recipient, 'Delivery recipient', 200);
            const reference = str(p.reference, 'Carrier proof of delivery reference', 500);
            const notes = str(p.notes, 'Delivery observation', 500);
            r.deliveryReceipt = { at: now(), actor: u.email, recipient, reference, notes };
            spare.status = 'DELIVERED_PENDING_INSTALLATION';
            spare.location = endpoint.name;
            spare.position = '';
            spare.custodian = 'Client';
            r.status = 'DELIVERED';
            log(s, u, orgId, 'CARRIER_DELIVERY_RECORDED', r.id, JSON.stringify(r.deliveryReceipt));
            operationalEvent(s, u, orgId, r.id, spare.id, 'DELIVERY_RECORDED', reference, r.equipmentId);
            entityId = r.id;
            break;
        }
        case 'confirmInstallation': {
            requireCap(u, orgId, 'operate');
            const r = get(s.requests, p.id, orgId);
            assert(r.type === 'RECOVERY' && r.status === 'DELIVERED' && r.spareId && r.deliveryReceipt, 'Carrier delivery must be recorded before installation confirmation.');
            assert(!r.installation, 'Installation already confirmed.');
            const spare = get(s.equipment, r.spareId, orgId);
            assert(spare.status === 'DELIVERED_PENDING_INSTALLATION' && spare.custodian === 'Client' && spare.purpose === 'SPARE', 'Delivered replacement is not awaiting installation.');
            const technician = str(p.technician, 'Installation technician / confirming representative', 200);
            const notes = str(p.notes, 'Installation and functional validation result', 1000);
            const evidenceId = str(p.evidenceId, 'Installation evidence ID', 200);
            const proof = get(s.evidence, evidenceId, orgId);
            assert(proof.entityId === r.id && ['INSTALLATION_AFTER', 'TEST_RESULT'].includes(proof.category || ''), 'Installation confirmation requires uploaded installation or functional test evidence attached to this request.');
            const failed = get(s.equipment, r.equipmentId, orgId);
            const endpoint = get(s.endpoints, r.endpointId, orgId);
            spare.status = 'INSTALLED';
            spare.purpose = 'SUPPORTED';
            spare.endpointId = endpoint.id;
            spare.location = endpoint.name;
            failed.purpose = 'SPARE';
            failed.status = 'RETURN_PENDING';
            failed.endpointId = null;
            r.installation = { at: now(), actor: u.email, technician, evidenceId, evidenceSha256: proof.sha256, notes };
            r.status = 'INSTALLED';
            log(s, u, orgId, 'INSTALLATION_CONFIRMED', r.id, JSON.stringify(r.installation));
            operationalEvent(s, u, orgId, r.id, spare.id, 'INSTALLATION_CONFIRMED', evidenceId, failed.id);
            entityId = r.id;
            break;
        }
        case 'authorizeFailedReturn': {
            requireCap(u,orgId,'operate');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && ['INSTALLED','COMPLETED'].includes(r.status) && r.installation,'Verified installation is required before initiating failed-equipment return.');
            assert(!r.failedReturn?.authorization,'Failed-unit return already authorized.');
            const failed=get(s.equipment,r.equipmentId,orgId);
            assert(failed.status==='RETURN_PENDING' && failed.custodian==='Client','Failed equipment is not awaiting client return.');
            const reference=str(p.reference,'Return authorization / RMA',200);
            const destination=str(p.destination,'Authorized return destination',300);
            const instructions=str(p.instructions,'Return packaging and custody instructions',500);
            r.failedReturn={authorization:{at:now(),actor:u.email,reference,destination,instructions}};
            log(s,u,orgId,'FAILED_RETURN_AUTHORIZED',r.id,JSON.stringify(r.failedReturn.authorization));
            entityId=r.id;
            break;
        }
        case 'recordFailedReturnShipment': {
            requireCap(u,orgId,'operate');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && ['INSTALLED','COMPLETED'].includes(r.status) && r.failedReturn?.authorization,'Authorize the failed-unit return before recording inbound shipping.');
            assert(!r.failedReturn.inbound,'Inbound shipment already recorded.');
            const failed=get(s.equipment,r.equipmentId,orgId);
            assert(failed.status==='RETURN_PENDING' && failed.custodian==='Client','Failed equipment is not pending client return.');
            const carrier=str(p.carrier,'Inbound carrier',200),tracking=str(p.tracking,'Inbound tracking number',200),shipper=str(p.shipper,'Person or party handing over shipment',200);
            r.failedReturn.inbound={at:now(),actor:u.email,carrier,tracking,shipper};
            if(r.status!=='COMPLETED') r.status='RETURNING';
            failed.status='RETURN_IN_TRANSIT';
            failed.custodian=carrier;
            failed.location='Inbound transit to CESCo';
            log(s,u,orgId,'FAILED_RETURN_SHIPMENT_RECORDED',r.id,JSON.stringify(r.failedReturn.inbound));
            entityId=r.id;
            break;
        }
        case 'return': {
            requireCap(u, orgId, 'operate');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && ['RETURNING','COMPLETED'].includes(r.status) && r.failedReturn?.authorization && r.failedReturn.inbound,'Return authorization and recorded inbound shipment are required before receipt.');
            assert(!r.failedReturn.receipt,'Failed-unit receipt already recorded.');
            const a=get(s.equipment,r.equipmentId,orgId);
            assert(a.status==='RETURN_IN_TRANSIT' && a.custodian===r.failedReturn.inbound.carrier,'Inbound unit custody does not match the recorded carrier.');
            const observedSerial=str(p.observedSerial,'Observed physical serial',200);
            assert(observedSerial===a.serial,'Observed serial does not match expected failed equipment; quarantine and open an exception.');
            const evidenceId=str(p.evidenceId,'Return receiving evidence ID',200),proof=get(s.evidence,evidenceId,orgId);
            assert([r.id,a.id].includes(proof.entityId) && ['RECEIPT','SERIAL_PHOTO','EQUIPMENT_CONDITION'].includes(proof.category || ''),'Receiving requires uploaded receipt or condition evidence linked to this request or failed equipment.');
            const condition=str(p.condition,'Observed failed-equipment condition',500);
            const location=str(p.location,'Return depot',200),position=str(p.position,'Internal position',200);
            r.failedReturn.receipt={at:now(),actor:u.email,observedSerial,condition,location,position,evidenceId,evidenceSha256:proof.sha256};
            a.status='RETURNED';
            a.condition='FAILED';
            a.custodian='CESCo';
            a.location=location;
            a.position=position;
            if(r.status!=='COMPLETED') r.status='RETURNED';
            log(s,u,orgId,'FAILED_RETURN_RECEIVED',r.id,JSON.stringify(r.failedReturn.receipt));
            operationalEvent(s,u,orgId,r.id,a.id,'FAILED_RETURN_RECEIVED',evidenceId,r.spareId);
            entityId=a.id;
            break;
        }
        case 'assessFailedUnit': {
            requireCap(u,orgId,'operate');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && r.failedReturn?.receipt,'Physical return receipt is required before technical assessment.');
            const failed=get(s.equipment,r.equipmentId,orgId);
            assert(failed.status==='RETURNED' && failed.custodian==='CESCo' && failed.condition==='FAILED','Only CESCo-held failed units in quarantine may be assessed.');
            assert(!r.technicalAssessment?.approval,'Approved assessment is locked; change in treatment requires a separately authorized amendment workflow.');
            if(r.technicalAssessment) {
                assert(r.technicalAssessment.recommendation==='HOLD','Only a HOLD assessment can be revised in this phase.');
                assert(p.expectedVersion!==undefined && Number(p.expectedVersion)===(r.technicalAssessment.version||1),'Assessment version is stale; review current findings.');
            }
            const diagnosis=str(p.diagnosis,'Diagnostic observations',1500),warranty=str(p.warranty,'Warranty or OEM eligibility',500),feasibility=str(p.feasibility,'Technical repair feasibility',500);
            const recommendation=str(p.recommendation,'Recommended treatment',30) as TechnicalAssessment['recommendation'];
            assert(['REPAIR','OEM','REPLACE','HOLD','DISPOSITION'].includes(recommendation),'Unsupported proposed treatment.');
            const estimate=(v:unknown,label:string,integer=false):number|null => {
                if(v===null || v===undefined || v==='') return null;
                return integer?cents(v,label):num(v,label,0,3650);
            };
            const estimatedCostCents=estimate(p.estimatedCostCents,'Estimated treatment cost',true),estimatedDays=estimate(p.estimatedDays,'Estimated turnaround days');
            const notes=str(p.notes,'Assessment rationale / uncertainty',1000),evidenceId=str(p.evidenceId,'Diagnostic evidence ID',200);
            const proof=get(s.evidence,evidenceId,orgId);
            assert([r.id,failed.id].includes(proof.entityId) && ['TEST_RESULT','EQUIPMENT_CONDITION','SERIAL_PHOTO'].includes(proof.category||''),'Technical assessment requires linked diagnostic or condition evidence.');
            assert(proof.id!==r.installation?.evidenceId && proof.id!==r.failedReturn.receipt.evidenceId,'Installation and receiving evidence cannot substitute for new diagnostic evidence.');
            assert(proof.at>=r.failedReturn.receipt.at,'Diagnostic evidence must be uploaded after the failed unit was received.');
            assert(![r.technicalAssessment,...(r.assessmentHistory||[])].filter(Boolean).some(a=>a?.evidenceId===proof.id),'Each assessment revision requires different diagnostic evidence.');
            const version=(r.technicalAssessment?.version||1)+(r.technicalAssessment?1:0);
            if(r.technicalAssessment) (r.assessmentHistory ||= []).push({...r.technicalAssessment,version:r.technicalAssessment.version||1});
            r.technicalAssessment={version,at:now(),actor:u.email,diagnosis,warranty,feasibility,estimatedCostCents,estimatedDays,recommendation,notes,evidenceId,evidenceSha256:proof.sha256};
            log(s,u,orgId,'FAILED_UNIT_ASSESSED',r.id,JSON.stringify(r.technicalAssessment));
            entityId=r.id;
            break;
        }
        case 'approveFailedTreatment': {
            requireCap(u,orgId,'authorize');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && r.technicalAssessment,'Technical assessment is required before a client treatment decision.');
            assert(!r.technicalAssessment.approval,'Treatment decision already recorded.');
            assert(r.technicalAssessment.recommendation!=='HOLD','Hold recommendation does not authorize a physical treatment.');
            assert(p.expectedVersion!==undefined && Number(p.expectedVersion)===(r.technicalAssessment.version||1),'Assessment version is stale; review current findings.');
            const reference=str(p.reference,'Client treatment authorization reference',200),notes=str(p.notes,'Client approval conditions',1000);
            r.technicalAssessment.approval={at:now(),actor:u.email,reference,notes,assessmentVersion:r.technicalAssessment.version||1};
            log(s,u,orgId,'FAILED_TREATMENT_AUTHORIZED',r.id,JSON.stringify(r.technicalAssessment.approval));
            entityId=r.id;
            break;
        }
        case 'openRecoveryRepair': {
            requireCap(u,orgId,'operate');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && r.failedReturn?.receipt && r.technicalAssessment?.recommendation==='REPAIR' && r.technicalAssessment.approval,'A returned failed unit and client-authorized REPAIR assessment are required.');
            assert(r.technicalAssessment.approval.assessmentVersion===(r.technicalAssessment.version||1),'Client authorization does not match the current assessment.');
            assert(!r.repairExecution,'Repair work order already opened.');
            const a=get(s.equipment,r.equipmentId,orgId);
            assert(a.status==='RETURNED' && a.condition==='FAILED' && a.custodian==='CESCo','Repair work order requires failed equipment in CESCo custody.');
            const workOrder=str(p.workOrder,'Repair work-order reference',200);
            assert(!s.requests.some(x=>x.orgId===orgId && x.repairExecution?.workOrder===workOrder),'Repair work-order reference must be unique within the account.');
            r.repairExecution={workOrder,openedAt:now(),openedBy:u.email,assessmentVersion:r.technicalAssessment.version||1,authorizationReference:r.technicalAssessment.approval.reference};
            a.status='REPAIR';
            log(s,u,orgId,'RECOVERY_REPAIR_OPENED',r.id,JSON.stringify(r.repairExecution));
            entityId=r.id;
            break;
        }
        case 'recordRecoveryRepairResult': {
            requireCap(u,orgId,'operate');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && r.repairExecution && !r.repairExecution.result,'An open, unfinished recovery repair work order is required.');
            const a=get(s.equipment,r.equipmentId,orgId);
            assert(a.status==='REPAIR' && a.condition==='FAILED' && a.custodian==='CESCo','Repair result requires failed equipment at the authorized repair bench.');
            const outcome=str(p.outcome,'Repair outcome',30) as 'SUCCESS'|'UNSUCCESSFUL';
            assert(['SUCCESS','UNSUCCESSFUL'].includes(outcome),'Unsupported repair result.');
            const notes=str(p.notes,'Work performed and findings',1500),evidenceId=str(p.evidenceId,'Repair evidence ID',200),proof=get(s.evidence,evidenceId,orgId);
            assert([r.id,a.id].includes(proof.entityId) && ['TEST_RESULT','EQUIPMENT_CONDITION'].includes(proof.category||''),'Repair result requires uploaded work evidence linked to the request or equipment.');
            assert(proof.at>=r.repairExecution.openedAt && proof.id!==r.technicalAssessment?.evidenceId,'Repair work evidence must be distinct from the assessment and uploaded after work-order creation.');
            r.repairExecution.result={at:now(),actor:u.email,outcome,notes,evidenceId,evidenceSha256:proof.sha256};
            a.status=outcome==='SUCCESS'?'REPAIRED_PENDING_TEST':'REPAIR_FAILED';
            log(s,u,orgId,'RECOVERY_REPAIR_RESULT',r.id,JSON.stringify(r.repairExecution.result));
            entityId=r.id;
            break;
        }
        case 'verifyRecoveryRepair': {
            requireCap(u,orgId,'operate');
            const r=get(s.requests,p.id,orgId);
            assert(r.type==='RECOVERY' && r.repairExecution?.result?.outcome==='SUCCESS','Successful repair record required before independent readiness verification.');
            const a=get(s.equipment,r.equipmentId,orgId);
            assert(a.status==='REPAIRED_PENDING_TEST' && a.condition==='FAILED' && a.custodian==='CESCo','Equipment is not awaiting post-repair functional verification.');
            assert(u.email!==r.repairExecution.result.actor,'Independent readiness verification requires a different operator from the repair-result recorder.');
            assert(str(p.configuration,'Verified configuration')===a.configuration,'Configuration must match the approved profile.');
            const days=num(p.validDays,'Test validity days',1,3650),notes=str(p.notes,'Independent functional verification',1500);
            const evidenceId=str(p.evidenceId,'Post-repair test evidence ID',200),proof=get(s.evidence,evidenceId,orgId);
            assert([r.id,a.id].includes(proof.entityId) && proof.category==='TEST_RESULT','Readiness verification requires linked functional TEST_RESULT evidence.');
            assert(proof.id!==r.repairExecution.result.evidenceId && proof.at>=r.repairExecution.result.at,'Post-repair testing requires new evidence after the repair result.');
            a.condition='GOOD';a.status='READY';a.testedAt=now();a.testDue=new Date(Date.now()+days*86400000).toISOString();
            log(s,u,orgId,'RECOVERY_READINESS_VERIFIED',a.id,JSON.stringify({notes,evidenceId,sha256:proof.sha256,repairWorkOrder:r.repairExecution.workOrder}));
            entityId=a.id;
            break;
        }
        case 'repair': {
            requireCap(u,orgId,'operate');
            const a=get(s.equipment,p.id,orgId);
            assert(['RETURNED','RECEIVED','EXCEPTION','REPAIR','OEM_OUT'].includes(a.status),'Equipment cannot enter repair from this state.');
            const recovery=a.requestId?s.requests.find(r=>r.id===a.requestId&&r.orgId===orgId&&r.type==='RECOVERY'&&!!r.failedReturn?.receipt):undefined;
            assert(!recovery,'Recovery returns require a separate authorized repair work order and evidence-backed repair result.');
            const notes=str(p.notes,'Repair result / exception resolution');
            a.status='REPAIR';a.condition='GOOD';
            log(s,u,orgId,'LEGACY_REPAIR_RECORDED',a.id,notes);
            entityId=a.id;
            break;
        }
        case 'restock': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(a.status === 'READY' && a.purpose === 'SUPPORTED', 'Repair and test returned equipment first.');
            a.purpose = 'SPARE';
            a.endpointId = null;
            if (a.requestId) operationalEvent(s, u, orgId, a.requestId, a.id, 'SPARE_REPLENISHED', a.location);
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
            assert(['INSTALLED', 'RETURNING', 'RETURNED', 'RECEIVED', 'DELIVERED'].includes(r.status), 'Request is not ready to complete.');
            assert(r.type !== 'RECOVERY' || (r.installation && ['INSTALLED','RETURNING','RETURNED'].includes(r.status)), 'Recovery completion requires verified installation; failed-unit return and spare replenishment remain separate obligations.');
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
            const r: Rate = { id: id(), orgId, name: str(p.name, 'Service name', 200), category: str(p.category, 'Category', 100), unit: normalizeRateUnit(str(p.unit, 'Pricing unit', 100)), cents: cents(p.cents, 'Unit price'), version: str(p.version, 'Agreement version', 200), active: true, approvedBy: null, approvedAt: null };
            assert(['RECEIVING', 'LABOR', 'PART', 'DISPATCH', 'SHIPPING', 'TESTING', 'STORAGE', 'SLA', 'DISPOSITION'].includes(r.category), 'Unknown rate category.');
            s.rates.push(r);
            entityId = r.id;
            break;
        }
        case 'editDraftRate': {
            requireCap(u, orgId, 'rates');
            const rate = get(s.rates, p.id, orgId);
            assert(rate.active && !rate.approvedAt, 'Only active, unapproved draft rates may be edited.');
            const old = { name: rate.name, category: rate.category, unit: rate.unit, cents: rate.cents, version: rate.version };
            const category = str(p.category, 'Category', 100);
            assert(['RECEIVING', 'LABOR', 'PART', 'DISPATCH', 'SHIPPING', 'TESTING', 'STORAGE', 'SLA', 'DISPOSITION'].includes(category), 'Unknown rate category.');
            rate.name = str(p.name, 'Service name', 200);
            rate.category = category;
            rate.unit = normalizeRateUnit(str(p.unit, 'Pricing unit', 100));
            rate.cents = cents(p.cents, 'Unit price');
            rate.version = str(p.version, 'Agreement version', 200);
            entityId = rate.id;
            log(s, u, orgId, 'DRAFT_RATE_REVISED', rate.id, JSON.stringify({ before: old, after: { name: rate.name, category: rate.category, unit: rate.unit, cents: rate.cents, version: rate.version } }));
            break;
        }
        case 'withdrawRate': {
            requireCap(u, orgId, 'rates');
            const rate = get(s.rates, p.id, orgId);
            assert(rate.active && !rate.approvedAt, 'Only active, unapproved draft rates can be withdrawn.');
            const reason = str(p.reason, 'Withdrawal reason', 500);
            rate.active = false;
            entityId = rate.id;
            log(s, u, orgId, 'DRAFT_RATE_WITHDRAWN', rate.id, reason);
            break;
        }
        case 'retireRate': {
            requireCap(u, orgId, 'rates');
            const rate = get(s.rates, p.id, orgId);
            assert(rate.active && !!rate.approvedAt, 'Only an active approved rate can be retired.');
            const reason = str(p.reason, 'Retirement reason', 500);
            rate.active = false;
            entityId = rate.id;
            log(s, u, orgId, 'APPROVED_RATE_RETIRED', rate.id, reason);
            break;
        }
        case 'approveRate': {
            requireCap(u, orgId, 'authorize');
            const rate = get(s.rates, p.id, orgId);
            assert(rate.active && !rate.approvedAt, 'Only an active draft rate can be approved.');
            rate.approvedBy = u.id;
            rate.approvedAt = now();
            entityId = rate.id;
            log(s, u, orgId, 'RATE_AUTHORIZATION', rate.id, `${rate.name}; ${rate.cents} cents / ${rate.unit}; ${rate.version}`);
            break;
        }
        case 'setPackageProfile': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(!s.requests.some(r => r.orgId === orgId && r.shipmentPreparation?.spareId === a.id && r.shipmentPreparation.state === 'RELEASE_AUTHORIZED'), 'Cannot alter package after shipment release authorization.');
            assert(a.purpose === 'SPARE' && a.custodian === 'CESCo' && ['READY', 'RECEIVED'].includes(a.status) && !a.requestId, 'Package profiles require unallocated CESCo-held spares.');
            const previous = a.packageProfile ? structuredClone(a.packageProfile) : null;
            const packageId = str(p.packageId, 'Package identifier', 100);
            const packaging = str(p.packaging, 'Packaging description', 200);
            const lengthCm = num(p.lengthCm, 'Package length (cm)', 0.1, 300);
            const widthCm = num(p.widthCm, 'Package width (cm)', 0.1, 300);
            const heightCm = num(p.heightCm, 'Package height (cm)', 0.1, 300);
            const weightKg = num(p.weightKg, 'Packed weight (kg)', 0.01, 1000);
            const measurementStatus = String(p.measurementStatus || 'LEGACY_UNVERIFIED');
            assert(['SIMULATED', 'CUSTOMER_DECLARED', 'CESCO_VERIFIED', 'LEGACY_UNVERIFIED'].includes(measurementStatus), 'Choose a supported measurement status.');
            const enteredUnit = String(p.enteredUnit || 'METRIC');
            assert(['METRIC', 'US'].includes(enteredUnit), 'Choose a supported measurement unit.');
            const enteredMeasurements = p.enteredMeasurements && typeof p.enteredMeasurements === 'object' ? p.enteredMeasurements as Record<string, unknown> : { length: lengthCm, width: widthCm, height: heightCm, weight: weightKg };
            const original = { length: Number(enteredMeasurements.length), width: Number(enteredMeasurements.width), height: Number(enteredMeasurements.height), weight: Number(enteredMeasurements.weight) };
            assert(Object.values(original).every(v => Number.isFinite(v) && v > 0), 'Original measurements must be positive finite numbers.');
            assert(!s.equipment.some(e => e.orgId === orgId && e.id !== a.id && e.packageProfile?.packageId === packageId), 'Package identifier already belongs to another equipment record.');
            a.packageProfile = { packageId, packaging, lengthCm, widthCm, heightCm, weightKg, measurementStatus: measurementStatus as NonNullable<typeof a.packageProfile>['measurementStatus'], enteredUnit: enteredUnit as 'METRIC' | 'US', enteredMeasurements: original, updatedAt: now(), updatedBy: u.email };
            for (const request of s.requests.filter(r => r.orgId === orgId && r.shipmentPreparation?.spareId === a.id && ['DRAFT', 'REVIEWED'].includes(r.shipmentPreparation.state))) {
                const preparation = request.shipmentPreparation!;
                const originalState = preparation.state;
                preparation.state = 'STALE';
                log(s, u, orgId, 'SHIPMENT_PREPARATION_STALE', request.id, JSON.stringify({ preparationId: preparation.id, originalState, reason: 'Spare package or stocking position updated', equipmentId: a.id }));
            }
            entityId = a.id;
            log(s, u, orgId, 'PACKAGE_PROFILE_RECORDED', a.id, JSON.stringify({ previous, current: a.packageProfile }));
            break;
        }
        case 'move': {
            requireCap(u, orgId, 'operate');
            const a = get(s.equipment, p.id, orgId);
            assert(['READY', 'RECEIVED', 'REPAIR'].includes(a.status) && a.custodian === 'CESCo', 'Only unreserved CESCo-held inventory can be repositioned.');
            assert(!s.requests.some(r => r.orgId === orgId && r.shipmentPreparation?.spareId === a.id && r.shipmentPreparation.state === 'RELEASE_AUTHORIZED'), 'Cannot reposition stock after shipment release authorization.');
            const before = a.location;
            a.location = str(p.location, 'New hub / stocking location');
            a.position = str(p.position, 'Internal position');
            for (const request of s.requests.filter(r => r.orgId === orgId && r.shipmentPreparation?.spareId === a.id && ['DRAFT', 'REVIEWED'].includes(r.shipmentPreparation.state))) {
                const preparation = request.shipmentPreparation!;
                const originalState = preparation.state;
                preparation.state = 'STALE';
                log(s, u, orgId, 'SHIPMENT_PREPARATION_STALE', request.id, JSON.stringify({ preparationId: preparation.id, originalState, reason: 'Spare package or stocking position updated', equipmentId: a.id }));
            }
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
export function scoped(s: State, u: User, orgId: string) { requireCap(u, orgId, 'view'); const bill = allowed(u, orgId, 'billing'); return { plans: s.plans.filter(x => x.orgId === orgId), organization: s.organizations.find(x => x.id === orgId), organizations: isInternal(u) ? s.organizations : s.organizations.filter(x => x.id === u.orgId), user: { id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.orgId }, endpoints: s.endpoints.filter(x => x.orgId === orgId), equipment: s.equipment.filter(x => x.orgId === orgId).map(x => ({ ...x, position: isInternal(u) ? x.position : 'Managed by CESCo' })), intakes: s.intakes.filter(x => x.orgId === orgId), requests: s.requests.filter(x => x.orgId === orgId), rates: (bill || isInternal(u)) ? s.rates.filter(x => x.orgId === orgId) : [], activities: (bill || isInternal(u)) ? s.activities.filter(x => x.orgId === orgId).map(x => ({ ...x, costCents: isInternal(u) ? x.costCents : 0 })) : [], invoices: bill ? s.invoices.filter(x => x.orgId === orgId).map(x => ({ ...x, balance: balance(s, x) })) : [], settlements: bill ? s.settlements.filter(x => x.orgId === orgId) : [], credit: bill ? creditBalance(s, orgId) : 0, audit: s.audit.filter(x => x.orgId === orgId), operationalEvents: (s.operationalEvents || []).filter(x => x.orgId === orgId), imports: s.imports.filter(x => x.orgId === orgId).map(({ csv, ...x }) => ({ ...x, headers: csv ? parseCsv(csv)[0] : [], sample: csv ? rowsToObjects(parseCsv(csv)).slice(0, 5).map(x => x.record) : [] })), evidence: s.evidence.filter(x => x.orgId === orgId).map(({ key, ...x }) => x), team: s.users.filter(x => x.orgId === orgId).map(({ password, ...x }) => x) }; }
