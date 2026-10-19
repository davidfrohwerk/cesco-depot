import { toCanonicalLength, toCanonicalWeight, toDisplayLength, toDisplayWeight } from '../src/lib/package-measurements.ts';
import { parseUsdCents, normalizeMoneyInputs } from '../src/lib/currency.ts';
import { normalizeRateUnit, rateUnitOptions } from '../src/lib/rate-units.ts';
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
test('recovery: authenticated ceiling, compatible reservation, single allocation, dispatch, delivery, failed return and restock', () => { const f = basic(); const { s, admin } = f; receive(f); const rid = authorize(f); const spare = s.equipment[1]; mutate(s, admin, 'acme', 'reserve', { id: rid, spareId: spare.id }); const second = authorize(f); assert.throws(() => mutate(s, admin, 'acme', 'reserve', { id: second, spareId: spare.id }), /available/); mutate(s, admin, 'acme', 'dispatch', { id: rid, tracking: 'dispatch-1', custodian: 'Courier', etaHours: 2 }); assert.ok(s.requests[0].workOrder); mutate(s, admin, 'acme', 'deliver', { id: rid, recipient:'Site manager',reference:'CARRIER-DELIVERY-001',notes:'Carton received; not yet installed' }); assert.equal(spare.status,'DELIVERED_PENDING_INSTALLATION'); assert.equal(spare.purpose,'SPARE'); assert.equal(s.equipment[0].purpose,'SUPPORTED'); const proofId=id(); s.evidence.push({id:proofId,orgId:'acme',entityId:rid,name:'functional-test.pdf',sha256:'test-sha256',key:'test-file',size:123,mime:'application/pdf',actor:admin.email,at:new Date().toISOString(),description:'Installation and functional test',category:'TEST_RESULT'}); mutate(s,admin,'acme','confirmInstallation',{id:rid,technician:'Client field tech',notes:'Installed and passed functional test',evidenceId:proofId}); assert.equal(spare.purpose, 'SUPPORTED'); assert.equal(spare.status, 'INSTALLED'); assert.equal(s.equipment[0].purpose, 'SPARE'); assert.equal(s.equipment[0].status, 'RETURN_PENDING'); mutate(s,admin,'acme','authorizeFailedReturn',{id:rid,reference:'RMA-TEST',destination:'Indy',instructions:'Return failed device securely'});
 mutate(s,admin,'acme','recordFailedReturnShipment',{id:rid,carrier:'Return courier',tracking:'INBOUND-TEST',shipper:'Client field tech'});
 const returnProof=id();s.evidence.push({id:returnProof,orgId:'acme',entityId:rid,name:'receiving.pdf',sha256:'return-test-sha',key:'return-test',size:100,mime:'application/pdf',actor:admin.email,at:new Date().toISOString(),description:'Return receipt',category:'RECEIPT'});
 mutate(s, admin, 'acme', 'return', { id: rid,observedSerial:s.equipment[0].serial,condition:'Failed PSU observed',evidenceId:returnProof,location: 'Indy', position: 'repair bench' }); const diagnosticId=id();s.evidence.push({id:diagnosticId,orgId:'acme',entityId:rid,name:'diagnostic.pdf',sha256:'diagnostic-hash',key:'diagnostic-file',size:110,mime:'application/pdf',actor:admin.email,at:new Date().toISOString(),description:'Bench diagnostic findings',category:'TEST_RESULT'});
 mutate(s,admin,'acme','assessFailedUnit',{id:rid,diagnosis:'Failed PSU',warranty:'Out of warranty',feasibility:'Serviceable on bench',estimatedCostCents:2500,estimatedDays:3,recommendation:'REPAIR',notes:'Parts available; estimate only',evidenceId:diagnosticId});
 assert.equal(s.equipment[0].condition,'FAILED');
 assert.throws(()=>mutate(s,admin,'acme','repair',{id:s.equipment[0].id,notes:'Not authorized'}),/separate authorized repair work order/);
 assert.throws(()=>mutate(s,admin,'acme','approveFailedTreatment',{id:rid,expectedVersion:0,reference:'STALE',notes:'Outdated approval'}),/Assessment version is stale/);
 mutate(s,admin,'acme','approveFailedTreatment',{id:rid,expectedVersion:1,reference:'CLIENT-REPAIR-APPROVAL',notes:'Client accepted treatment proposal'});
 assert.equal(s.requests.find(x=>x.id===rid)?.technicalAssessment?.approval?.assessmentVersion,1);
 mutate(s,admin,'acme','openRecoveryRepair',{id:rid,workOrder:'REPAIR-001'});
 assert.equal(s.equipment[0].condition,'FAILED');
 assert.equal(s.equipment[0].status,'REPAIR');
 assert.throws(()=>mutate(s,admin,'acme','verify',{id:s.equipment[0].id,configuration:'v1',validDays:30,notes:'No work proof'}),/independent post-repair/);
 const repairProof=id();s.evidence.push({id:repairProof,orgId:'acme',entityId:rid,name:'work-performed.txt',sha256:'repair-result-sha',key:'repair-result',size:150,mime:'text/plain',actor:admin.email,at:new Date().toISOString(),description:'Repair work',category:'EQUIPMENT_CONDITION'});
 mutate(s,admin,'acme','recordRecoveryRepairResult',{id:rid,outcome:'SUCCESS',notes:'Replaced faulty PSU; awaiting independent test',evidenceId:repairProof});
 assert.equal(s.equipment[0].condition,'FAILED');
 assert.equal(s.equipment[0].status,'REPAIRED_PENDING_TEST');
 assert.throws(()=>mutate(s,admin,'acme','verifyRecoveryRepair',{id:rid,configuration:'v1',validDays:30,notes:'Same technician',evidenceId:repairProof}),/different operator/);
 const qa={...admin,email:'independent-qa@example.com',id:'independent-qa'};s.users.push(qa);
 const qaProof=id();s.evidence.push({id:qaProof,orgId:'acme',entityId:rid,name:'qa-result.txt',sha256:'qa-sha',key:'qa-result',size:160,mime:'text/plain',actor:qa.email,at:new Date().toISOString(),description:'Independent functional validation',category:'TEST_RESULT'});
 mutate(s,qa,'acme','verifyRecoveryRepair',{id:rid,configuration:'v1',validDays:30,notes:'Passed independent boot and config verification',evidenceId:qaProof});
 assert.equal(s.equipment[0].condition,'GOOD');
 assert.equal(s.equipment[0].status,'READY');
 assert.equal(operationsMetrics(s,'acme').readySpareCount,0);
 const verifiedDue=s.equipment[0].testDue;
 s.equipment[0].testDue='2000-01-01T00:00:00.000Z';
 assert.throws(()=>mutate(s,admin,'acme','restock',{id:s.equipment[0].id}),/Current CESCo readiness and custody/);
 s.equipment[0].testDue=verifiedDue;
 assert.throws(()=>mutate(s,admin,'acme','restock',{id:s.equipment[0].id}),/Serial observed at stocking/);
 const placed=id();s.evidence.push({id:placed,orgId:'acme',entityId:rid,name:'stock-placement.txt',sha256:'placement-sha',key:'placement',size:30,mime:'text/plain',actor:admin.email,at:new Date().toISOString(),description:'Physical bin and serial observation',category:'RECEIPT'});
 assert.throws(()=>mutate(s,admin,'acme','restock',{id:s.equipment[0].id,observedSerial:'WRONG',location:'Indy Hub',position:'SP-01',notes:'Wrong serial',evidenceId:placed}),/Stocking serial does not match/);
 mutate(s,admin,'acme','restock',{id:s.equipment[0].id,observedSerial:s.equipment[0].serial,location:'Indy Hub',position:'SP-01',notes:'Observed serial and placement',evidenceId:placed});
 assert.equal(s.equipment[0].requestId,null);
 assert.equal(s.equipment[0].purpose,'SPARE');
 assert.equal(s.equipment[0].position,'SP-01');
 assert.equal(operationsMetrics(s,'acme').readySpareCount,1);
 assert.ok(s.requests.find(x=>x.id===rid)?.replenishment);
 assert.throws(()=>mutate(s,admin,'acme','restock',{id:s.equipment[0].id,observedSerial:s.equipment[0].serial,location:'Indy Hub',position:'SP-01',notes:'Duplicate',evidenceId:placed}),/Legacy restock requires supported equipment/);
 mutate(s, admin, 'acme', 'complete', { id: rid, notes: 'Recovered and replenished' }); assert.equal(s.requests[0].status, 'COMPLETED'); assert.equal(s.equipment[0].status, 'READY'); });
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
    assert.deepEqual(report.fulfillmentMilestones, {reserved:0,dispatched:1,delivered:1,installed:0,failedReturnsReceived:0,replenished:0});
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

test('draft rates can be corrected and withdrawn with audit history; approved rates can only be retired', () => {
    const f = basic();
    const rateId = mutate(f.s, f.admin, 'acme', 'rate', { name: 'Incorrect draft', category: 'DISPATCH', unit: 'each', cents: 2500, version: 'DEMO' });
    const rate = f.s.rates.find(r => r.id === rateId)!;
    mutate(f.s, f.admin, 'acme', 'editDraftRate', { id: rateId, name: 'Corrected draft', category: 'DISPATCH', unit: 'each', cents: 2700, version: 'DEMO-2' });
    assert.equal(rate.cents, 2700);
    assert.ok(f.s.audit.some(x => x.action === 'DRAFT_RATE_REVISED' && x.entityId === rateId));
    assert.throws(() => mutate(f.s, f.admin, 'other', 'withdrawRate', { id: rateId, reason: 'Wrong tenant' }), /Record not found/);
    mutate(f.s, f.admin, 'acme', 'withdrawRate', { id: rateId, reason: 'Created under incorrect account' });
    assert.equal(rate.active, false);
    assert.throws(() => mutate(f.s, f.client, 'acme', 'approveRate', { id: rateId }), /active draft/);
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'editDraftRate', { id: rateId, name: 'Again', category: 'DISPATCH', unit: 'each', cents: 2800, version: 'DEMO-3' }), /active, unapproved/);
    const approvedId = mutate(f.s, f.admin, 'acme', 'rate', { name: 'Approved', category: 'DISPATCH', unit: 'each', cents: 2500, version: 'SIGNED' });
    mutate(f.s, f.client, 'acme', 'approveRate', { id: approvedId });
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'editDraftRate', { id: approvedId, name: 'Tampered', category: 'DISPATCH', unit: 'each', cents: 0, version: 'BAD' }), /active, unapproved/);
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'withdrawRate', { id: approvedId, reason: 'Wrong process' }), /unapproved/);
    mutate(f.s, f.admin, 'acme', 'retireRate', { id: approvedId, reason: 'Superseded pricing schedule' });
    assert.equal(f.s.rates.find(r => r.id === approvedId)?.active, false);
    assert.ok(f.s.audit.some(x => x.action === 'APPROVED_RATE_RETIRED' && x.entityId === approvedId));
    assert.equal(f.s.rates.length, 2);
});

