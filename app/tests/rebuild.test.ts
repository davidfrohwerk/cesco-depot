import { operationsMetrics, metricContractVersion } from '../src/lib/operations-metrics.ts';
import test from 'node:test';
import { inferMapping } from '../src/lib/import-mapping.ts';
import { validateEvidenceCategory } from '../src/lib/evidence-categories.ts';
import assert from 'node:assert/strict';
import { emptyState, id, mutate, previewImport, previewEnrichment, validateCorrectionEvidenceLink, balance, creditBalance, scoped, type State, type User } from '../src/lib/domain.ts';
function fixture() { const s = emptyState(); s.organizations.push({ id: 'acme', name: 'Acme', termsDays: 30, currency: 'USD' }, { id: 'other', name: 'Other', termsDays: 0, currency: 'USD' }); const admin: User = { id: 'ops', orgId: 'internal', name: 'Ops', email: 'ops@example.com', password: '', role: 'SYSTEM_ADMIN' }; const client: User = { id: 'client', orgId: 'acme', name: 'Client', email: 'client@example.com', password: '', role: 'CLIENT_ADMIN' }; s.users.push(admin, client); return { s, admin, client }; }
function importCsv(s: State, u: User, kind: string, csv: string) { const job = mutate(s, u, 'acme', 'importPreview', { kind, csv }); mutate(s, u, 'acme', 'importCommit', { id: job }); }
function basic() { const f = fixture(); importCsv(f.s, f.client, 'endpoints', 'externalId,name,addressLine1\nIND,Indy,Indianapolis IN'); importCsv(f.s, f.client, 'equipment', 'externalId,manufacturer,model,serial,configuration,pool,purpose,endpointId,volume,recoveryTargetHours\nR1,OEM,X,001,v1,routers,SUPPORTED,IND,0,4\nS1,OEM,X,002,v1,routers,SPARE,,1,'); return f; }
function receive(f: ReturnType<typeof basic>) { const { s, admin, client } = f; const a = s.equipment[1]; const intake = mutate(s, client, 'acme', 'intake', { assetIds: [a.id], notes: 'Router continuity spares' }); mutate(s, admin, 'acme', 'acceptIntake', { id: intake, tracking: 'carrier-proof' }); mutate(s, admin, 'acme', 'receive', { id: a.id, serial: a.serial, condition: 'GOOD', location: 'Indianapolis hub', position: 'A-1' }); mutate(s, admin, 'acme', 'verify', { id: a.id, configuration: 'v1', validDays: 30, notes: 'Boot and configuration test passed' }); return intake; }
function authorize(f: ReturnType<typeof basic>, type = 'RECOVERY') { const { s, admin, client } = f; const rid = mutate(s, client, 'acme', 'request', { equipmentId: s.equipment[0].id, type, scope: 'Restore endpoint network' }); mutate(s, admin, 'acme', 'quote', { id: rid, ceiling: 30000, termsVersion: 'Quote v1' }); mutate(s, client, 'acme', 'authorize', { id: rid }); return rid; }
function rate(f: ReturnType<typeof basic>, category = 'LABOR') { const rid = mutate(f.s, f.admin, 'acme', 'rate', { name: 'Approved service', category, unit: category === 'STORAGE' ? 'cubic foot-day' : 'hour', cents: 5000, version: 'Signed agreement A' }); mutate(f.s, f.client, 'acme', 'approveRate', { id: rid }); return rid; }
test('Acme acceptance: 100 endpoints + 1000 supported devices + 20 client-owned spares → intake → receipt → invoice', () => { const f = fixture(); const { s, admin, client } = f; importCsv(s, client, 'endpoints', 'externalId,name,addressLine1\n' + Array.from({ length: 100 }, (_, i) => `E${i},Site ${i},Address ${i}`).join('\n')); importCsv(s, client, 'equipment', 'externalId,manufacturer,model,serial,configuration,pool,purpose,endpointId,volume,recoveryTargetHours\n' + Array.from({ length: 1020 }, (_, i) => `A${i},OEM,Router,Serial${i},Branch-v1,Branch routers,${i < 1000 ? 'SUPPORTED' : 'SPARE'},${i < 1000 ? 'E' + i % 100 : ''},0.5,4`).join('\n')); assert.equal(s.endpoints.length, 100); assert.equal(s.equipment.length, 1020); assert.equal(s.intakes.length, 0); assert.equal(s.activities.length, 0); const spares = s.equipment.filter(x => x.purpose === 'SPARE'); const iid = mutate(s, client, 'acme', 'intake', { assetIds: spares.map(x => x.id), notes: '20 spares supporting 100 endpoints' }); assert.equal(s.intakes[0].workOrder, null); assert.equal(s.activities.length, 0); const rid = rate(f, 'RECEIVING'); assert.throws(() => mutate(s, admin, 'acme', 'activity', { intakeId: iid, rateId: rid, description: 'Receiving', quantity: 20 }), /acceptance/); mutate(s, admin, 'acme', 'acceptIntake', { id: iid, tracking: 'Accepted 20 units' }); for (const a of spares)
    mutate(s, admin, 'acme', 'receive', { id: a.id, serial: a.serial, condition: 'GOOD', location: 'Indy central', position: 'rack A' }); assert.equal(s.intakes[0].status, 'RECEIVED'); assert.equal(spares.filter(x => x.status === 'READY').length, 0); const aid = mutate(s, admin, 'acme', 'activity', { intakeId: iid, rateId: rid, description: '20 received and reconciled units', quantity: 20, costCents: 15000 }); assert.equal(s.activities[0].amount, 100000); mutate(s, admin, 'acme', 'review', { id: aid }); mutate(s, admin, 'acme', 'invoice', {}); assert.equal(s.invoices[0].total, 100000); assert.equal(s.invoices[0].termsDays, 30); assert.equal(s.audit.filter(x => x.action === 'RECEIPT').length, 20); });
test('bulk validation rejects unknown endpoints, duplicates, missing pool and stale imports without partial writes', () => { const f = basic(); const header = 'externalId,manufacturer,model,serial,configuration,pool,purpose,endpointId'; for (const row of ['R2,OEM,X,003,v1,routers,SUPPORTED,NOPE', 'R2,OEM,X,001,v1,routers,SUPPORTED,IND', 'R2,OEM,X,003,v1,other,SPARE,'])
    assert.ok(previewImport(f.s, 'acme', 'equipment', header + '\n' + row).errors.length); const csv = 'externalId,name,addressLine1\nNEW,New,Indy'; const j1 = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'endpoints', csv }); const j2 = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'endpoints', csv }); mutate(f.s, f.client, 'acme', 'importCommit', { id: j1 }); assert.throws(() => mutate(f.s, f.client, 'acme', 'importCommit', { id: j2 }), /already exists/); assert.equal(f.s.endpoints.filter(x => x.externalId === 'NEW').length, 1); });
