import test from 'node:test';
import { inferMapping } from '../src/lib/import-mapping.ts';
import assert from 'node:assert/strict';
import { emptyState, id, mutate, previewImport, balance, creditBalance, scoped, type State, type User } from '../src/lib/domain.ts';
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
    assert.equal(previewImport(s, 'acme', 'equipment', csv, mapping).errors.length, 0);
    const job = mutate(s, client, 'acme', 'importPreview', { kind: 'equipment', csv, mapping });
    mutate(s, client, 'acme', 'importCommit', { id: job });
    assert.equal(s.equipment.length, 5);
    assert.deepEqual(s.equipment.map(x => x.externalId), ['DEV-0001','DEV-0002','DEV-0003','DEV-0004','DEV-0005']);
    assert.ok(s.equipment.every(x => x.purpose === 'UNCLASSIFIED' && x.status === 'REGISTERED' && x.custodian === 'Client' && x.testedAt === null));
    assert.ok(s.imports.find(x => x.id === job)?.csv.includes('Last Verified'));
});