test('billing unit dropdown values are canonical and legacy casing is normalized', () => {
    assert.equal(normalizeRateUnit('Each'), 'each');
    assert.equal(normalizeRateUnit('cubic foot-day'), 'cubic-foot-day');
    assert.equal(normalizeRateUnit('job'), 'job');
    assert.equal(normalizeRateUnit(' per item '), 'each');
    assert.equal(normalizeRateUnit('hour'), 'hour');
    assert.equal(normalizeRateUnit('fulfillment'), 'fulfillment');
    assert.throws(() => normalizeRateUnit('mystery'), /supported pricing unit/);
    assert.ok(rateUnitOptions.some(u => u.value === 'each'));
    const f = basic();
    const id = mutate(f.s, f.admin, 'acme', 'rate', { name: 'Handling', category: 'DISPATCH', unit: 'Each', cents: 2500, version: 'DEMO' });
    assert.equal(f.s.rates.find(r => r.id === id)?.unit, 'each');
    mutate(f.s, f.admin, 'acme', 'editDraftRate', { id, name: 'Handling', category: 'DISPATCH', unit: 'FULFILLMENT', cents: 2500, version: 'DEMO' });
    assert.equal(f.s.rates.find(r => r.id === id)?.unit, 'fulfillment');
    assert.throws(() => mutate(f.s, f.admin, 'acme', 'rate', { name: 'Bad unit', category: 'DISPATCH', unit: 'arbitrary', cents: 100, version: 'DEMO' }), /supported pricing unit/);
});

test('simulated fulfillment is visibly distinguished and cannot be confirmed or shipped', () => {
 const f = basic(); receive(f);
 const rid = mutate(f.s, f.client, 'acme', 'request', { equipmentId: f.s.equipment[0].id, type: 'RECOVERY', scope: 'Simulation only' });
 const rateId = mutate(f.s, f.admin, 'acme', 'rate', { name: 'Handling', category: 'DISPATCH', unit: 'each', cents: 2500, version: 'DEMO' });
 mutate(f.s, f.client, 'acme', 'approveRate', { id: rateId });
 mutate(f.s, f.admin, 'acme', 'prepareFulfillment', { id: rid, spareId: f.s.equipment[1].id, handlingRateId: rateId, shippingCents: 5000, shippingSource: 'SIMULATED — no carrier quote', serviceLevel: 'Overnight', offerMode: 'SIMULATED' });
 const request = f.s.requests.find(r => r.id === rid)!;
 assert.equal(request.fulfillment?.offerMode, 'SIMULATED');
 assert.equal(request.fulfillment?.totalCents, 7500);
 assert.throws(() => mutate(f.s, f.client, 'acme', 'confirmFulfillment', { id: rid }), /Simulated offers cannot authorize/);
 assert.equal(request.status, 'FULFILLMENT_OFFER');
 assert.equal(request.authorizedAt, null);
 assert.equal(f.s.equipment[1].status, 'READY');
});

test('unconfirmed legacy fulfillment offer can be withdrawn and reoffered without allocation', () => {
 const f = basic(); receive(f);
 const rid = mutate(f.s, f.client, 'acme', 'request', { equipmentId: f.s.equipment[0].id, type:'RECOVERY', scope:'Demo recovery' });
 const rateId = mutate(f.s, f.admin, 'acme', 'rate', { name:'Handling', category:'DISPATCH', unit:'each', cents:2500, version:'DEMO' });
 mutate(f.s, f.client, 'acme', 'approveRate', { id:rateId });
 const offer = { id:rid, spareId:f.s.equipment[1].id, handlingRateId:rateId, shippingCents:5000, shippingSource:'Simulation', serviceLevel:'Overnight' };
 mutate(f.s, f.admin, 'acme', 'prepareFulfillment', offer);
 const r = f.s.requests.find(r => r.id === rid)!;
 assert.equal(r.status, 'FULFILLMENT_OFFER');
 delete r.fulfillment!.offerMode; // Pre-upgrade legacy record
 assert.throws(() => mutate(f.s, f.admin, 'acme', 'withdrawFulfillment', { id:rid, reason:'' }), /required/);
 assert.throws(() => mutate(f.s, f.admin, 'other', 'withdrawFulfillment', { id:rid, reason:'wrong tenant' }), /Record not found/);
 mutate(f.s, f.admin, 'acme', 'withdrawFulfillment', { id:rid, reason:'Legacy simulated offer' });
 assert.equal(r.status, 'REQUESTED');
 assert.equal(r.fulfillment, undefined);
 assert.equal(r.authorizedAt, null);
 assert.equal(f.s.equipment[1].status, 'READY');
 const entry = f.s.audit.find(a => a.entityId === rid && a.action === 'FULFILLMENT_OFFER_WITHDRAWN');
 assert.ok(entry);
 assert.equal(JSON.parse(entry.detail).offer.totalCents, 7500);
 assert.equal(JSON.parse(entry.detail).reason, 'Legacy simulated offer');
 mutate(f.s, f.admin, 'acme', 'prepareFulfillment', { ...offer, offerMode:'SIMULATED' });
 const reoffered = f.s.requests.find(item => item.id === rid)?.fulfillment;
 assert.equal(reoffered?.offerMode, 'SIMULATED');
 assert.throws(() => mutate(f.s, f.client, 'acme', 'confirmFulfillment', { id:rid }), /Simulated offers cannot authorize/);
 assert.equal(f.s.activities.length, 0);
});

test('USD entry accepts whole dollars and two decimal places without confusing cents', () => {
 assert.equal(parseUsdCents('50'), 5000);
 assert.equal(parseUsdCents('50.00'), 5000);
 assert.equal(parseUsdCents('25.50'), 2550);
 assert.equal(parseUsdCents('0.05'), 5);
 assert.equal(parseUsdCents('0.00'), 0);
 for (const invalid of ['50.000', '-1', '1e2', '1,000', 'NaN', '', '1.2.3']) {
   assert.throws(() => parseUsdCents(invalid), /nonnegative USD/);
 }
});

test('all financial entry points treat typed values as USD dollars rather than integer cents',()=>{
 const examples:[string,string,string,string][]=[
  ['rate','priceDollars','cents','75.00'],['editDraftRate','priceDollars','cents','0.75'],
  ['prepareFulfillment','shippingDollars','shippingCents','12.50'],['quote','ceilingDollars','ceiling','75'],
  ['amendQuote','ceilingDollars','ceiling','120.00'],['activity','costDollars','costCents','22.45'],
  ['settle','amountDollars','cents','0.75'],['assessFailedUnit','estimatedCostDollars','estimatedCostCents','75.00'],
  ['trainingRepairApprove','maximumDollars','maxCents','75.00'],['trainingRepairResult','spentDollars','spentCents','0.75']
 ];
 for(const [action,input,output,amount] of examples){
  const parsed=normalizeMoneyInputs(action,{[input]:amount,id:'leave-intact'});
  assert.equal(parsed[output],parseUsdCents(amount),action);
  assert.equal(parsed[input],undefined,action);
  assert.equal(parsed.id,'leave-intact');
 }
 assert.equal(normalizeMoneyInputs('assessFailedUnit',{estimatedCostDollars:''}).estimatedCostCents,null);
 assert.equal(normalizeMoneyInputs('assessFailedUnit',{estimatedCostDollars:'0.00'}).estimatedCostCents,0);
 assert.throws(()=>normalizeMoneyInputs('settle',{amountDollars:'75.000'}),/nonnegative USD/);
 assert.throws(()=>normalizeMoneyInputs('quote',{ceilingDollars:'1e3'}),/nonnegative USD/);
});

test('package profiles require measured values, preserve revisions and never move stock or create charges', () => {
 const f = basic(); receive(f);
 const spare = f.s.equipment[1];
 const originalStatus = spare.status;
 const input = { id: spare.id, packageId: 'CARTON-001', packaging: 'Protective shipping carton', lengthCm: 45, widthCm: 30, heightCm: 20, weightKg: 5.25 };
 assert.throws(() => mutate(f.s, f.admin, 'acme', 'setPackageProfile', { ...input, weightKg: 0 }), /Packed weight/);
 assert.equal(spare.packageProfile, undefined);
 assert.throws(() => mutate(f.s, f.admin, 'acme', 'setPackageProfile', { ...input, lengthCm: -1 }), /Package length/);
 mutate(f.s, f.admin, 'acme', 'setPackageProfile', input);
 const recordedProfile = f.s.equipment.find(item => item.id === spare.id)?.packageProfile;
 assert.equal(recordedProfile?.packageId, 'CARTON-001');
 assert.equal(recordedProfile?.weightKg, 5.25);
 mutate(f.s, f.admin, 'acme', 'setPackageProfile', { ...input, weightKg: 5.5 });
 const changes = f.s.audit.filter(e => e.action === 'PACKAGE_PROFILE_RECORDED' && e.entityId === spare.id);
 assert.equal(changes.length, 2);
 assert.equal(JSON.parse(changes[1].detail).previous.weightKg, 5.25);
 assert.equal(spare.status, originalStatus);
 assert.equal(spare.requestId, null);
 assert.equal(f.s.activities.length, 0);
 assert.throws(() => mutate(f.s, f.admin, 'acme', 'setPackageProfile', { ...input, id: f.s.equipment[0].id }), /CESCo-held spares/);
});