test('manufacturer+serial identity is account scoped, not globally unique', () => { const f = basic(); const u = { ...f.client, orgId: 'other' }; importCsv(f.s, f.client, 'endpoints', 'externalId,name,addressLine1\nOTH,Other,Indy'); const csv = 'externalId,manufacturer,model,serial,configuration,pool,purpose,endpointId\nO1,OEM,X,001,v1,routers,SUPPORTED,OTH'; assert.equal(previewImport(f.s, 'acme', 'equipment', csv).errors.length, 1); f.s.endpoints.push({ id: id(), orgId: 'other', externalId: 'OTH', name: 'Other', siteType: '', addressLine1: 'Indy', addressLine2: '', city: '', state: '', postalCode: '', country: '', market: '', contactName: '', contactEmail: '', contactPhone: '', accessNotes: '', active: true }); const j = mutate(f.s, u, 'other', 'importPreview', { kind: 'equipment', csv }); mutate(f.s, u, 'other', 'importCommit', { id: j }); assert.equal(f.s.equipment.filter(x => x.serial === '001').length, 2); });
test('receiving mismatch creates an exception, never available readiness', () => { const f = basic(); const a = f.s.equipment[1]; const iid = mutate(f.s, f.client, 'acme', 'intake', { assetIds: [a.id], notes: 'spare' }); mutate(f.s, f.admin, 'acme', 'acceptIntake', { id: iid, tracking: 'ref' }); mutate(f.s, f.admin, 'acme', 'receive', { id: a.id, serial: 'different', condition: 'GOOD', location: 'Indy', position: 'A' }); assert.equal(a.status, 'EXCEPTION'); assert.equal(f.s.intakes[0].status, 'EXCEPTION'); assert.throws(() => mutate(f.s, f.admin, 'acme', 'verify', { id: a.id, configuration: 'v1', validDays: 30, notes: 'test' }), /Receive or repair/); });
test('recovery: authenticated ceiling, compatible reservation, single allocation, dispatch, delivery, failed return and restock', () => { const f = basic(); const { s, admin } = f; receive(f); const rid = authorize(f); const spare = s.equipment[1]; mutate(s, admin, 'acme', 'reserve', { id: rid, spareId: spare.id }); const second = authorize(f); assert.throws(() => mutate(s, admin, 'acme', 'reserve', { id: second, spareId: spare.id }), /available/); mutate(s, admin, 'acme', 'dispatch', { id: rid, tracking: 'dispatch-1', custodian: 'Courier', etaHours: 2 }); assert.ok(s.requests[0].workOrder); mutate(s, admin, 'acme', 'deliver', { id: rid, notes: 'Installed with client present' }); assert.equal(spare.purpose, 'SUPPORTED'); assert.equal(spare.status, 'INSTALLED'); assert.equal(s.equipment[0].purpose, 'SPARE'); assert.equal(s.equipment[0].status, 'RETURN_PENDING'); mutate(s, admin, 'acme', 'return', { id: rid, location: 'Indy', position: 'repair bench' }); mutate(s, admin, 'acme', 'repair', { id: s.equipment[0].id, notes: 'Repaired failed PSU' }); mutate(s, admin, 'acme', 'verify', { id: s.equipment[0].id, configuration: 'v1', validDays: 30, notes: 'Full QA passed' }); mutate(s, admin, 'acme', 'complete', { id: rid, notes: 'Recovered and replenished' }); assert.equal(s.requests[0].status, 'COMPLETED'); assert.equal(s.equipment[0].status, 'READY'); });
test('unverified, expired, wrong configuration or wrong pool cannot be reserved', () => { const f = basic(); const rid = authorize(f); const a = f.s.equipment[1]; assert.throws(() => mutate(f.s, f.admin, 'acme', 'reserve', { id: rid, spareId: a.id }), /verified/); receive(f); a.configuration = 'v2'; assert.throws(() => mutate(f.s, f.admin, 'acme', 'reserve', { id: rid, spareId: a.id }), /compatible/); a.configuration = 'v1'; a.testDue = '2020-01-01'; assert.throws(() => mutate(f.s, f.admin, 'acme', 'reserve', { id: rid, spareId: a.id }), /current/); });
test('charges require client-approved rates and accepted work, ceiling amendment needs separate client approval', () => { const f = basic(); const iid = receive(f), rid = authorize(f); const rateId = rate(f); assert.throws(() => mutate(f.s, f.admin, 'acme', 'activity', { requestId: rid, rateId, description: 'premature work', quantity: 1 }), /work order/); mutate(f.s, f.admin, 'acme', 'reserve', { id: rid, spareId: f.s.equipment[1].id }); mutate(f.s, f.admin, 'acme', 'dispatch', { id: rid, tracking: 'd', custodian: 'Courier', etaHours: 2 }); const aid = mutate(f.s, f.admin, 'acme', 'activity', { requestId: rid, rateId, description: 'Work performed', quantity: 5 }); assert.throws(() => mutate(f.s, f.admin, 'acme', 'activity', { requestId: rid, rateId, description: 'Additional', quantity: 2 }), /ceiling/); mutate(f.s, f.admin, 'acme', 'amendQuote', { id: rid, ceiling: 40000, termsVersion: 'v2' }); assert.throws(() => mutate(f.s, f.admin, 'acme', 'activity', { requestId: rid, rateId, description: 'Additional', quantity: 2 }), /authorized/); mutate(f.s, f.client, 'acme', 'approveAmendment', { id: rid }); assert.equal(f.s.requests[0].status, 'DISPATCHED'); mutate(f.s, f.admin, 'acme', 'activity', { requestId: rid, rateId, description: 'Additional', quantity: 2 }); const oldPrice = f.s.activities.find(x => x.id === aid)!.unitCents; f.s.rates[0].cents = 9999; assert.equal(f.s.activities[0].unitCents, oldPrice); assert.ok(iid); });
test('review, issue, payment idempotency, account credit application and refunds preserve balances', () => { const f = basic(); const iid = receive(f); const rateId = rate(f); const aid = mutate(f.s, f.admin, 'acme', 'activity', { intakeId: iid, rateId, description: 'Received', quantity: 2, costCents: 2000 }); assert.throws(() => mutate(f.s, f.admin, 'acme', 'invoice', {}), /approved/); mutate(f.s, f.admin, 'acme', 'review', { id: aid }); const invId = mutate(f.s, f.admin, 'acme', 'invoice', {}); assert.throws(() => mutate(f.s, f.admin, 'acme', 'invoice', {}), /unbilled/); mutate(f.s, f.admin, 'acme', 'settle', { kind: 'CREDIT', cents: 2500, reference: 'funding-1' }); mutate(f.s, f.admin, 'acme', 'settle', { kind: 'APPLY_CREDIT', invoiceId: invId, cents: 2500, reference: 'apply-1' }); assert.equal(creditBalance(f.s, 'acme'), 0); assert.equal(balance(f.s, f.s.invoices[0]), 7500); mutate(f.s, f.admin, 'acme', 'settle', { kind: 'PAYMENT', invoiceId: invId, cents: 7500, reference: 'provider-1' }); assert.equal(f.s.invoices[0].status, 'PAID'); assert.throws(() => mutate(f.s, f.admin, 'acme', 'settle', { kind: 'PAYMENT', invoiceId: invId, cents: 1, reference: 'provider-1' }), /already recorded/); assert.throws(() => mutate(f.s, f.admin, 'acme', 'settle', { kind: 'REFUND', invoiceId: invId, cents: 8000, reference: 'refund-too-high' }), /exceeds/); mutate(f.s, f.admin, 'acme', 'settle', { kind: 'REFUND', invoiceId: invId, cents: 1000, reference: 'refund-1' }); assert.equal(balance(f.s, f.s.invoices[0]), 1000); assert.equal(f.s.invoices[0].status, 'ISSUED'); });
test('storage periods prevent duplicate/overlapping accrual and require physical custody', () => { const f = basic(); const iid = receive(f), rateId = rate(f, 'STORAGE'); const p = { intakeId: iid, assetId: f.s.equipment[1].id, rateId, description: '1 cubic foot × 30 days', quantity: 30, periodStart: '2026-10-01', periodEnd: '2026-11-01' }; mutate(f.s, f.admin, 'acme', 'activity', p); assert.throws(() => mutate(f.s, f.admin, 'acme', 'activity', { ...p, periodStart: '2026-10-15', periodEnd: '2026-11-15' }), /already has a charge/); mutate(f.s, f.admin, 'acme', 'activity', { ...p, periodStart: '2026-11-01', periodEnd: '2026-12-01' }); });
test('tenant isolation and separation of helpdesk, operational and financial authority', () => { const f = basic(); const help: User = { ...f.client, role: 'HELPDESK' }; const ops: User = { ...f.admin, role: 'OPERATIONS' }; assert.throws(() => scoped(f.s, f.client, 'other'), /permission/); assert.throws(() => mutate(f.s, help, 'acme', 'authorize', { id: 'x' }), /permission/); assert.throws(() => mutate(f.s, help, 'acme', 'settle', { kind: 'CREDIT', cents: 10, reference: 'x' }), /permission/); assert.throws(() => mutate(f.s, ops, 'acme', 'rate', { name: 'x' }), /permission/); const view = scoped(f.s, help, 'acme'); assert.equal(view.invoices.length, 0); assert.equal(view.rates.length, 0); assert.ok(view.team.every(x => !('password' in x))); });
test('repair and OEM service require acceptance, receipt, repair and verified completion', () => { for (const type of ['REPAIR', 'OEM']) {
    const f = basic();
    const rid = authorize(f, type);
    if (type === 'REPAIR')
        mutate(f.s, f.admin, 'acme', 'acceptService', { id: rid, tracking: 'inbound' });
    else
        mutate(f.s, f.admin, 'acme', 'external', { id: rid, tracking: 'OEM-case', custodian: 'OEM vendor' });
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'complete', { id: rid }), /ready/);
    mutate(f.s, f.admin, 'acme', 'serviceReceipt', { id: rid, serial: '001', condition: 'FAILED', location: 'Indy', position: 'bench' });
    mutate(f.s, f.admin, 'acme', 'repair', { id: f.s.equipment[0].id, notes: 'repaired' });
    mutate(f.s, f.admin, 'acme', 'verify', { id: f.s.equipment[0].id, configuration: 'v1', validDays: 30, notes: 'passed QA' });
    mutate(f.s, f.admin, 'acme', 'complete', { id: rid });
    assert.equal(f.s.requests[0].status, 'COMPLETED');
} });
test('disposition is specifically authorized and does not infer ownership from storage', () => { const f = basic(); const rid = authorize(f, 'DONATION'); mutate(f.s, f.admin, 'acme', 'disposition', { id: rid, notes: 'Signed title transfer and sanitization certificate' }); assert.equal(f.s.equipment[0].status, 'DONATED'); assert.match(f.s.equipment[0].custodian, /title transferred/); assert.equal(f.s.requests[0].status, 'COMPLETED'); });
test('spares scenarios preserve supplied assumptions and never invent manufacturer rates', () => { const f = basic(); mutate(f.s, f.client, 'acme', 'plan', { pool: 'routers', configuration: 'v1', afr: .02, days: 30, level: .95, contingency: 1, source: 'Explicit conservative planning assumption', notes: 'Independent failures only; placement still needs validation' }); assert.equal(f.s.plans[0].population, 1); assert.equal(f.s.plans[0].result.total, 1); assert.match(f.s.plans[0].source, /assumption/); assert.throws(() => mutate(f.s, f.client, 'acme', 'plan', { pool: 'routers', configuration: 'v1', afr: 2, days: 30, level: .95, contingency: 0, source: 'x', notes: 'x' }), /probability/); });


