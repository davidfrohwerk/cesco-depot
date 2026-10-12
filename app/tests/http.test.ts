import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('HTTP authentication, CSRF, free account, bulk commit, role isolation, evidence integrity, durable rollback', async () => {
    const temp = await mkdtemp(join(tmpdir(), 'depot-http-'));
    const origin = 'http://127.0.0.1:3197';
    process.env.DEPOT_DATABASE_PATH = join(temp, 'depot.sqlite');
    delete process.env.DEPOT_DATABASE_URL;
    const { transact, read } = await import('../src/lib/store.ts');
    const { passwordHash } = await import('../src/lib/security.ts');
    const password = randomBytes(20).toString('hex');
    await transact(s => { s.organizations.push({ id: 'cesco', name: 'CESCo', termsDays: 0, currency: 'USD' }); s.users.push({ id: 'admin', orgId: 'cesco', name: 'Admin', email: 'admin@example.com', role: 'SYSTEM_ADMIN', password: passwordHash(password) }); });
    await Promise.all(Array.from({ length: 10 }, (_, i) => transact(s => s.audit.push({ id: randomUUID(), orgId: 'cesco', at: new Date().toISOString(), actor: 'test', action: 'CONCURRENT', entityId: 'cesco', detail: String(i) }))));
    assert.equal((await read()).audit.length, 10);
    await assert.rejects(transact(s => { s.organizations.push({ id: 'rollback', name: 'Rollback', termsDays: 0, currency: 'USD' }); throw Error('rollback'); }));
    assert.equal((await read()).organizations.length, 1);
    const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3197'], { env: { ...process.env, DEPOT_ORIGIN: origin, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'pipe' });
    let output = '';
    child.stdout.on('data', d => output += String(d));
    child.stderr.on('data', d => output += String(d));
    try {
        let online = false;
        for (let i = 0; i < 60; i++) {
            try {
                const r = await fetch(origin);
                if (r.ok) {
                    online = true;
                    break;
                }
            }
            catch { }
            await new Promise(r => setTimeout(r, 500));
        }
        assert.ok(online, 'Server did not start: ' + output.slice(-1500));
        const post = async (path: string, p: unknown, cookie = '', requestOrigin = origin) => { const r = await fetch(origin + '/api/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(p) }); return { r, body: await r.json() }; };
        const signup = await post('auth/register', { email: 'client@example.com', password, name: 'Client', organization: 'Acme' });
        assert.equal(signup.r.status, 200, JSON.stringify(signup.body));
        const cookie = signup.r.headers.get('set-cookie')!.split(';')[0];
        assert.match(signup.r.headers.get('set-cookie')!, /HttpOnly/i);
        const state = await (await fetch(origin + '/api/state', { headers: { Cookie: cookie } })).json();
        const orgId = state.organization.id;
        assert.equal(state.intakes.length, 0);
        assert.equal(state.activities.length, 0);
        assert.equal(state.organization.name, 'Acme');
        const csrf = await post('action', { orgId, action: 'endpoint', code: 'X', name: 'X', address: 'X', rtoHours: 4 }, cookie, 'https://malicious.example');
        assert.equal(csrf.r.status, 400);
        assert.match(csrf.body.error, /origin/);
        const forbidden = await fetch(origin + '/api/state?orgId=cesco', { headers: { Cookie: cookie } });
        assert.equal(forbidden.status, 400);
        const csv = 'code,name,address,rtoHours\nIND,Indy,Indianapolis IN,4';
        const preview = await post('action', { orgId, action: 'importPreview', kind: 'endpoints', csv }, cookie);
        assert.equal(preview.r.status, 200, JSON.stringify(preview.body));
        const commit = await post('action', { orgId, action: 'importCommit', id: preview.body.id }, cookie);
        assert.equal(commit.r.status, 200);
        const admin = await post('auth/login', { email: 'admin@example.com', password });
        assert.equal(admin.r.status, 200);
        const adminCookie = admin.r.headers.get('set-cookie')!.split(';')[0];
        const rate = await post('action', { orgId, action: 'rate', name: 'Receiving', category: 'RECEIVING', unit: 'item', cents: 2500, version: 'A1' }, adminCookie);
        assert.equal(rate.r.status, 200);
        const denied = await post('action', { orgId, action: 'rate', name: 'Fraud', category: 'RECEIVING', unit: 'item', cents: 1, version: 'x' }, cookie);
        assert.equal(denied.r.status, 400);
        const equip = 'externalId,manufacturer,model,serial,configuration,pool,purpose,endpointCode,volume\nR1,OEM,X,001,v1,routers,SUPPORTED,IND,0\nS1,OEM,X,002,v1,routers,SPARE,,1';
        const ej = await post('action', { orgId, action: 'importPreview', kind: 'equipment', csv: equip }, cookie);
        assert.equal(ej.r.status, 200);
        assert.equal((await post('action', { orgId, action: 'importCommit', id: ej.body.id }, cookie)).r.status, 200);
        const current = await (await fetch(origin + '/api/state', { headers: { Cookie: cookie } })).json();
        const assetId = current.equipment[1].id;
        const form = new FormData();
        form.set('orgId', orgId);
        form.set('entityId', assetId);
        form.set('description', 'Serial identity evidence');
        form.set('file', new Blob(['original receipt evidence']), 'serial.txt');
        const upload = await fetch(origin + '/api/evidence', { method: 'POST', headers: { Cookie: cookie, Origin: origin }, body: form });
        assert.equal(upload.status, 200, await upload.text());
        const evidenceState = await (await fetch(origin + '/api/state', { headers: { Cookie: cookie } })).json();
        const eid = evidenceState.evidence[0].id;
        const file = await fetch(origin + `/api/evidence/${eid}?orgId=${orgId}`, { headers: { Cookie: cookie } });
        assert.equal(await file.text(), 'original receipt evidence');
        assert.equal(file.headers.get('content-type'), 'application/octet-stream');
        const invite = await post('invite', { orgId, email: 'help@example.com', role: 'HELPDESK' }, cookie);
        assert.equal(invite.r.status, 200);
        const token = new URL(invite.body.url).searchParams.get('invite');
        const member = await post('auth/register', { email: 'help@example.com', password, name: 'Helpdesk', invite: token });
        assert.equal(member.r.status, 200);
        const hc = member.r.headers.get('set-cookie')!.split(';')[0];
        const hm = await (await fetch(origin + '/api/state', { headers: { Cookie: hc } })).json();
        assert.equal(hm.user.role, 'HELPDESK');
        assert.deepEqual(hm.rates, []);
        assert.deepEqual(hm.invoices, []);
        assert.equal((await post('action', { orgId, action: 'approveRate', id: rate.body.id }, hc)).r.status, 400);
        const reused = await post('auth/register', { email: 'other@example.com', password, name: 'Other', invite: token });
        assert.equal(reused.r.status, 400);
        const exportResponse = await fetch(origin + `/api/export/equipment?orgId=${orgId}`, { headers: { Cookie: cookie } });
        assert.equal(exportResponse.status, 200);
        assert.match(await exportResponse.text(), /R1/);
        const beforeLogout = await read();
        assert.equal(beforeLogout.endpoints.filter(x => x.orgId === orgId).length, 1);
        assert.equal(beforeLogout.equipment.filter(x => x.orgId === orgId).length, 2);
        assert.equal((await post('logout', {}, cookie)).r.status, 200);
        assert.equal((await fetch(origin + '/api/state', { headers: { Cookie: cookie } })).status, 401);
    }
    finally {
        child.kill('SIGTERM');
        await new Promise<void>(resolve => { child.once('exit', () => resolve()); setTimeout(resolve, 4000); });
        await rm(temp, { recursive: true, force: true });
    }
});