test('US package inputs convert to canonical metric and provenance is audited', () => {
 const f = basic(); receive(f);
 const item = f.s.equipment[1];
 const input = { id:item.id, packageId:'DEMO-US-001', packaging:'SIMULATED — foam carton', enteredUnit:'US', measurementStatus:'SIMULATED', enteredMeasurements:{ length:18, width:12, height:8, weight:12 }, lengthCm:toCanonicalLength(18,'US'), widthCm:toCanonicalLength(12,'US'), heightCm:toCanonicalLength(8,'US'), weightKg:toCanonicalWeight(12,'US') };
 mutate(f.s, f.admin, 'acme', 'setPackageProfile', input);
 const saved = f.s.equipment.find(e => e.id === item.id)?.packageProfile;
 assert.ok(saved);
 assert.equal(saved.enteredUnit,'US');
 assert.equal(saved.measurementStatus,'SIMULATED');
 assert.equal(saved.enteredMeasurements?.length,18);
 assert.ok(Math.abs(saved.lengthCm - 45.72) < 1e-9);
 assert.ok(Math.abs(saved.weightKg - 5.44310844) < 1e-8);
 assert.ok(Math.abs(toDisplayLength(saved.lengthCm,'US') - 18) < 1e-9);
 assert.ok(Math.abs(toDisplayWeight(saved.weightKg,'US') - 12) < 1e-9);
 assert.equal(item.status,'READY');
 assert.throws(() => mutate(f.s,f.admin,'acme','setPackageProfile',{...input,measurementStatus:'UNSUPPORTED'}),/measurement status/);
 assert.throws(() => mutate(f.s,f.admin,'acme','setPackageProfile',{...input,enteredUnit:'UNKNOWN'}),/measurement unit/);
 const entry=f.s.audit.find(e=>e.action==='PACKAGE_PROFILE_RECORDED'&&e.entityId===item.id);
 assert.equal(JSON.parse(entry!.detail).current.measurementStatus,'SIMULATED');
});

test('unit display round trip does not change canonical package measurements', () => {
 const f = basic(); receive(f);
 const item = f.s.equipment[1];
 const base = { id:item.id, packageId:'DEMO-CARTON-001', packaging:'SIMULATED foam carton', measurementStatus:'SIMULATED', enteredUnit:'METRIC', enteredMeasurements:{length:45,width:30,height:20,weight:5.25}, lengthCm:45,widthCm:30,heightCm:20,weightKg:5.25 };
 mutate(f.s,f.admin,'acme','setPackageProfile',base);
 const profile = f.s.equipment.find(e=>e.id===item.id)?.packageProfile;
 assert.ok(profile);
 const displayed = {
  length:Number(toDisplayLength(profile.lengthCm,'US').toFixed(4)),
  width:Number(toDisplayLength(profile.widthCm,'US').toFixed(4)),
  height:Number(toDisplayLength(profile.heightCm,'US').toFixed(4)),
  weight:Number(toDisplayWeight(profile.weightKg,'US').toFixed(4))
 };
 mutate(f.s,f.admin,'acme','setPackageProfile',{...base,enteredUnit:'US',enteredMeasurements:displayed,lengthCm:profile.lengthCm,widthCm:profile.widthCm,heightCm:profile.heightCm,weightKg:profile.weightKg});
 const saved=f.s.equipment.find(e=>e.id===item.id)?.packageProfile;
 assert.ok(saved);
 assert.deepEqual([saved.lengthCm,saved.widthCm,saved.heightCm,saved.weightKg],[45,30,20,5.25]);
 assert.equal(saved.enteredUnit,'US');
 assert.deepEqual(saved.enteredMeasurements,displayed);
 assert.equal(item.status,'READY');
});

test('shipment preparation snapshots a simulated spare without reserve, label, custody or charge', () => {
 const f=basic(); receive(f);
 const spare=f.s.equipment[1];
 const rid=mutate(f.s,f.client,'acme','request',{equipmentId:f.s.equipment[0].id,type:'RECOVERY',scope:'Simulated shipment preparation'});
 const rateId=mutate(f.s,f.admin,'acme','rate',{name:'Handling',category:'DISPATCH',unit:'each',cents:2500,version:'DEMO'});
 mutate(f.s,f.client,'acme','approveRate',{id:rateId});
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'DEMO-PKG',packaging:'Demo carton',lengthCm:45,widthCm:30,heightCm:20,weightKg:5.25,measurementStatus:'SIMULATED'});
 mutate(f.s,f.admin,'acme','prepareFulfillment',{id:rid,spareId:spare.id,handlingRateId:rateId,shippingCents:5000,shippingSource:'SIMULATED — carrier estimate',serviceLevel:'Overnight',offerMode:'SIMULATED'});
 const before={status:spare.status,custodian:spare.custodian,requestId:spare.requestId,activities:f.s.activities.length,events:f.s.operationalEvents?.length||0};
 mutate(f.s,f.admin,'acme','prepareShipment',{id:rid});
 const record=f.s.requests.find(x=>x.id===rid)!;
 assert.equal(record.shipmentPreparation?.packageId,'DEMO-PKG');
 assert.deepEqual(record.shipmentPreparation?.dimensionsCm,[45,30,20]);
 assert.equal(record.shipmentPreparation?.state,'DRAFT');
 assert.equal(record.shipmentPreparation?.offerMode,'SIMULATED');
 assert.deepEqual({status:spare.status,custodian:spare.custodian,requestId:spare.requestId,activities:f.s.activities.length,events:f.s.operationalEvents?.length||0},before);
 assert.throws(()=>mutate(f.s,f.admin,'acme','prepareShipment',{id:rid}),/already exists/);
 assert.throws(()=>mutate(f.s,f.client,'acme','confirmFulfillment',{id:rid}),/Simulated offers/);
 mutate(f.s,f.admin,'acme','withdrawFulfillment',{id:rid,reason:'End simulation'});
 assert.equal(record.shipmentPreparation,undefined);
 assert.ok(f.s.audit.some(e=>e.action==='SHIPMENT_PREPARATION_DRAFTED'&&e.entityId===rid));
});

test('live shipment preparation rejects unverified packaging and changed destinations',()=>{
 const f=basic(); receive(f);
 const spare=f.s.equipment[1];
 const rid=mutate(f.s,f.client,'acme','request',{equipmentId:f.s.equipment[0].id,type:'RECOVERY',scope:'Live preparation controls'});
 const rateId=mutate(f.s,f.admin,'acme','rate',{name:'Handling',category:'DISPATCH',unit:'each',cents:2500,version:'TEST'});
 mutate(f.s,f.client,'acme','approveRate',{id:rateId});
 mutate(f.s,f.admin,'acme','prepareFulfillment',{id:rid,spareId:spare.id,handlingRateId:rateId,shippingCents:1000,shippingSource:'TEST rate',serviceLevel:'Ground',offerMode:'LIVE'});
 assert.throws(()=>mutate(f.s,f.admin,'acme','prepareShipment',{id:rid}),/complete package profile/);
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'CARTON-LIVE',packaging:'Test',lengthCm:40,widthCm:25,heightCm:15,weightKg:4,measurementStatus:'CUSTOMER_DECLARED'});
 assert.throws(()=>mutate(f.s,f.admin,'acme','prepareShipment',{id:rid}),/CESCo-verified/);
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'CARTON-LIVE',packaging:'Measured',lengthCm:40,widthCm:25,heightCm:15,weightKg:4,measurementStatus:'CESCO_VERIFIED'});
 f.s.endpoints[0].addressLine1='Changed address';
 assert.throws(()=>mutate(f.s,f.admin,'acme','prepareShipment',{id:rid}),/destination changed/);
 assert.equal(f.s.requests[0].shipmentPreparation,undefined);
});

test('simulated preparation can be reviewed but not release-authorized or dispatched', () => {
 const f=basic(); receive(f);
 const spare=f.s.equipment[1];
 const rid=mutate(f.s,f.client,'acme','request',{equipmentId:f.s.equipment[0].id,type:'RECOVERY',scope:'Simulated shipment review'});
 const rateId=mutate(f.s,f.admin,'acme','rate',{name:'Handling',category:'DISPATCH',unit:'each',cents:2500,version:'DEMO'});
 mutate(f.s,f.client,'acme','approveRate',{id:rateId});
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'SIM-PKG',packaging:'Simulated carton',lengthCm:45,widthCm:30,heightCm:20,weightKg:5.25,measurementStatus:'SIMULATED'});
 mutate(f.s,f.admin,'acme','prepareFulfillment',{id:rid,spareId:spare.id,handlingRateId:rateId,shippingCents:5000,shippingSource:'Simulated rate',serviceLevel:'Overnight',offerMode:'SIMULATED'});
 mutate(f.s,f.admin,'acme','prepareShipment',{id:rid});
 mutate(f.s,f.admin,'acme','reviewShipment',{id:rid,notes:'Simulation: package and endpoint observed in demo'});
 const r=f.s.requests.find(x=>x.id===rid)!;
 assert.equal(r.shipmentPreparation?.state,'REVIEWED');
 assert.throws(()=>mutate(f.s,f.admin,'acme','authorizeShipmentRelease',{id:rid}),/Simulated or legacy/);
 assert.throws(()=>mutate(f.s,f.admin,'acme','reviewShipment',{id:rid,notes:'review again'}),/draft shipment/);
 assert.equal(spare.status,'READY');
 assert.equal(spare.custodian,'CESCo');
 assert.equal(r.authorizedAt,null);
 assert.ok(f.s.audit.some(x=>x.action==='SHIPMENT_PREPARATION_REVIEWED'&&x.entityId===rid));
});