test('realistic endpoint imports do not require recovery targets', () => {
    const f = fixture();
    const csv = 'STORE NUMBER,STORE NAME,LOCATION TYPE,STREET,SUITE,CITY,STATE,ZIP,COUNTRY,MARKET,CONTACT,EMAIL,PHONE,NOTES,ENABLED\nSTORE-101,ACME Store 101,STORE,123 Main St,,Indianapolis,IN,46201,US,Indianapolis East,Jordan Lee,jordan@example.com,317-555-0101,Front counter delivery after 9 AM,yes';
    const mapping = {
        externalId: 'STORE NUMBER',
        name: 'STORE NAME',
        siteType: 'LOCATION TYPE',
        addressLine1: 'STREET',
        addressLine2: 'SUITE',
        city: 'CITY',
        state: 'STATE',
        postalCode: 'ZIP',
        country: 'COUNTRY',
        market: 'MARKET',
        contactName: 'CONTACT',
        contactEmail: 'EMAIL',
        contactPhone: 'PHONE',
        accessNotes: 'NOTES',
        active: 'ENABLED'
    };
    const preview = previewImport(f.s, 'acme', 'endpoints', csv, mapping);
    assert.deepEqual(preview.errors, []);
    const id = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'endpoints', csv, mapping });
    mutate(f.s, f.client, 'acme', 'importCommit', { id });
    assert.equal(f.s.endpoints[0].externalId, 'STORE-101');
    assert.equal(f.s.endpoints[0].city, 'Indianapolis');
    assert.equal(f.s.endpoints[0].accessNotes, 'Front counter delivery after 9 AM');
});

test('recovery target belongs to supported equipment, not endpoint', () => {
    const f = basic();
    assert.equal(f.s.equipment[0].recoveryTargetHours, 4);
    assert.equal('recoveryTargetHours' in f.s.endpoints[0], false);
});


test('legacy asset exports map snake_case headers and preserve ambiguity', () => {
    const f = fixture();
    const endpointCsv = 'STORE NUMBER,STORE NAME,STREET\nSTORE-101,ACME Store 101,123 Main St';
    const endpointMapping = { externalId: 'STORE NUMBER', name: 'STORE NAME', addressLine1: 'STREET' };
    const ej = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'endpoints', csv: endpointCsv, mapping: endpointMapping });
    mutate(f.s, f.client, 'acme', 'importCommit', { id: ej });

    const csv = 'external_asset_id,asset_tag,endpoint_external_id,manufacturer,model,serial_number,asset_class,compatibility_class,configuration_version,status\nDEV-0001,POS-001,STORE-101,Dell,OptiPlex 7090,SN-001,Desktop PC,ACME-DESKTOP-STD,ACME-W11-2026,READY';
    const mapping = {
        externalId: 'external_asset_id',
        endpointId: 'endpoint_external_id',
        manufacturer: 'manufacturer',
        model: 'model',
        serial: 'serial_number',
        pool: 'compatibility_class',
        configuration: 'configuration_version'
    };
    const preview = previewImport(f.s, 'acme', 'equipment', csv, mapping);
    assert.deepEqual(preview.errors, []);
    const id = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'equipment', csv, mapping });
    mutate(f.s, f.client, 'acme', 'importCommit', { id });
    assert.equal(f.s.equipment[0].externalId, 'DEV-0001');
    assert.equal(f.s.equipment[0].purpose, 'UNCLASSIFIED');
    assert.equal(f.s.equipment[0].status, 'REGISTERED');
    assert.equal(f.s.equipment[0].endpointId, f.s.endpoints[0].id);
});

test('unclassified equipment must be explicitly classified before recovery use', () => {
    const f = fixture();
    importCsv(f.s, f.client, 'endpoints', 'externalId,name,addressLine1\nIND,Indy,Indianapolis IN');
    const csv = 'externalId,manufacturer,model,serial,configuration,pool,endpointId\nR1,OEM,X,001,v1,routers,IND';
    const j = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'equipment', csv });
    mutate(f.s, f.client, 'acme', 'importCommit', { id: j });
    const a = f.s.equipment[0];
    assert.equal(a.purpose, 'UNCLASSIFIED');
    mutate(f.s, f.client, 'acme', 'classifyEquipment', { id: a.id, purpose: 'SUPPORTED', recoveryTargetHours: 4 });
    assert.equal(a.purpose, 'SUPPORTED');
    assert.equal(a.status, 'INSTALLED');
    assert.equal(a.recoveryTargetHours, 4);
});


test('legacy five-row equipment CSV maps OEM/Product/Device ID without inventing custody or readiness', () => {
    const { s, client } = fixture();
    importCsv(s, client, 'endpoints', 'externalId,name,addressLine1\n' +
        Array.from({ length: 5 }, (_, i) => `STORE-10${i + 1},Site ${i + 1},Indianapolis`).join('\n'));
    const csv = [
        'Device ID,Asset Tag,Store Number,OEM,Product,Serial,Device Type,Compatibility,Image Version,Status,Asset Description,Last Verified,Next Verification,Verification Notes',
        'DEV-0001,POS-001,STORE-101,Dell,OptiPlex 7090,SN-D7090-001,Desktop PC,ACME-DESKTOP-STD,ACME-W11-2026,READY,Front counter workstation,2026-10-08,2027-01-08,Passed boot network and peripheral checks',
        'DEV-0002,POS-002,STORE-102,Dell,OptiPlex 7090,SN-D7090-002,Desktop PC,ACME-DESKTOP-STD,ACME-W11-2026,REGISTERED,Back office workstation,,,Imported from client inventory',
        'DEV-0003,PRN-001,STORE-103,Lexmark,MS521dn,SN-LMS521-001,Printer,ACME-PRINT-LASER,PRINT-FW-2026.09,READY,Primary receipt printer,2026-10-07,2027-01-07,Known good test page passed',
        'DEV-0004,SW-001,STORE-104,Cisco,CBS350-24T-4G,SN-CBS350-001,Network Switch,ACME-SWITCH-24P,CFG-2026.10,REGISTERED,Clinic access switch,,,Imported existing deployed asset',
        'DEV-0005,SPARE-001,STORE-105,Dell,OptiPlex 7090,SN-D7090-SP01,Desktop PC,ACME-DESKTOP-STD,ACME-W11-2026,READY,Strategic spare candidate,2026-10-09,2027-01-09,Known good spare ready for dispatch'
    ].join('\n');
    const mapping = inferMapping('equipment', csv.split('\n')[0].split(','));
    assert.equal(mapping.externalId, 'Device ID');
    assert.equal(mapping.manufacturer, 'OEM');
    assert.equal(mapping.model, 'Product');
    assert.equal(mapping.pool, 'Compatibility');
    assert.equal(mapping.endpointId, 'Store Number');
    assert.equal(mapping.customerAssetTag, 'Asset Tag');
    assert.equal(mapping.deviceType, 'Device Type');
    assert.equal(mapping.description, 'Asset Description');
    assert.equal(mapping.declaredStatus, 'Status');
    assert.equal(mapping.declaredVerifiedAt, 'Last Verified');
    assert.equal(mapping.declaredNextVerificationAt, 'Next Verification');
    assert.equal(mapping.declaredVerificationNotes, 'Verification Notes');
    assert.equal(previewImport(s, 'acme', 'equipment', csv, mapping).errors.length, 0);
    const job = mutate(s, client, 'acme', 'importPreview', { kind: 'equipment', csv, mapping });
    mutate(s, client, 'acme', 'importCommit', { id: job });
    assert.equal(s.equipment.length, 5);
    assert.deepEqual(s.equipment.map(x => x.externalId), ['DEV-0001','DEV-0002','DEV-0003','DEV-0004','DEV-0005']);
    assert.ok(s.equipment.every(x => x.purpose === 'UNCLASSIFIED' && x.status === 'REGISTERED' && x.custodian === 'Client' && x.testedAt === null));
    assert.equal(s.equipment[0].customerAssetTag, 'POS-001');
    assert.equal(s.equipment[0].deviceType, 'Desktop PC');
    assert.equal(s.equipment[0].description, 'Front counter workstation');
    assert.equal(s.equipment[0].declaredStatus, 'READY');
    assert.equal(s.equipment[0].declaredVerifiedAt, '2026-10-08');
    assert.equal(s.equipment[0].declaredNextVerificationAt, '2027-01-08');
    assert.equal(s.equipment[0].declaredVerificationNotes, 'Passed boot network and peripheral checks');
    assert.equal(s.equipment[1].declaredStatus, 'REGISTERED');
    assert.equal(s.equipment[1].declaredVerifiedAt, '');
    assert.ok(s.imports.find(x => x.id === job)?.csv.includes('Last Verified'));
});