test('reviewed simulated shipment revision preserves audit, resets review and has no physical or financial effects',()=>{
 const f=basic(); receive(f);
 const spare=f.s.equipment[1];
 const rid=mutate(f.s,f.client,'acme','request',{equipmentId:f.s.equipment[0].id,type:'RECOVERY',scope:'Revision scenario'});
 const rateId=mutate(f.s,f.admin,'acme','rate',{name:'Handling',category:'DISPATCH',unit:'each',cents:2500,version:'DEMO'});
 mutate(f.s,f.client,'acme','approveRate',{id:rateId});
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'CARTON-A',packaging:'Simulated first carton',lengthCm:45,widthCm:30,heightCm:20,weightKg:5.25,measurementStatus:'SIMULATED'});
 mutate(f.s,f.admin,'acme','prepareFulfillment',{id:rid,spareId:spare.id,handlingRateId:rateId,shippingCents:5000,shippingSource:'Simulated rate',serviceLevel:'Overnight',offerMode:'SIMULATED'});
 mutate(f.s,f.admin,'acme','prepareShipment',{id:rid});
 mutate(f.s,f.admin,'acme','reviewShipment',{id:rid,notes:'First carton reviewed'});
 const request=f.s.requests.find(x=>x.id===rid)!;
 const prior=request.shipmentPreparation!;
 const before={custodian:spare.custodian,status:spare.status,requestId:spare.requestId,activities:f.s.activities.length};
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'CARTON-B',packaging:'Replacement carton',lengthCm:50,widthCm:35,heightCm:25,weightKg:6,measurementStatus:'SIMULATED'});
 assert.equal(request.shipmentPreparation?.state,'STALE');
 assert.ok(f.s.audit.some(x=>x.action==='SHIPMENT_PREPARATION_STALE'&&x.entityId===rid));
 assert.throws(()=>mutate(f.s,f.admin,'acme','reviewShipment',{id:rid,notes:'Invalid repeat'}),/draft shipment/);
 mutate(f.s,f.admin,'acme','reviseShipment',{id:rid,reason:'Damaged carton replaced'});
 assert.equal(request.shipmentPreparation?.state,'DRAFT');
 assert.equal(request.shipmentPreparation?.packageId,'CARTON-B');
 assert.equal(request.shipmentPreparation?.reviewedAt,undefined);
 assert.notEqual(request.shipmentPreparation?.id,prior.id);
 const revision=f.s.audit.find(x=>x.action==='SHIPMENT_PREPARATION_SUPERSEDED'&&x.entityId===rid);
 assert.ok(revision);
 assert.equal(JSON.parse(revision.detail).previous.reviewNotes,'First carton reviewed');
 assert.equal(JSON.parse(revision.detail).previous.packageId,'CARTON-A');
 assert.deepEqual({custodian:spare.custodian,status:spare.status,requestId:spare.requestId,activities:f.s.activities.length},before);
 mutate(f.s,f.admin,'acme','reviewShipment',{id:rid,notes:'Second carton reviewed'});
 assert.equal(request.shipmentPreparation?.state,'REVIEWED');
 assert.throws(()=>mutate(f.s,f.admin,'acme','authorizeShipmentRelease',{id:rid}),/Simulated or legacy/);
});

test('retiring handling agreement blocks shipment review without changing draft or inventory',()=>{
 const f=basic(); receive(f);
 const spare=f.s.equipment[1];
 const rid=mutate(f.s,f.client,'acme','request',{equipmentId:f.s.equipment[0].id,type:'RECOVERY',scope:'Agreement retirement validation'});
 const rateId=mutate(f.s,f.admin,'acme','rate',{name:'Depot handling',category:'DISPATCH',unit:'each',cents:2500,version:'DEMO-REVIEW'});
 mutate(f.s,f.client,'acme','approveRate',{id:rateId});
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'TEST-CARTON',packaging:'Simulated carton',lengthCm:45,widthCm:30,heightCm:20,weightKg:5.25,measurementStatus:'SIMULATED'});
 mutate(f.s,f.admin,'acme','prepareFulfillment',{id:rid,spareId:spare.id,handlingRateId:rateId,shippingCents:5000,shippingSource:'Simulated estimate',serviceLevel:'Overnight',offerMode:'SIMULATED'});
 mutate(f.s,f.admin,'acme','prepareShipment',{id:rid});
 const request=f.s.requests.find(x=>x.id===rid)!;
 const originalPreparation=structuredClone(request.shipmentPreparation);
 const originalEquipment={status:spare.status,custodian:spare.custodian,requestId:spare.requestId};
 mutate(f.s,f.admin,'acme','retireRate',{id:rateId,reason:'Superseded standing agreement'});
 assert.throws(()=>mutate(f.s,f.admin,'acme','reviewShipment',{id:rid,notes:'Should not be accepted'}),/Standing handling agreement changed/);
 assert.deepEqual(request.shipmentPreparation,originalPreparation);
 assert.deepEqual({status:spare.status,custodian:spare.custodian,requestId:spare.requestId},originalEquipment);
 assert.equal(f.s.activities.length,0);
});

function liveShipmentFixture() {
 const f=basic(); receive(f);
 const spare=f.s.equipment[1], target=f.s.equipment[0];
 const reviewer: User={id:'reviewer',orgId:'internal',name:'Reviewer',email:'reviewer@example.com',password:'',role:'SYSTEM_ADMIN'};
 f.s.users.push(reviewer);
 const rid=mutate(f.s,f.client,'acme','request',{equipmentId:target.id,type:'RECOVERY',scope:'Controlled live shipping regression'});
 const rateId=mutate(f.s,f.admin,'acme','rate',{name:'Pick pack dispatch',category:'DISPATCH',unit:'each',cents:2500,version:'LIVE-TEST'});
 mutate(f.s,f.client,'acme','approveRate',{id:rateId});
 mutate(f.s,f.admin,'acme','setPackageProfile',{id:spare.id,packageId:'LIVE-CARTON',packaging:'Verified test carton',lengthCm:45,widthCm:30,heightCm:20,weightKg:5.25,measurementStatus:'CESCO_VERIFIED'});
 mutate(f.s,f.admin,'acme','prepareFulfillment',{id:rid,spareId:spare.id,handlingRateId:rateId,shippingCents:5000,shippingSource:'TEST carrier rate',serviceLevel:'Overnight',offerMode:'LIVE'});
 mutate(f.s,f.admin,'acme','prepareShipment',{id:rid});
 mutate(f.s,f.admin,'acme','reviewShipment',{id:rid,notes:'Verified live-test package and destination'});
 mutate(f.s,f.client,'acme','confirmFulfillment',{id:rid});
 assert.throws(()=>mutate(f.s,f.admin,'acme','authorizeShipmentRelease',{id:rid}),/independent operator/);
 mutate(f.s,reviewer,'acme','authorizeShipmentRelease',{id:rid});
 mutate(f.s,f.admin,'acme','reserve',{id:rid,spareId:spare.id});
 return {...f,rid,rateId,spare,reviewer};
}
function addCarrierProof(f: ReturnType<typeof liveShipmentFixture>) {
 const eid=id();
 f.s.evidence.push({id:eid,orgId:'acme',entityId:f.rid,name:'carrier-acceptance.pdf',sha256:'test-sha256',key:'test-key',size:100,mime:'application/pdf',actor:f.admin.email,at:new Date().toISOString(),description:'Test carrier acceptance receipt',category:'DISPATCH'});
 return eid;
}
function labelAndTender(f: ReturnType<typeof liveShipmentFixture>) {
 mutate(f.s,f.admin,'acme','recordShippingLabel',{id:f.rid,carrier:'Test carrier',service:'Overnight',tracking:'TEST-TRACKING',labelReference:'TEST-LABEL',rateReference:'TEST-RATE'});
 mutate(f.s,f.admin,'acme','markTenderReady',{id:f.rid,observedTracking:'TEST-TRACKING',evidenceReference:'TEST-LABEL-PHOTO'});
}
test('live fulfillment requires independent release authorization and permits validated dispatch',()=>{
 const f=liveShipmentFixture();
 const r=f.s.requests.find(x=>x.id===f.rid)!;
 assert.equal(r.shipmentPreparation?.state,'RELEASE_AUTHORIZED');
 assert.equal(f.spare.status,'RESERVED');
 mutate(f.s,f.admin,'acme','pickPack',{id:f.rid,observedSerial:f.spare.serial,packageId:'LIVE-CARTON',stagingLocation:'Outbound bench A',condition:'Carton sealed, equipment checked',evidenceReference:'TEST-PHOTO-001'});
 labelAndTender(f);
 mutate(f.s,f.admin,'acme','dispatch',{id:f.rid,tracking:'TEST-TRACKING',etaHours:24,custodian:'Test carrier',acceptedBy:'Test courier agent',evidenceId:addCarrierProof(f)});
 assert.equal(r.status,'DISPATCHED');
 assert.equal(f.spare.status,'OUTBOUND');
 assert.equal(f.spare.custodian,'Test carrier');
 assert.ok(f.s.audit.some(x=>x.action==='SHIPMENT_RELEASE_AUTHORIZED'&&x.entityId===f.rid));
});
for(const changed of ['destination','package','agreement','position']) {
 test('dispatch refuses changed '+changed+' after release authorization without custody change',()=>{
  const f=liveShipmentFixture();
  const request=f.s.requests.find(x=>x.id===f.rid)!;
  const before={status:f.spare.status,custodian:f.spare.custodian,requestStatus:request.status,tracking:request.tracking};
  mutate(f.s,f.admin,'acme','pickPack',{id:f.rid,observedSerial:f.spare.serial,packageId:'LIVE-CARTON',stagingLocation:'Outbound bench A',condition:'Carton sealed',evidenceReference:'TEST-PHOTO-002'});
  labelAndTender(f);
  if(changed==='destination') f.s.endpoints[0].addressLine1='Alternate destination';
  if(changed==='package') f.spare.packageProfile!.weightKg=8;
  if(changed==='agreement') mutate(f.s,f.admin,'acme','retireRate',{id:f.rateId,reason:'Agreement superseded'});
  if(changed==='position') f.spare.position='B-2';
  assert.throws(()=>mutate(f.s,f.admin,'acme','dispatch',{id:f.rid,tracking:'TEST-TRACKING',etaHours:24,custodian:'Test carrier',acceptedBy:'Test courier agent',evidenceId:addCarrierProof(f)}),/changed|reauthorize|Verified pick and pack is required/);
  assert.deepEqual({status:f.spare.status,custodian:f.spare.custodian,requestStatus:request.status,tracking:request.tracking},before);
 });
}