test('historical enrichment previews retained CSV and fills only blank client declarations', () => {
    const f = fixture();
    importCsv(f.s, f.client, 'endpoints', 'externalId,name,addressLine1\nIND,Indianapolis,Indiana');
    const csv = 'Device ID,OEM,Product,Serial,Image Version,Compatibility,Store Number,Asset Tag,Device Type,Asset Description,Status,Last Verified,Next Verification,Verification Notes\nDEV-1,Dell,7090,SN-1,Win11,Desktop,IND,TAG-1,Desktop PC,Counter device,READY,2026-10-08,2027-01-08,Customer boot test';
    const mapping = { externalId: 'Device ID', manufacturer: 'OEM', model: 'Product', serial: 'Serial', configuration: 'Image Version', pool: 'Compatibility', endpointId: 'Store Number' };
    const source = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'equipment', csv, mapping });
    mutate(f.s, f.client, 'acme', 'importCommit', { id: source });
    const a = f.s.equipment[0];
    assert.equal(a.customerAssetTag, '');
    assert.equal(a.status, 'REGISTERED');
    assert.equal(a.testedAt, null);
    const report = previewEnrichment(f.s, 'acme', f.s.imports.find(x => x.id === source)!);
    assert.equal(report.errors.length, 0);
    assert.equal(report.updates.length, 1);
    assert.equal(report.updates[0].changes.customerAssetTag, 'TAG-1');
    const review = mutate(f.s, f.client, 'acme', 'enrichmentPreview', { id: source });
    assert.equal(a.customerAssetTag, '');
    mutate(f.s, f.client, 'acme', 'enrichmentCommit', { id: review });
    assert.equal(a.customerAssetTag, 'TAG-1');
    assert.equal(a.deviceType, 'Desktop PC');
    assert.equal(a.description, 'Counter device');
    assert.equal(a.declaredStatus, 'READY');
    assert.equal(a.declaredVerifiedAt, '2026-10-08');
    assert.equal(a.declaredNextVerificationAt, '2027-01-08');
    assert.equal(a.declaredVerificationNotes, 'Customer boot test');
    assert.equal(a.status, 'REGISTERED');
    assert.equal(a.custodian, 'Client');
    assert.equal(a.testedAt, null);
    assert.equal(a.testDue, null);
    assert.equal(f.s.audit.filter(x => x.action === 'CUSTOMER_METADATA_ENRICHED').length, 1);
    assert.throws(() => mutate(f.s, f.client, 'acme', 'enrichmentCommit', { id: review }), /pending enrichment/);
});

test('enrichment rejects changed identities and conflicting declarations without writes', () => {
    const f = fixture();
    importCsv(f.s, f.client, 'endpoints', 'externalId,name,addressLine1\nIND,Indianapolis,Indiana');
    const csv = 'Device ID,OEM,Product,Serial,Image Version,Compatibility,Store Number,Asset Tag\nDEV-1,Dell,7090,SN-1,Win11,Desktop,IND,TAG-1';
    const mapping = { externalId: 'Device ID', manufacturer: 'OEM', model: 'Product', serial: 'Serial', configuration: 'Image Version', pool: 'Compatibility', endpointId: 'Store Number' };
    const source = mutate(f.s, f.client, 'acme', 'importPreview', { kind: 'equipment', csv, mapping });
    mutate(f.s, f.client, 'acme', 'importCommit', { id: source });
    const a = f.s.equipment[0];
    const review = mutate(f.s, f.client, 'acme', 'enrichmentPreview', { id: source });
    a.customerAssetTag = 'CONFLICTING-TAG';
    assert.throws(() => mutate(f.s, f.client, 'acme', 'enrichmentCommit', { id: review }), /conflicts with existing equipment/);
    assert.equal(a.customerAssetTag, 'CONFLICTING-TAG');
    a.customerAssetTag = '';
    a.serial = 'MISMATCH';
    assert.throws(() => mutate(f.s, f.client, 'acme', 'enrichmentCommit', { id: review }), /mismatched equipment identity/);
    assert.equal(a.customerAssetTag, '');
});

test('bulk classification previews supported units, requires confirmation and preserves custody', () => {
    const f = fixture();
    importCsv(f.s, f.client, 'endpoints', 'externalId,name,addressLine1\nIND,Indy,Indiana');
    importCsv(f.s, f.client, 'equipment', 'externalId,manufacturer,model,serial,configuration,pool,endpointId\nDEV-1,Dell,7090,S1,Win11,Desktop,IND\nDEV-2,Dell,7090,S2,Win11,Desktop,IND\nSPARE-1,Dell,7090,S3,Win11,Desktop,');
    const ids = f.s.equipment.slice(0, 2).map(x => x.id);
    const preview = mutate(f.s, f.client, 'acme', 'bulkClassifyPreview', { equipmentIds: ids, purpose: 'SUPPORTED', recoveryTargetHours: 4 });
    assert.ok(f.s.equipment.every(x => x.purpose === 'UNCLASSIFIED'));
    assert.equal(scoped(f.s, f.client, 'acme').imports.find(x => x.id === preview)?.count, 2);
    mutate(f.s, f.client, 'acme', 'bulkClassifyCommit', { id: preview });
    assert.deepEqual(f.s.equipment.slice(0, 2).map(x => x.purpose), ['SUPPORTED','SUPPORTED']);
    assert.equal(f.s.equipment[0].recoveryTargetHours, 4);
    assert.equal(f.s.equipment[0].status, 'INSTALLED');
    assert.equal(f.s.equipment[0].custodian, 'Client');
    assert.equal(f.s.equipment[0].testedAt, null);
    assert.equal(f.s.equipment[2].purpose, 'UNCLASSIFIED');
    const spare = mutate(f.s, f.client, 'acme', 'bulkClassifyPreview', { equipmentIds: [f.s.equipment[2].id], purpose: 'SPARE', recoveryTargetHours: '' });
    mutate(f.s, f.client, 'acme', 'bulkClassifyCommit', { id: spare });
    assert.equal(f.s.equipment[2].purpose, 'SPARE');
    assert.equal(f.s.equipment[2].status, 'CLIENT_HELD');
    assert.equal(f.s.equipment[2].custodian, 'Client');
    assert.equal(f.s.equipment[2].testDue, null);
    assert.equal(f.s.audit.filter(x => x.action === 'EQUIPMENT_CLASSIFIED').length, 3);
    assert.throws(() => mutate(f.s, f.client, 'acme', 'bulkClassifyCommit', { id: spare }), /pending classification/);
});
test('bulk classification rejects missing support, duplicate selection and stale reviews atomically', () => {
    const f = fixture();
    importCsv(f.s, f.client, 'endpoints', 'externalId,name,addressLine1\nIND,Indy,Indiana');
    importCsv(f.s, f.client, 'equipment', 'externalId,manufacturer,model,serial,configuration,pool,endpointId\nDEV-1,Dell,7090,S1,Win11,Desktop,IND\nDEV-2,Dell,7090,S2,Win11,Desktop,IND');
    const [first, second] = f.s.equipment;
    assert.throws(() => mutate(f.s, f.client, 'acme', 'bulkClassifyPreview', {equipmentIds: [first.id], purpose: 'SPARE'}), /no confirmed supported equipment/);
    assert.throws(() => mutate(f.s, f.client, 'acme', 'bulkClassifyPreview', {equipmentIds: [first.id, first.id], purpose: 'SUPPORTED'}), /unique/);
    const job = mutate(f.s, f.client, 'acme', 'bulkClassifyPreview', { equipmentIds: [first.id, second.id], purpose: 'SUPPORTED' });
    second.status = 'EXCEPTION';
    assert.throws(() => mutate(f.s, f.client, 'acme', 'bulkClassifyCommit', {id: job}), /not eligible/);
    assert.equal(first.purpose, 'UNCLASSIFIED');
    assert.equal(f.s.imports.find(x => x.id === job)?.status, 'PREVIEW');
});

test('physical receiving retains separate package, equipment and handoff observations', () => {
    const f = basic();
    const a = f.s.equipment[1];
    const iid = mutate(f.s, f.client, 'acme', 'intake', { assetIds: [a.id], notes: 'Demo cold spare' });
    mutate(f.s, f.admin, 'acme', 'acceptIntake', { id: iid, tracking: 'TEST-CARRIER-REF' });
    assert.equal(a.status, 'INBOUND');
    assert.equal(a.receipt, undefined);
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'receive', { id: a.id, serial: a.serial, condition: 'GOOD', packageCondition: 'INVALID', handoffReference: 'TEST-RECEIPT', location: 'Demo hub', position: 'A1' }), /Invalid package condition/);
    assert.equal(a.status, 'INBOUND');
    mutate(f.s, f.admin, 'acme', 'receive', { id: a.id, serial: a.serial, condition: 'GOOD', packageCondition: 'INTACT', handoffReference: 'TEST-RECEIPT', location: 'Demo hub', position: 'A1', notes: 'Simulated receipt test' });
    assert.equal(a.status, 'RECEIVED');
    const receipt = f.s.equipment.find(x => x.id === a.id)?.receipt;
    assert.ok(receipt, 'Receiving must persist a receipt record.');
    assert.equal(receipt.actor, f.admin.email);
    assert.equal(receipt.packageCondition, 'INTACT');
    assert.equal(receipt.observedSerial, a.serial);
    assert.equal(receipt.handoffReference, 'TEST-RECEIPT');
    assert.equal(a.custodian, 'CESCo');
    assert.equal(a.testedAt, null);
    assert.equal(a.testDue, null);
    assert.ok(f.s.audit.some(x => x.action === 'RECEIPT' && x.detail.includes('TEST-RECEIPT')));
});

test('receiving typo correction preserves the original observation and resolves only matching identity', () => {
    const f = basic();
    const a = f.s.equipment[1];
    const iid = mutate(f.s, f.client, 'acme', 'intake', { assetIds: [a.id], notes: 'Simulated spare receipt' });
    mutate(f.s, f.admin, 'acme', 'acceptIntake', { id: iid, tracking: 'SIM-CARRIER-REF' });
    mutate(f.s, f.admin, 'acme', 'receive', { id: a.id, serial: 'TYPED-WRONG', condition: 'GOOD', packageCondition: 'INTACT', handoffReference: 'SIM-DELIVERY', location: 'Lab', position: 'A1', notes: 'Simulation' });
    assert.equal(a.status, 'EXCEPTION');
    const original = a.receipt?.observedSerial;
    assert.throws(() => mutate(f.s, f.client, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: 'Typo' }), /permission/);
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: '' }), /Correction reason is required/);
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: 'Typo', evidenceId: 'other-account-file' }), /Record not found/);
    mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: 'STILL-WRONG', reason: 'Corrected first transposition' });
    assert.equal(a.status, 'EXCEPTION');
    assert.equal(f.s.intakes[0].status, 'EXCEPTION');
    mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: 'Second inspection of printed serial label confirms initial transcription error' });
    assert.equal(a.status, 'RECEIVED');
    assert.equal(f.s.intakes[0].status, 'RECEIVED');
    assert.equal(a.receipt?.observedSerial, original);
    assert.equal(a.receiptCorrections?.length, 2);
    assert.equal(a.receiptCorrections?.[0].previousSerial, 'TYPED-WRONG');
    assert.equal(a.receiptCorrections?.[1].previousSerial, 'STILL-WRONG');
    assert.equal(a.receiptCorrections?.[1].correctedSerial, a.serial);
    assert.equal(a.receiptCorrections?.[1].actor, f.admin.email);
    assert.equal(a.testedAt, null);
    assert.equal(a.testDue, null);
    assert.ok(f.s.audit.filter(x => x.action === 'RECEIPT_OBSERVATION_CORRECTED').length === 2);
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: 'BAD', reason: 'Retry' }), /Only a received exception/);
});

test('receipt correction can reference only evidence from the matching intake or equipment', () => {
    const f = basic();
    const a = f.s.equipment[1];
    const iid = mutate(f.s, f.client, 'acme', 'intake', { assetIds: [a.id], notes: 'Test intake' });
    mutate(f.s, f.admin, 'acme', 'acceptIntake', { id: iid, tracking: 'TEST' });
    mutate(f.s, f.admin, 'acme', 'receive', { id: a.id, serial: 'WRONG', condition: 'GOOD', location: 'Hub', position: 'B2' });
    f.s.evidence.push({ id: 'linked-photo', orgId: 'acme', entityId: a.id, name: 'serial.jpg', sha256: 'test-hash', key: 'test-key', size: 1, mime: 'image/jpeg', actor: f.admin.email, at: new Date().toISOString(), description: 'Serial label', category: 'SERIAL_PHOTO' });
    f.s.evidence.push({ id: 'unrelated-photo', orgId: 'acme', entityId: f.s.equipment[0].id, name: 'other.jpg', sha256: 'test-hash', key: 'other', size: 1, mime: 'image/jpeg', actor: f.admin.email, at: new Date().toISOString(), description: 'Other item', category: 'SERIAL_PHOTO' });
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: 'Label checked', evidenceId: 'unrelated-photo' }), /Evidence must be linked/);
    mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: 'Label rechecked', evidenceId: 'linked-photo' });
    assert.equal(a.receiptCorrections?.[0].evidenceId, 'linked-photo');
});