test('live dispatch rejects missing pick and pack record without custody transfer',()=>{
 const f=liveShipmentFixture();
 const request=f.s.requests.find(x=>x.id===f.rid)!;
 assert.throws(()=>mutate(f.s,f.admin,'acme','dispatch',{id:f.rid,tracking:'NO-HANDOFF',etaHours:24,custodian:'Carrier'}),/label and tender readiness/);
 assert.equal(request.status,'RESERVED');
 assert.equal(f.spare.custodian,'CESCo');
 assert.equal(request.tracking,'');
});
test('pick and pack validates physical identity, evidence, and is idempotency-protected',()=>{
 const f=liveShipmentFixture();
 const details={id:f.rid,observedSerial:f.spare.serial,packageId:'LIVE-CARTON',stagingLocation:'Outbound A',condition:'Sealed carton intact',evidenceReference:'PHOTO-100'};
 assert.throws(()=>mutate(f.s,f.admin,'acme','pickPack',{...details,observedSerial:'WRONG'}),/serial does not match/);
 assert.throws(()=>mutate(f.s,f.admin,'acme','pickPack',{...details,packageId:'WRONG'}),/package does not match/);
 assert.equal(f.s.requests.find(x=>x.id===f.rid)?.pickPack,undefined);
 mutate(f.s,f.admin,'acme','pickPack',details);
 const r=f.s.requests.find(x=>x.id===f.rid)!;
 assert.equal(r.pickPack?.evidenceReference,'PHOTO-100');
 assert.equal(f.spare.custodian,'CESCo');
 assert.equal(r.status,'RESERVED');
 assert.throws(()=>mutate(f.s,f.admin,'acme','pickPack',details),/already recorded/);
});

test('training-only live fixture isolates fictional shipment and exercises pick-pack in portal workflow',()=>{
 const f=basic();
 const existing={organizations:f.s.organizations.length,requests:f.s.requests.length,equipment:f.s.equipment.length,activities:f.s.activities.length};
 const demoId=mutate(f.s,f.admin,'acme','seedLiveDemo',{});
 const demo=f.s.organizations.find(x=>x.id===demoId)!;
 const request=f.s.requests.find(x=>x.orgId===demoId)!;
 const spare=f.s.equipment.find(x=>x.id===request.spareId)!;
 assert.equal(demo.demo,true);
 assert.equal(request.status,'RESERVED');
 assert.equal(request.shipmentPreparation?.state,'RELEASE_AUTHORIZED');
 assert.equal(request.fulfillment?.offerMode,'LIVE');
 assert.equal(f.s.organizations.length,existing.organizations+1);
 assert.equal(f.s.requests.length,existing.requests+1);
 assert.equal(f.s.equipment.length,existing.equipment+2);
 assert.equal(f.s.activities.length,existing.activities);
 assert.throws(()=>mutate(f.s,f.admin,'acme','seedLiveDemo',{}),/already exists/);
 assert.throws(()=>mutate(f.s,f.client,'acme','seedLiveDemo',{}),/Only a system administrator/);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'dispatch',{id:request.id,tracking:'NO',etaHours:12,custodian:'Carrier'}),/TRAINING ONLY/);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'invoice',{}),/TRAINING ONLY/);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'activity',{requestId:request.id}),/TRAINING ONLY/);
 assert.equal(request.pickPack,undefined);
 mutate(f.s,f.admin,demoId,'pickPack',{id:request.id,observedSerial:spare.serial,packageId:'TRAINING-CARTON-001',stagingLocation:'TRAINING staging shelf',condition:'Fictional sealed carton',evidenceReference:'TRAINING-PHOTO-001'});
 assert.equal(f.s.requests.find(x=>x.id===request.id)?.pickPack?.evidenceReference,'TRAINING-PHOTO-001');
 assert.equal(request.status,'RESERVED');
 assert.equal(spare.custodian,'CESCo');
 assert.equal(f.s.activities.length,existing.activities);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'dispatch',{id:request.id,tracking:'NO',etaHours:12,custodian:'Carrier'}),/TRAINING ONLY/);
});

test('label and tender are separate auditable events that cannot transfer custody',()=>{
 const f=liveShipmentFixture(), r=f.s.requests.find(x=>x.id===f.rid)!;
 mutate(f.s,f.admin,'acme','pickPack',{id:f.rid,observedSerial:f.spare.serial,packageId:'LIVE-CARTON',stagingLocation:'Outbound A',condition:'Intact',evidenceReference:'PACK-EVIDENCE'});
 assert.throws(()=>mutate(f.s,f.admin,'acme','markTenderReady',{id:f.rid,observedTracking:'TEST-TRACKING',evidenceReference:'READY-EVIDENCE'}),/label/);
 assert.throws(()=>mutate(f.s,f.admin,'acme','recordShippingLabel',{id:f.rid,carrier:'Carrier',service:'Incorrect',tracking:'TEST-TRACKING',labelReference:'LABEL',rateReference:'RATE'}),/service differs/);
 labelAndTender(f);
 assert.equal(r.shippingLabel?.tracking,'TEST-TRACKING');
 assert.equal(r.tenderReady?.tracking,'TEST-TRACKING');
 assert.equal(r.carrierHandoff,undefined);
 assert.equal(r.status,'RESERVED');
 assert.equal(f.spare.custodian,'CESCo');
 assert.equal(f.s.activities.length,0);
 assert.throws(()=>mutate(f.s,f.admin,'acme','recordShippingLabel',{id:f.rid}),/already recorded/);
 assert.throws(()=>mutate(f.s,f.admin,'acme','markTenderReady',{id:f.rid}),/already recorded/);
 assert.throws(()=>mutate(f.s,f.admin,'acme','dispatch',{id:f.rid,tracking:'WRONG',etaHours:24,custodian:'Test carrier',acceptedBy:'Agent',evidenceId:addCarrierProof(f)}),/tracking does not match/);
 assert.equal(r.status,'RESERVED');
});
test('training account may rehearse label and tender but never carrier handoff',()=>{
 const f=basic(), demoId=mutate(f.s,f.admin,'acme','seedLiveDemo',{});
 const r=f.s.requests.find(x=>x.orgId===demoId)!;
 const spare=f.s.equipment.find(x=>x.id===r.spareId)!;
 mutate(f.s,f.admin,demoId,'pickPack',{id:r.id,observedSerial:spare.serial,packageId:'TRAINING-CARTON-001',stagingLocation:'Training shelf',condition:'Simulated',evidenceReference:'TRAIN-PHOTO'});
 mutate(f.s,f.admin,demoId,'recordShippingLabel',{id:r.id,carrier:'TRAINING COURIER',service:'TRAINING-OVERNIGHT',tracking:'TRAINING-TRACK',labelReference:'TRAINING-LABEL',rateReference:'NO-CHARGE'});
 mutate(f.s,f.admin,demoId,'markTenderReady',{id:r.id,observedTracking:'TRAINING-TRACK',evidenceReference:'TRAINING-TENDER'});
 assert.equal(r.status,'RESERVED');
 assert.equal(spare.custodian,'CESCo');
 assert.throws(()=>mutate(f.s,f.admin,demoId,'dispatch',{id:r.id,tracking:'TRAINING-TRACK',etaHours:24,custodian:'Carrier',acceptedBy:'Agent',evidenceId:'TRAINING-FAKE-PROOF'}),/TRAINING ONLY/);
});

test('live carrier acceptance needs uploaded request-linked dispatch evidence and matching carrier',()=>{
 const f=liveShipmentFixture();
 mutate(f.s,f.admin,'acme','pickPack',{id:f.rid,observedSerial:f.spare.serial,packageId:'LIVE-CARTON',stagingLocation:'Outbound',condition:'Verified',evidenceReference:'PICK-PROOF'});
 labelAndTender(f);
 const request=f.s.requests.find(x=>x.id===f.rid)!;
 const original={status:request.status,custodian:f.spare.custodian};
 const args={id:f.rid,tracking:'TEST-TRACKING',etaHours:24,custodian:'Test carrier',acceptedBy:'Test courier agent'};
 assert.throws(()=>mutate(f.s,f.admin,'acme','dispatch',{...args,evidenceId:'NONEXISTENT'}),/Record not found/);
 const eid=addCarrierProof(f);
 assert.throws(()=>mutate(f.s,f.admin,'acme','dispatch',{...args,custodian:'Wrong carrier',evidenceId:eid}),/must match recorded shipping label/);
 f.s.evidence.find(x=>x.id===eid)!.category='OTHER';
 assert.throws(()=>mutate(f.s,f.admin,'acme','dispatch',{...args,evidenceId:eid}),/uploaded dispatch or receipt evidence/);
 f.s.evidence.find(x=>x.id===eid)!.category='DISPATCH';
 f.s.evidence.find(x=>x.id===eid)!.entityId=f.s.equipment[0].id;
 assert.throws(()=>mutate(f.s,f.admin,'acme','dispatch',{...args,evidenceId:eid}),/uploaded dispatch or receipt evidence/);
 assert.deepEqual({status:request.status,custodian:f.spare.custodian},original);
});