test('optional evidence categories accept photographs and reject category/content-type mismatches', () => {
    assert.equal(validateEvidenceCategory('SERIAL_PHOTO', 'image/jpeg'), 'SERIAL_PHOTO');
    assert.equal(validateEvidenceCategory('PACKAGE_BEFORE', 'image/png'), 'PACKAGE_BEFORE');
    assert.equal(validateEvidenceCategory('EQUIPMENT_CONDITION', 'image/webp'), 'EQUIPMENT_CONDITION');
    assert.equal(validateEvidenceCategory('RECEIPT', 'application/pdf'), 'RECEIPT');
    assert.equal(validateEvidenceCategory('OTHER', 'application/octet-stream'), 'OTHER');
    assert.throws(() => validateEvidenceCategory('SERIAL_PHOTO', 'text/plain'), /Photographic evidence/);
    assert.throws(() => validateEvidenceCategory('UNRECOGNIZED', 'image/jpeg'), /supported evidence category/);
});

test('post-correction photographic evidence can link to a completed observation without changing receipt', () => {
    const f = basic();
    const a = f.s.equipment[1];
    const iid = mutate(f.s, f.client, 'acme', 'intake', { assetIds: [a.id], notes: 'Simulated receipt' });
    mutate(f.s, f.admin, 'acme', 'acceptIntake', { id: iid, tracking: 'TEST-CARRIER' });
    mutate(f.s, f.admin, 'acme', 'receive', { id: a.id, serial: 'TYPO', condition: 'GOOD', location: 'Hub', position: 'A' });
    mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: 'Transcription error after serial label recheck' });
    const original = JSON.stringify(a.receiptCorrections);
    assert.equal(validateCorrectionEvidenceLink(f.s, 'acme', a.id, 0).id, a.id);
    assert.throws(() => validateCorrectionEvidenceLink(f.s, 'acme', a.id, 1), /does not exist/);
    assert.throws(() => validateCorrectionEvidenceLink(f.s, 'acme', a.id, -1), /Invalid receiving correction/);
    assert.throws(() => validateCorrectionEvidenceLink(f.s, 'other-account', a.id, 0), /Record not found/);
    f.s.evidence.push({ id: 'subsequent-photo', orgId: 'acme', entityId: a.id, receiptCorrectionIndex: 0, name: 'serial-after.jpg', sha256: 'abc', key: 'photo', size: 10, mime: 'image/jpeg', actor: f.admin.email, at: new Date().toISOString(), description: 'New photo taken during correction review', category: 'SERIAL_PHOTO' });
    assert.equal(f.s.evidence.filter(e => e.entityId === a.id && e.receiptCorrectionIndex === 0).length, 1);
    assert.equal(JSON.stringify(a.receiptCorrections), original);
    assert.equal(a.status, 'RECEIVED');
    assert.equal(a.testedAt, null);
});

test('corrected receiving exception requires independent readiness test before stocking relocation', () => {
    const f = basic();
    const a = f.s.equipment[1];
    const iid = mutate(f.s, f.client, 'acme', 'intake', { assetIds: [a.id], notes: 'Demo spare' });
    mutate(f.s, f.admin, 'acme', 'acceptIntake', { id: iid, tracking: 'SIM-TRACK' });
    mutate(f.s, f.admin, 'acme', 'receive', { id: a.id, serial: 'TRANSCRIPTION-ERROR', condition: 'GOOD', packageCondition: 'INTACT', handoffReference: 'SIM-RECEIPT', location: 'Initial hub', position: 'Receiving A' });
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'verify', { id: a.id, configuration: a.configuration, validDays: 30, notes: 'Not yet inspected' }), /Receive or repair/);
    mutate(f.s, f.admin, 'acme', 'correctReceiptObservation', { id: a.id, serial: a.serial, reason: 'Serial label rechecked' });
    assert.equal(a.status, 'RECEIVED');
    assert.equal(a.testedAt, null);
    const receipt = JSON.stringify(a.receipt);
    mutate(f.s, f.admin, 'acme', 'move', { id: a.id, location: 'Strategic stock B', position: 'Shelf 3', notes: 'Controlled internal relocation' });
    assert.equal(a.status, 'RECEIVED');
    assert.equal(a.location, 'Strategic stock B');
    assert.equal(a.position, 'Shelf 3');
    assert.equal(a.testDue, null);
    mutate(f.s, f.admin, 'acme', 'verify', { id: a.id, configuration: a.configuration, validDays: 30, notes: 'Simulated independent functional readiness test' });
    assert.equal(a.status, 'READY');
    assert.equal(a.custodian, 'CESCo');
    assert.ok(a.testedAt);
    assert.ok(a.testDue);
    assert.equal(JSON.stringify(a.receipt), receipt);
    assert.equal(a.receiptCorrections?.length, 1);
    assert.ok(f.s.audit.some(x => x.action === 'STOCK_REPOSITIONED'));
    assert.ok(f.s.audit.some(x => x.action === 'READINESS_VERIFIED'));
});

test('operations metrics are tenant-scoped, date-bound, and never fabricate capacity or turnaround', () => {
    const f = basic();
    const before = operationsMetrics(f.s, 'acme', '2026-10-13T12:00:00.000Z');
    assert.equal(before.contract, metricContractVersion);
    assert.equal(before.readyByRegion, null);
    assert.equal(before.warehouseUtilization, null);
    assert.equal(before.replenishmentHours, null);
    assert.ok(before.limitations.length > 0);
    const spare = f.s.equipment.find(x => x.purpose === 'SPARE');
    assert.ok(spare);
    spare.status = 'READY';
    spare.custodian = 'CESCo';
    spare.condition = 'GOOD';
    spare.testedAt = '2026-10-13T10:00:00.000Z';
    spare.testDue = '2026-11-12T10:00:00.000Z';
    spare.requestId = null;
    const current = operationsMetrics(f.s, 'acme', '2026-10-13T12:00:00.000Z');
    assert.equal(current.readySpareCount, 1);
    assert.equal(current.readyByCompatibility.find(x => x.pool === spare.pool)?.ready, 1);
    assert.equal(operationsMetrics(f.s, 'acme', '2026-11-13T12:00:00.000Z').readySpareCount, 0);
    assert.equal(operationsMetrics(f.s, 'another-tenant', '2026-10-13T12:00:00.000Z').readySpareCount, 0);
    spare.requestId = 'reserved';
    assert.equal(operationsMetrics(f.s, 'acme', '2026-10-13T12:00:00.000Z').readySpareCount, 0);
    assert.throws(() => operationsMetrics(f.s, 'acme', 'not-a-date'), /Invalid metrics as-of/);
});
test('reported service charge totals use performed timestamp and never conflate invoices and payments', () => {
    const f = basic();
    f.s.activities.push({ id: 'm1', orgId: 'acme', requestId: null, intakeId: null, assetId: null, rateId: 'r1', rateVersion: 'v1', description: 'handling', quantity: 1, unit: 'job', unitCents: 2300, amount: 2300, status: 'ACCEPTED', performedAt: '2026-10-10T12:00:00.000Z', performedBy: 'staff', periodStart: null, periodEnd: null, costCents: 1000, invoiceId: null });
    f.s.activities.push({ ...f.s.activities[f.s.activities.length-1], id: 'm2', performedAt: '2026-10-02T12:00:00.000Z', amount: 900 });
    const m = operationsMetrics(f.s, 'acme', '2026-10-13T12:00:00.000Z', '2026-10-07T00:00:00.000Z');
    assert.equal(m.recordedServiceCostCents, 2300);
    assert.equal(m.recordedServiceCount, 1);
    assert.throws(() => operationsMetrics(f.s, 'acme', '2026-10-07T00:00:00.000Z', '2026-10-13T00:00:00.000Z'), /Invalid metrics reporting period/);
});