test('delivery does not establish installation or failed-unit return eligibility',()=>{
 const f=basic();receive(f);const rid=authorize(f), spare=f.s.equipment[1], failed=f.s.equipment[0], previousFailedStatus=failed.status;
 mutate(f.s,f.admin,'acme','reserve',{id:rid,spareId:spare.id});
 mutate(f.s,f.admin,'acme','dispatch',{id:rid,tracking:'DELIVERY-TRACK',custodian:'Courier',etaHours:12});
 mutate(f.s,f.admin,'acme','deliver',{id:rid,recipient:'Store manager',reference:'POD-001',notes:'Delivered intact'});
 const request=f.s.requests.find(x=>x.id===rid)!;
 assert.equal(request.status,'DELIVERED');
 assert.equal(spare.status,'DELIVERED_PENDING_INSTALLATION');
 assert.equal(spare.purpose,'SPARE');
 assert.equal(spare.custodian,'Client');
 assert.equal(failed.purpose,'SUPPORTED');
 assert.equal(failed.status,previousFailedStatus);
 assert.throws(()=>mutate(f.s,f.admin,'acme','complete',{id:rid,notes:'Not installed'}),/requires verified installation/);
 assert.throws(()=>mutate(f.s,f.admin,'acme','return',{id:rid,location:'Depot',position:'Bench'}),/Return authorization and recorded inbound shipment are required/);
 assert.throws(()=>mutate(f.s,f.admin,'acme','confirmInstallation',{id:rid,technician:'Field tech',notes:'Validated',evidenceId:'MISSING'}),/Record not found/);
 const eid=id();f.s.evidence.push({id:eid,orgId:'acme',entityId:spare.id,name:'wrong-link.jpg',sha256:'test-sha256',key:'test-file',size:123,mime:'image/jpeg',actor:f.admin.email,at:new Date().toISOString(),description:'Evidence',category:'INSTALLATION_AFTER'});
 assert.throws(()=>mutate(f.s,f.admin,'acme','confirmInstallation',{id:rid,technician:'Field tech',notes:'Validated',evidenceId:eid}),/attached to this request/);
 f.s.evidence.find(x=>x.id===eid)!.entityId=rid;
 mutate(f.s,f.admin,'acme','confirmInstallation',{id:rid,technician:'Field tech',notes:'Power, networking and application validated',evidenceId:eid});
 assert.equal(request.status,'INSTALLED');
 assert.equal(spare.status,'INSTALLED');
 assert.equal(spare.purpose,'SUPPORTED');
 assert.equal(failed.status,'RETURN_PENDING');
 assert.equal(failed.purpose,'SPARE');
 assert.throws(()=>mutate(f.s,f.admin,'acme','confirmInstallation',{id:rid,technician:'Other',notes:'Again',evidenceId:eid}),/Carrier delivery must be recorded/);
 assert.ok(f.s.operationalEvents?.some(e=>e.type==='DELIVERY_RECORDED'&&e.requestId===rid));
 assert.ok(f.s.operationalEvents?.some(e=>e.type==='INSTALLATION_CONFIRMED'&&e.requestId===rid));
});

test('isolated training delivery can be recorded without installing, charging or enabling physical return',()=>{
 const f=basic(), demoId=mutate(f.s,f.admin,'acme','seedLiveDemo',{});
 const existingRequest=f.s.requests.find(x=>x.orgId===demoId)!;
 const previousActivities=f.s.activities.length;
 const rid=mutate(f.s,f.admin,demoId,'seedDeliveryDemo',{});
 assert.throws(()=>mutate(f.s,f.admin,demoId,'seedDeliveryDemo',{}),/already exists/);
 const r=f.s.requests.find(x=>x.id===rid)!;
 const spare=f.s.equipment.find(x=>x.id===r.spareId)!;
 const target=f.s.equipment.find(x=>x.id===r.equipmentId)!;
 assert.equal(r.status,'DISPATCHED');
 assert.equal(spare.custodian,'TRAINING COURIER');
 assert.equal(existingRequest.status,'RESERVED');
 assert.throws(()=>mutate(f.s,f.admin,demoId,'confirmInstallation',{id:rid}),/Carrier delivery must be recorded/);
 mutate(f.s,f.admin,demoId,'deliver',{id:rid,recipient:'Fictional site manager',reference:'TRAINING-POD',notes:'Synthetic receipt'});
 assert.equal(r.status,'DELIVERED');
 assert.equal(spare.status,'DELIVERED_PENDING_INSTALLATION');
 assert.equal(spare.purpose,'SPARE');
 assert.equal(target.purpose,'SUPPORTED');
 assert.equal(f.s.activities.length,previousActivities);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'return',{id:rid,location:'Depot',position:'A'}),/Return authorization and recorded inbound shipment/);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'invoice',{}),/TRAINING ONLY/);
 const eid=id(); f.s.evidence.push({id:eid,orgId:demoId,entityId:rid,name:'fictional-installation-result.txt',sha256:'training-hash',key:'training-key',size:50,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Synthetic field functional check',category:'TEST_RESULT'});
 mutate(f.s,f.admin,demoId,'confirmInstallation',{id:rid,technician:'TRAINING CLIENT TECH',notes:'Fictional functional validation',evidenceId:eid});
 assert.equal(r.status,'INSTALLED');
 assert.equal(spare.purpose,'SUPPORTED');
 assert.equal(target.status,'RETURN_PENDING');
 assert.equal(existingRequest.status,'RESERVED');
 assert.equal(f.s.activities.length,previousActivities);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'complete',{id:rid,notes:'No actual fulfillment'}),/TRAINING ONLY/);
 assert.throws(()=>mutate(f.s,f.admin,demoId,'dispatch',{id:existingRequest.id}),/TRAINING ONLY/);
});

test('failed return authorization and inbound custody precede evidence-backed depot receiving',()=>{
 const f=basic(); receive(f); const rid=authorize(f),spare=f.s.equipment[1],failed=f.s.equipment[0],admin=f.admin;
 mutate(f.s,admin,'acme','reserve',{id:rid,spareId:spare.id});
 mutate(f.s,admin,'acme','dispatch',{id:rid,tracking:'OUTBOUND',custodian:'Outgoing carrier',etaHours:12});
 mutate(f.s,admin,'acme','deliver',{id:rid,recipient:'Client',reference:'POD',notes:'Delivered'});
 const installationProof=id();f.s.evidence.push({id:installationProof,orgId:'acme',entityId:rid,name:'installed.pdf',sha256:'installation-hash',key:'installation-key',size:100,mime:'application/pdf',actor:admin.email,at:new Date().toISOString(),description:'Validation',category:'TEST_RESULT'});
 mutate(f.s,admin,'acme','confirmInstallation',{id:rid,technician:'Client installer',notes:'Service restored',evidenceId:installationProof});
 assert.throws(()=>mutate(f.s,admin,'acme','return',{id:rid,observedSerial:failed.serial,condition:'Broken',location:'Indy',position:'Quarantine',evidenceId:installationProof}),/authorization and recorded inbound shipment/);
 mutate(f.s,admin,'acme','complete',{id:rid,notes:'Recovery confirmed, failed unit return outstanding'}); assert.equal(f.s.requests.find(x=>x.id===rid)?.status,'COMPLETED');
 assert.equal(operationsMetrics(f.s,'acme').pendingReturns,1);
 mutate(f.s,admin,'acme','authorizeFailedReturn',{id:rid,reference:'RMA-004',destination:'CESCo Indy',instructions:'Label and package the failed unit'});
 assert.equal(failed.custodian,'Client');
 assert.throws(()=>mutate(f.s,admin,'acme','authorizeFailedReturn',{id:rid,reference:'RMA-005',destination:'CESCo',instructions:'Repeat'}),/already authorized/);
 mutate(f.s,admin,'acme','recordFailedReturnShipment',{id:rid,carrier:'Incoming carrier',tracking:'IN-004',shipper:'Client site'});
 assert.equal(failed.status,'RETURN_IN_TRANSIT');
 assert.equal(failed.custodian,'Incoming carrier');
 assert.equal(f.s.requests.find(x=>x.id===rid)?.status,'COMPLETED');
 assert.throws(()=>mutate(f.s,admin,'acme','return',{id:rid,observedSerial:'WRONG',condition:'Damaged',location:'Indy',position:'Q-1',evidenceId:installationProof}),/Observed serial does not match/);
 assert.equal(failed.custodian,'Incoming carrier');
 const receiptId=id();f.s.evidence.push({id:receiptId,orgId:'acme',entityId:rid,name:'return-receipt.pdf',sha256:'receipt-hash',key:'receipt-key',size:100,mime:'application/pdf',actor:admin.email,at:new Date().toISOString(),description:'Received serial and condition',category:'RECEIPT'});
 mutate(f.s,admin,'acme','return',{id:rid,observedSerial:failed.serial,condition:'Failed, requires assessment',location:'Indy',position:'Q-1',evidenceId:receiptId});
 assert.equal(failed.status,'RETURNED');
 assert.equal(failed.custodian,'CESCo');
 assert.equal(failed.condition,'FAILED');
 assert.equal(f.s.requests.find(x=>x.id===rid)?.status,'COMPLETED');
 assert.equal(operationsMetrics(f.s,'acme').pendingReturns,0);
 assert.throws(()=>mutate(f.s,admin,'acme','verify',{id:failed.id,configuration:failed.configuration,validDays:30,notes:'Not repaired'}),/Recovered failed equipment requires independent post-repair verification/);
 assert.throws(()=>mutate(f.s,admin,'acme','return',{id:rid,observedSerial:failed.serial,condition:'Again',location:'Indy',position:'Q-1',evidenceId:receiptId}),/Failed-unit receipt already recorded/);
});