test('fulfillment event counters are tenant-scoped and period filtered', () => {
    const f = basic();
    const make = (id: string, orgId: string, type: 'SPARE_RESERVED' | 'SPARE_DISPATCHED' | 'DELIVERY_RECORDED' | 'FAILED_RETURN_RECEIVED' | 'SPARE_REPLENISHED', at: string) => ({ id, orgId, type, at, requestId: 'req', equipmentId: 'eq', actor: 'ops@example.com', reference: 'simulation', relatedEquipmentId: null, version: 1 as const });
    f.s.operationalEvents = [
        make('e1','acme','SPARE_RESERVED','2026-10-10T00:00:00.000Z'),
        make('e2','acme','SPARE_DISPATCHED','2026-10-11T00:00:00.000Z'),
        make('e3','acme','DELIVERY_RECORDED','2026-10-12T00:00:00.000Z'),
        make('e4','acme','FAILED_RETURN_RECEIVED','2026-10-13T00:00:00.000Z'),
        make('e5','other','SPARE_REPLENISHED','2026-10-13T00:00:00.000Z')
    ];
    const report = operationsMetrics(f.s,'acme','2026-10-12T23:59:59.000Z','2026-10-11T00:00:00.000Z');
    assert.deepEqual(report.fulfillmentMilestones, {reserved:0,dispatched:1,delivered:1,failedReturnsReceived:0,replenished:0});
    assert.equal(operationsMetrics(f.s,'acme','2026-10-14T00:00:00.000Z').fulfillmentMilestones.failedReturnsReceived,1);
    assert.equal(operationsMetrics(f.s,'other','2026-10-14T00:00:00.000Z').fulfillmentMilestones.replenished,1);
});

test('contracted fulfillment offers approved handling and carrier charge without negotiated quote', () => {
    const f = basic(); receive(f);
    const rid = mutate(f.s, f.client, 'acme', 'request', { equipmentId: f.s.equipment[0].id, type: 'RECOVERY', scope: 'Replace failed router' });
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'prepareFulfillment', { id: rid, spareId: f.s.equipment[1].id, handlingRateId: 'missing', shippingCents: 1400, shippingSource: 'Manual carrier quote', serviceLevel: 'Overnight' }), /Record not found/);
    const rateId = mutate(f.s, f.admin, 'acme', 'rate', { name: 'Depot pick-pack', category: 'DISPATCH', unit: 'each', cents: 2500, version: 'Signed terms 1' });
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'prepareFulfillment', { id: rid, spareId: f.s.equipment[1].id, handlingRateId: rateId, shippingCents: 1400, shippingSource: 'Manual carrier quote', serviceLevel: 'Overnight' }), /client-approved dispatch/);
    mutate(f.s, f.client, 'acme', 'approveRate', { id: rateId });
    mutate(f.s, f.admin, 'acme', 'prepareFulfillment', { id: rid, spareId: f.s.equipment[1].id, handlingRateId: rateId, shippingCents: 1400, shippingSource: 'TEST carrier estimate #A', serviceLevel: 'Overnight' });
    const request = f.s.requests.find(r => r.id === rid)!;
    assert.equal(request.status, 'FULFILLMENT_OFFER');
    assert.equal(request.fulfillment?.totalCents, 3900);
    assert.equal(request.authorizedAt, null);
    assert.equal(f.s.equipment[1].status, 'READY');
    const unauthorized: User = { id: 'auditor-test', orgId: 'acme', name: 'Auditor', email: 'auditor@example.com', password: '', role: 'AUDITOR' };
    assert.throws(() => mutate(f.s, unauthorized, 'acme', 'confirmFulfillment', { id: rid }), /permission/);
    mutate(f.s, f.client, 'acme', 'confirmFulfillment', { id: rid });
    assert.equal(request.status, 'AUTHORIZED');
    assert.equal(request.ceiling, 3900);
    assert.ok(request.fulfillment?.confirmedAt);
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'reserve', { id: rid, spareId: f.s.equipment[0].id }), /client-confirmed spare/);
    mutate(f.s, f.admin, 'acme', 'reserve', { id: rid, spareId: f.s.equipment[1].id });
    assert.equal(request.status, 'RESERVED');
    assert.equal(f.s.equipment[1].status, 'RESERVED');
});
test('fulfillment cannot confirm stale stock, changed tariff, or endpoint destination', () => {
    const f = basic(); receive(f);
    const rid = mutate(f.s, f.client, 'acme', 'request', { equipmentId: f.s.equipment[0].id, type: 'RECOVERY', scope: 'Endpoint recovery' });
    const rateId = mutate(f.s, f.admin, 'acme', 'rate', { name: 'Handling', category: 'DISPATCH', unit: 'each', cents: 2500, version: 'Contract A' });
    mutate(f.s, f.client, 'acme', 'approveRate', { id: rateId });
    const prepare = () => mutate(f.s, f.admin, 'acme', 'prepareFulfillment', { id: rid, spareId: f.s.equipment[1].id, handlingRateId: rateId, shippingCents: 0, shippingSource: 'TEST no-charge customer collection', serviceLevel: 'Collection' });
    prepare();
    f.s.rates.find(r => r.id === rateId)!.cents = 3000;
    assert.throws(() => mutate(f.s, f.client, 'acme', 'confirmFulfillment', { id: rid }), /agreement changed/);
    f.s.rates.find(r => r.id === rateId)!.cents = 2500;
    f.s.equipment[1].status = 'REPAIR';
    assert.throws(() => mutate(f.s, f.client, 'acme', 'confirmFulfillment', { id: rid }), /no longer available/);
    f.s.equipment[1].status = 'READY';
    f.s.endpoints[0].addressLine1 = 'Changed address';
    assert.throws(() => mutate(f.s, f.client, 'acme', 'confirmFulfillment', { id: rid }), /destination changed/);
    assert.equal(f.s.requests[0].authorizedAt, null);
});