test('isolated training return rehearsal retains fictional custody and never bills or restocks',()=>{
 const f=basic(),orgId=mutate(f.s,f.admin,'acme','seedLiveDemo',{}),rid=mutate(f.s,f.admin,orgId,'seedDeliveryDemo',{});
 const r=f.s.requests.find(x=>x.id===rid)!,failed=f.s.equipment.find(x=>x.id===r.equipmentId)!;
 mutate(f.s,f.admin,orgId,'deliver',{id:rid,recipient:'Training manager',reference:'TRAIN-POD',notes:'Synthetic delivery'});
 const installEvidence=id();f.s.evidence.push({id:installEvidence,orgId,entityId:rid,name:'fictional-functional-check.txt',sha256:'training-install',key:'training-install',size:25,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Synthetic install',category:'TEST_RESULT'});
 mutate(f.s,f.admin,orgId,'confirmInstallation',{id:rid,technician:'Training technician',notes:'Simulated',evidenceId:installEvidence});
 mutate(f.s,f.admin,orgId,'authorizeFailedReturn',{id:rid,reference:'TRAIN-RMA',destination:'TRAINING DEPOT',instructions:'Fictional return only'});
 assert.equal(failed.custodian,'Client');
 mutate(f.s,f.admin,orgId,'recordFailedReturnShipment',{id:rid,carrier:'TRAINING COURIER',tracking:'TRAIN-INBOUND',shipper:'TRAINING SITE'});
 assert.equal(failed.status,'RETURN_IN_TRANSIT');
 const proof=id();f.s.evidence.push({id:proof,orgId,entityId:rid,name:'fictional-return-receipt.txt',sha256:'training-return',key:'training-return',size:40,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Synthetic receipt',category:'RECEIPT'});
 mutate(f.s,f.admin,orgId,'return',{id:rid,observedSerial:failed.serial,condition:'Synthetic failed unit',location:'TRAINING DEPOT',position:'QUARANTINE-A',evidenceId:proof});
 assert.equal(r.status,'RETURNED');
 assert.equal(failed.condition,'FAILED');
 assert.equal(failed.status,'RETURNED');
 assert.throws(()=>mutate(f.s,f.admin,orgId,'repair',{id:failed.id,notes:'Test'}),/TRAINING ONLY/);
 assert.throws(()=>mutate(f.s,f.admin,orgId,'invoice',{}),/TRAINING ONLY/);
 assert.equal(f.s.activities.filter(x=>x.orgId===orgId).length,0);
});

test('technical assessment is evidence-linked, does not authorize treatment, and leaves training stock unavailable',()=>{
 const f=basic(),orgId=mutate(f.s,f.admin,'acme','seedLiveDemo',{}),rid=mutate(f.s,f.admin,orgId,'seedDeliveryDemo',{});
 const r=f.s.requests.find(x=>x.id===rid)!,failed=f.s.equipment.find(x=>x.id===r.equipmentId)!;
 assert.throws(()=>mutate(f.s,f.admin,orgId,'assessFailedUnit',{id:rid}),/Physical return receipt/);
 mutate(f.s,f.admin,orgId,'deliver',{id:rid,recipient:'Training manager',reference:'TRAIN-POD',notes:'Synthetic'});
 const i=id();f.s.evidence.push({id:i,orgId,entityId:rid,name:'installation.txt',sha256:'install',key:'install',size:20,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Training',category:'TEST_RESULT'});
 mutate(f.s,f.admin,orgId,'confirmInstallation',{id:rid,technician:'Training',notes:'Simulated validation',evidenceId:i});
 mutate(f.s,f.admin,orgId,'authorizeFailedReturn',{id:rid,reference:'TRAIN-RMA',destination:'Training depot',instructions:'Simulation'});
 mutate(f.s,f.admin,orgId,'recordFailedReturnShipment',{id:rid,carrier:'TRAINING COURIER',tracking:'IN',shipper:'Training manager'});
 const receipt=id();f.s.evidence.push({id:receipt,orgId,entityId:rid,name:'receipt.txt',sha256:'receipt',key:'receipt',size:20,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Training',category:'RECEIPT'});
 mutate(f.s,f.admin,orgId,'return',{id:rid,observedSerial:failed.serial,condition:'Failed unit',location:'Training depot',position:'Q-1',evidenceId:receipt});
 assert.throws(()=>mutate(f.s,f.admin,orgId,'assessFailedUnit',{id:rid,diagnosis:'Failed',warranty:'Unknown',feasibility:'Unknown',estimatedCostCents:0,estimatedDays:0,recommendation:'REPAIR',notes:'Training',evidenceId:receipt}),/diagnostic or condition evidence/);
 const diag=id();f.s.evidence.push({id:diag,orgId,entityId:rid,name:'diagnostic.txt',sha256:'diagnostic',key:'diagnostic',size:20,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Training',category:'TEST_RESULT'});
 mutate(f.s,f.admin,orgId,'assessFailedUnit',{id:rid,diagnosis:'Simulated intermittent boot fault',warranty:'Unverified',feasibility:'Bench investigation possible',estimatedCostCents:0,estimatedDays:5,recommendation:'HOLD',notes:'Await client direction',evidenceId:diag});
 assert.equal(r.technicalAssessment?.recommendation,'HOLD');
 assert.equal(r.technicalAssessment?.approval,undefined);
 assert.equal(failed.status,'RETURNED');
 assert.equal(failed.condition,'FAILED');
 assert.throws(()=>mutate(f.s,f.admin,orgId,'assessFailedUnit',{id:rid,diagnosis:'Duplicate'}),/version is stale/);
 assert.throws(()=>mutate(f.s,f.admin,orgId,'approveFailedTreatment',{id:rid,reference:'CLIENT',notes:'No'}),/TRAINING ONLY/);
 assert.throws(()=>mutate(f.s,f.admin,orgId,'repair',{id:failed.id,notes:'No'}),/TRAINING ONLY/);
});

test('HOLD revision retains the prior assessment, uses new evidence, and preserves genuinely unknown estimates',()=>{
 const f=basic(),orgId=mutate(f.s,f.admin,'acme','seedLiveDemo',{}),rid=mutate(f.s,f.admin,orgId,'seedDeliveryDemo',{});
 const r=f.s.requests.find(x=>x.id===rid)!,failed=f.s.equipment.find(x=>x.id===r.equipmentId)!;
 mutate(f.s,f.admin,orgId,'deliver',{id:rid,recipient:'Training manager',reference:'POD',notes:'Simulated'});
 const installation=id();f.s.evidence.push({id:installation,orgId,entityId:rid,name:'install.txt',sha256:'installhash',key:'install',size:10,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Installation',category:'TEST_RESULT'});
 mutate(f.s,f.admin,orgId,'confirmInstallation',{id:rid,technician:'Training',notes:'Simulated',evidenceId:installation});
 mutate(f.s,f.admin,orgId,'authorizeFailedReturn',{id:rid,reference:'RMA',destination:'Training depot',instructions:'Simulated'});
 mutate(f.s,f.admin,orgId,'recordFailedReturnShipment',{id:rid,carrier:'TRAIN COURIER',tracking:'INBOUND',shipper:'Training manager'});
 const receipt=id();f.s.evidence.push({id:receipt,orgId,entityId:rid,name:'receipt.txt',sha256:'receipthash',key:'receipt',size:10,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Receipt',category:'RECEIPT'});
 mutate(f.s,f.admin,orgId,'return',{id:rid,observedSerial:failed.serial,condition:'Failed',location:'Training depot',position:'Q-1',evidenceId:receipt});
 const input=(evidenceId:string,extras:Record<string,unknown>={})=>({id:rid,diagnosis:'Training-only diagnosis',warranty:'Not determined',feasibility:'Not determined',recommendation:'HOLD',notes:'Await further information',evidenceId,...extras});
 assert.throws(()=>mutate(f.s,f.admin,orgId,'assessFailedUnit',input(installation)),/Installation and receiving evidence cannot substitute/);
 const e1=id();f.s.evidence.push({id:e1,orgId,entityId:rid,name:'diagnostic-1.txt',sha256:'diag1',key:'diag1',size:10,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'First diagnosis',category:'TEST_RESULT'});
 mutate(f.s,f.admin,orgId,'assessFailedUnit',input(e1));
 assert.equal(r.technicalAssessment?.version,1);
 assert.equal(r.technicalAssessment?.estimatedCostCents,null);
 assert.equal(r.technicalAssessment?.estimatedDays,null);
 assert.equal(failed.status,'RETURNED');
 assert.throws(()=>mutate(f.s,f.admin,orgId,'assessFailedUnit',input(e1,{expectedVersion:1})),/different diagnostic evidence/);
 const e2=id();f.s.evidence.push({id:e2,orgId,entityId:rid,name:'diagnostic-2.txt',sha256:'diag2',key:'diag2',size:10,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Further diagnosis',category:'TEST_RESULT'});
 assert.throws(()=>mutate(f.s,f.admin,orgId,'assessFailedUnit',input(e2,{expectedVersion:0})),/version is stale/);
 mutate(f.s,f.admin,orgId,'assessFailedUnit',input(e2,{expectedVersion:1,estimatedCostCents:0,estimatedDays:0,diagnosis:'New result'}));
 assert.equal(r.technicalAssessment?.version,2);
 assert.equal(r.technicalAssessment?.estimatedCostCents,0);
 assert.equal(r.technicalAssessment?.estimatedDays,0);
 assert.equal(r.assessmentHistory?.length,1);
 assert.equal(r.assessmentHistory?.[0].evidenceId,e1);
 assert.equal(r.assessmentHistory?.[0].estimatedCostCents,null);
 assert.equal(r.technicalAssessment?.evidenceId,e2);
 assert.equal(failed.condition,'FAILED');
 assert.equal(failed.status,'RETURNED');
});

test('failed recovery repair cannot enter readiness without authorized work, recorded success and different verifier',()=>{
 const f=basic();receive(f);const rid=authorize(f),spare=f.s.equipment[1],failed=f.s.equipment[0],admin=f.admin;
 mutate(f.s,admin,'acme','reserve',{id:rid,spareId:spare.id});
 mutate(f.s,admin,'acme','dispatch',{id:rid,tracking:'SHIP',custodian:'Outbound',etaHours:1});
 mutate(f.s,admin,'acme','deliver',{id:rid,recipient:'Manager',reference:'POD',notes:'Delivered'});
 const install=id();f.s.evidence.push({id:install,orgId:'acme',entityId:rid,name:'install.txt',sha256:'install',key:'install',size:2,mime:'text/plain',actor:admin.email,at:new Date().toISOString(),description:'Install',category:'TEST_RESULT'});
 mutate(f.s,admin,'acme','confirmInstallation',{id:rid,technician:'Client technician',notes:'Verified installation',evidenceId:install});
 mutate(f.s,admin,'acme','authorizeFailedReturn',{id:rid,reference:'RMA',destination:'Depot',instructions:'Return failed'});
 mutate(f.s,admin,'acme','recordFailedReturnShipment',{id:rid,carrier:'Inbound',tracking:'TRK',shipper:'Site'});
 const receipt=id();f.s.evidence.push({id:receipt,orgId:'acme',entityId:rid,name:'receipt.txt',sha256:'receipt',key:'receipt',size:3,mime:'text/plain',actor:admin.email,at:new Date().toISOString(),description:'Receipt',category:'RECEIPT'});
 mutate(f.s,admin,'acme','return',{id:rid,observedSerial:failed.serial,condition:'Failed',location:'Depot',position:'Q',evidenceId:receipt});
 assert.throws(()=>mutate(f.s,admin,'acme','openRecoveryRepair',{id:rid,workOrder:'W-01'}),/client-authorized REPAIR/);
 const diagnostic=id();f.s.evidence.push({id:diagnostic,orgId:'acme',entityId:rid,name:'diagnostic.txt',sha256:'diagnostic',key:'diagnostic',size:3,mime:'text/plain',actor:admin.email,at:new Date().toISOString(),description:'Diagnostic',category:'TEST_RESULT'});
 mutate(f.s,admin,'acme','assessFailedUnit',{id:rid,diagnosis:'Failed PSU',warranty:'Expired',feasibility:'Replace PSU',estimatedCostCents:5000,estimatedDays:2,recommendation:'REPAIR',notes:'Bench treatment recommended',evidenceId:diagnostic});
 mutate(f.s,admin,'acme','approveFailedTreatment',{id:rid,expectedVersion:1,reference:'AUTH-01',notes:'Client approves scope'});
 mutate(f.s,admin,'acme','openRecoveryRepair',{id:rid,workOrder:'W-01'});
 assert.throws(()=>mutate(f.s,admin,'acme','openRecoveryRepair',{id:rid,workOrder:'W-02'}),/already opened/);
 assert.equal(failed.condition,'FAILED');
 assert.throws(()=>mutate(f.s,admin,'acme','verifyRecoveryRepair',{id:rid,configuration:'v1',validDays:30,notes:'Too early'}),/Successful repair record/);
 const evidence=id();f.s.evidence.push({id:evidence,orgId:'acme',entityId:rid,name:'repair.txt',sha256:'repair',key:'repair',size:3,mime:'text/plain',actor:admin.email,at:new Date().toISOString(),description:'Work result',category:'TEST_RESULT'});
 mutate(f.s,admin,'acme','recordRecoveryRepairResult',{id:rid,outcome:'UNSUCCESSFUL',notes:'Repair attempt did not resolve boot fault',evidenceId:evidence});
 assert.equal(failed.status,'REPAIR_FAILED');
 assert.equal(failed.condition,'FAILED');
 assert.throws(()=>mutate(f.s,admin,'acme','verifyRecoveryRepair',{id:rid,configuration:'v1',validDays:30,notes:'Must not pass',evidenceId:evidence}),/Successful repair record/);
 assert.throws(()=>mutate(f.s,admin,'acme','restock',{id:failed.id}),/Repair and test/);
});

test('fictional repair approval is version-bound, spending-capped and never changes stock or invoices',()=>{
 const f=basic(),org=mutate(f.s,f.admin,'acme','seedLiveDemo',{}),rid=mutate(f.s,f.admin,org,'seedDeliveryDemo',{});
 const r=f.s.requests.find(x=>x.id===rid)!,failed=f.s.equipment.find(x=>x.id===r.equipmentId)!;
 mutate(f.s,f.admin,org,'deliver',{id:rid,recipient:'Training manager',reference:'POD',notes:'Synthetic'});
 const i=id();f.s.evidence.push({id:i,orgId:org,entityId:rid,name:'install.txt',sha256:'install',key:'install',size:9,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Simulated',category:'TEST_RESULT'});
 mutate(f.s,f.admin,org,'confirmInstallation',{id:rid,technician:'Client training',notes:'Simulated',evidenceId:i});
 mutate(f.s,f.admin,org,'authorizeFailedReturn',{id:rid,reference:'RMA',destination:'TRAINING DEPOT',instructions:'Simulated'});
 mutate(f.s,f.admin,org,'recordFailedReturnShipment',{id:rid,carrier:'TRAINING COURIER',tracking:'T-IN',shipper:'Training client'});
 const rc=id();f.s.evidence.push({id:rc,orgId:org,entityId:rid,name:'receipt.txt',sha256:'receipt',key:'receipt',size:9,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Simulated',category:'RECEIPT'});
 mutate(f.s,f.admin,org,'return',{id:rid,observedSerial:failed.serial,condition:'Failed',location:'Training depot',position:'Q-1',evidenceId:rc});
 const diag=id();f.s.evidence.push({id:diag,orgId:org,entityId:rid,name:'diagnosis.txt',sha256:'diagnosis',key:'diagnosis',size:9,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Simulated',category:'TEST_RESULT'});
 mutate(f.s,f.admin,org,'assessFailedUnit',{id:rid,diagnosis:'Training PSU fault',warranty:'Unknown',feasibility:'Training repair possible',estimatedCostCents:7500,estimatedDays:3,recommendation:'REPAIR',notes:'Synthetic',evidenceId:diag});
 assert.throws(()=>mutate(f.s,f.admin,org,'trainingRepairOpen',{id:rid,reference:'WO-1'}),/approval required/);
 assert.throws(()=>mutate(f.s,f.admin,org,'trainingRepairApprove',{id:rid,expectedVersion:0,reference:'APP',maxCents:7500,notes:'Synthetic'}),/stale/);
 assert.throws(()=>mutate(f.s,f.admin,org,'trainingRepairApprove',{id:rid,expectedVersion:1,reference:'APP',maxCents:8000,notes:'Synthetic'}),/exceeds the documented/);
 mutate(f.s,f.admin,org,'trainingRepairApprove',{id:rid,expectedVersion:1,reference:'APP',maxCents:7500,notes:'Only simulated work'});
 assert.throws(()=>mutate(f.s,f.admin,org,'trainingRepairApprove',{id:rid,expectedVersion:1,reference:'DUP',maxCents:7500,notes:'Again'}),/already approved/);
 mutate(f.s,f.admin,org,'trainingRepairOpen',{id:rid,reference:'TRAIN-WO-1'});
 assert.throws(()=>mutate(f.s,f.admin,org,'trainingRepairResult',{id:rid,outcome:'SUCCESS',spentCents:7600,notes:'Over budget'}),/exceeds the approved ceiling/);
 const work=id();f.s.evidence.push({id:work,orgId:org,entityId:rid,name:'work.txt',sha256:'work',key:'work',size:9,mime:'text/plain',actor:f.admin.email,at:new Date().toISOString(),description:'Synthetic work',category:'EQUIPMENT_CONDITION'});
 mutate(f.s,f.admin,org,'trainingRepairResult',{id:rid,outcome:'SUCCESS',spentCents:6500,notes:'Fictional PSU swapped',evidenceId:work});
 assert.throws(()=>mutate(f.s,f.admin,org,'trainingRepairVerify',{id:rid,notes:'Own test',evidenceId:work}),/different authenticated operator/);
 const qa={...f.admin,id:'training-qa',email:'training-qa@example.com'};f.s.users.push(qa);
 const testId=id();f.s.evidence.push({id:testId,orgId:org,entityId:rid,name:'qa.txt',sha256:'qa',key:'qa',size:9,mime:'text/plain',actor:qa.email,at:new Date().toISOString(),description:'Synthetic QA',category:'TEST_RESULT'});
 mutate(f.s,qa,org,'trainingRepairVerify',{id:rid,notes:'Fictional functional QA passed',evidenceId:testId});
 assert.ok(r.trainingRepair?.verification);
 assert.throws(()=>mutate(f.s,qa,org,'trainingRestockPreview',{id:rid,observedSerial:failed.serial,location:'Training depot',position:'A1',notes:'No proof'}),/Synthetic placement evidence|Fictional observed serial/);
 const stockProof=id();f.s.evidence.push({id:stockProof,orgId:org,entityId:rid,name:'fictional-placement.txt',sha256:'stock-training',key:'stock-training',size:9,mime:'text/plain',actor:qa.email,at:new Date().toISOString(),description:'Fictional bin observation',category:'RECEIPT'});
 mutate(f.s,qa,org,'trainingRestockPreview',{id:rid,observedSerial:failed.serial,location:'Training depot',position:'A1',notes:'Simulation only',evidenceId:stockProof});
 assert.equal(r.trainingRepair?.stocking?.position,'A1');
 assert.throws(()=>mutate(f.s,qa,org,'trainingRestockPreview',{id:rid,observedSerial:failed.serial,location:'Training depot',position:'A1',notes:'Duplicate',evidenceId:stockProof}),/already|required before simulated placement/);
 assert.equal(operationsMetrics(f.s,org).readySpareCount,0);
 assert.equal(failed.status,'RETURNED');
 assert.equal(failed.condition,'FAILED');
 assert.equal(r.status,'RETURNED');
 assert.equal(f.s.invoices.filter(x=>x.orgId===org).length,0);
 assert.equal(f.s.activities.filter(x=>x.orgId===org).length,0);
 assert.throws(()=>mutate(f.s,f.admin,org,'restock',{id:failed.id}),/TRAINING ONLY/);
});
