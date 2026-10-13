import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { authenticate, hash, passwordHash, passwordValid, session, throttle } from '@/lib/security';
import { read, transact, query } from '@/lib/store';
import { assert, id, now, str, num, mutate, scoped, requireCap, isInternal, get, log, fields, validateCorrectionEvidenceLink, type Role } from '@/lib/domain';
import { csvEscape } from '@/lib/csv';
import { validateEvidenceCategory } from '@/lib/evidence-categories';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const COOKIE = 'cesco_depot_v2';
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 12 * 3600 };
function originCheck(req: NextRequest) { const origin = req.headers.get('origin'); const expected = process.env.DEPOT_ORIGIN || req.nextUrl.origin; assert(origin === expected, 'Request origin does not match the configured portal.'); }
async function who(req: NextRequest) { const u = await authenticate(req.cookies.get(COOKIE)?.value); assert(u, 'Please sign in.'); return u; }
function error(e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Request failed.' }, { status: e instanceof Error && e.message === 'Please sign in.' ? 401 : 400, headers: { 'Cache-Control': 'no-store' } }); }
export async function GET(req: NextRequest, { params }: {
    params: Promise<{
        path: string[];
    }>;
}) {
    try {
        const { path } = await params;
        const u = await who(req);
        const s = await read();
        const orgId = req.nextUrl.searchParams.get('orgId') || u.orgId;
        requireCap(u, orgId, 'view');
        if (path[0] === 'state')
            return NextResponse.json(scoped(s, u, orgId), { headers: { 'Cache-Control': 'no-store' } });
        if (path[0] === 'export') {
            const entity = path[1];
            let rows: Record<string, unknown>[] = [];
            if (entity === 'endpoints')
                rows = s.endpoints.filter(x => x.orgId === orgId).map(x => ({
                    externalId: x.externalId,
                    name: x.name,
                    siteType: x.siteType,
                    addressLine1: x.addressLine1,
                    addressLine2: x.addressLine2,
                    city: x.city,
                    state: x.state,
                    postalCode: x.postalCode,
                    country: x.country,
                    market: x.market,
                    contactName: x.contactName,
                    contactEmail: x.contactEmail,
                    contactPhone: x.contactPhone,
                    accessNotes: x.accessNotes,
                    active: x.active
                }));
            else if (entity === 'equipment')
                rows = s.equipment.filter(x => x.orgId === orgId).map(x => ({
                    externalId: x.externalId,
                    manufacturer: x.manufacturer,
                    model: x.model,
                    serial: x.serial,
                    configuration: x.configuration,
                    pool: x.pool,
                    purpose: x.purpose,
                    endpointId: s.endpoints.find(e => e.id === x.endpointId)?.externalId || '',
                    recoveryTargetHours: x.recoveryTargetHours ?? '',
                    volume: x.volume,
                    status: x.status,
                    condition: x.condition,
                    location: x.location,
                    custodian: x.custodian,
                    testedAt: x.testedAt
                }));
            else if (entity === 'billing') {
                requireCap(u, orgId, 'billing');
                rows = s.activities.filter(x => x.orgId === orgId).map(x => ({ invoice: s.invoices.find(v => v.id === x.invoiceId)?.number || '', service: x.description, quantity: x.quantity, unit: x.unit, unitCents: x.unitCents, amountCents: x.amount, agreement: x.rateVersion, status: x.status, workOrder: s.intakes.find(v => v.id === x.intakeId)?.workOrder || s.requests.find(v => v.id === x.requestId)?.number || '', periodStart: x.periodStart, periodEnd: x.periodEnd, performedAt: x.performedAt }));
            }
            else if (entity === 'audit')
                rows = s.audit.filter(x => x.orgId === orgId);
            else
                throw Error('Unknown export.');
            const headers = rows.length ? Object.keys(rows[0]) : fields[entity as keyof typeof fields] || [];
            return new NextResponse([headers.join(','), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))].join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="cesco-${entity}.csv"`, 'Cache-Control': 'no-store' } });
        }
        if (path[0] === 'evidence') {
            const e = get(s.evidence, path[1], orgId);
            const bytes = await readFile(join(/*turbopackIgnore: true*/ resolve(/*turbopackIgnore: true*/ process.env.DEPOT_EVIDENCE_PATH || 'data/evidence'), e.key));
            assert(createHash('sha256').update(bytes).digest('hex') === e.sha256, 'Evidence integrity verification failed.');
            await transact(st => log(st, u, orgId, 'EVIDENCE_DOWNLOADED', e.entityId, e.sha256));
            return new NextResponse(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${e.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
        }
        throw Error('Route not found.');
    }
    catch (e) {
        return error(e);
    }
}
export async function POST(req: NextRequest, { params }: {
    params: Promise<{
        path: string[];
    }>;
}) {
    try {
        originCheck(req);
        const { path } = await params;
        const length = Number(req.headers.get('content-length') || 0);
        assert(length <= 30 * 1024 * 1024, 'Request body exceeds 30 MB.');
        if (path[0] === 'auth') {
            const p = await req.json();
            const email = str(p.email, 'Email', 254).toLowerCase();
            assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter a valid email address.');
            await throttle('auth:' + email);
            const password = str(p.password, 'Password', 256);
            let userId: string;
            if (path[1] === 'login') {
                const u = (await read()).users.find(x => x.email === email);
                assert(u && passwordValid(password, u.password), 'Email or password is incorrect.');
                userId = u.id;
            }
            else if (path[1] === 'register')
                userId = await transact(s => { assert(!s.users.some(x => x.email === email), 'An account with that email already exists.'); const uid = id(); let orgId: string, role: Role = 'CLIENT_ADMIN'; if (p.invite) {
                    const inv = s.invites.find(x => x.tokenHash === hash(p.invite) && !x.used && x.email === email && new Date(x.expiresAt) > new Date());
                    assert(inv, 'Invitation is invalid, expired, or belongs to another email.');
                    inv.used = true;
                    orgId = inv.orgId;
                    role = inv.role;
                }
                else {
                    orgId = id();
                    s.organizations.push({ id: orgId, name: str(p.organization, 'Organization', 200), termsDays: 0, currency: 'USD' });
                } const u = { id: uid, orgId, email, name: str(p.name, 'Name', 200), password: passwordHash(password), role }; s.users.push(u); log(s, u, orgId, 'REGISTERED', uid, 'Free registration; no work order or charges created.'); return uid; });
            else
                throw Error('Unknown authentication action.');
            const response = NextResponse.json({ ok: true });
            response.cookies.set(COOKIE, await session(userId), cookieOptions);
            return response;
        }
        const u = await who(req);
        if (path[0] === 'logout') {
            const token = req.cookies.get(COOKIE)?.value;
            if (token)
                await query('DELETE FROM depot_v2_sessions WHERE token=$1', [hash(token)]);
            const r = NextResponse.json({ ok: true });
            r.cookies.set(COOKIE, '', { ...cookieOptions, maxAge: 0 });
            return r;
        }
        if (path[0] === 'evidence') {
            const form = await req.formData();
            const orgId = str(form.get('orgId'), 'Account');
            requireCap(u, orgId, isInternal(u) ? 'operate' : 'onboard');
            const entityId = str(form.get('entityId'), 'Linked record');
            const s = await read();
            assert([...s.equipment, ...s.intakes, ...s.requests].some(x => x.id === entityId && x.orgId === orgId), 'Evidence must link to an account asset, intake, or request.');
            const correctionRaw = form.get('receiptCorrectionIndex');
            const receiptCorrectionIndex = correctionRaw === null || correctionRaw === '' ? undefined : Number(correctionRaw);
            if (receiptCorrectionIndex !== undefined) {
                requireCap(u, orgId, 'operate');
                validateCorrectionEvidenceLink(s, orgId, entityId, receiptCorrectionIndex);
            }
            const category = str(form.get('category') || 'OTHER', 'Evidence category', 50);
            const file = form.get('file');
            assert(file instanceof File && file.size > 0 && file.size <= 25 * 1024 * 1024, 'Upload a file of 1 byte–25 MB.');
            validateEvidenceCategory(category, file.type);
            const bytes = Buffer.from(await file.arrayBuffer());
            const key = id();
            const root = resolve(/*turbopackIgnore: true*/ process.env.DEPOT_EVIDENCE_PATH || 'data/evidence');
            await mkdir(root, { recursive: true, mode: 0o700 });
            await writeFile(join(/*turbopackIgnore: true*/ root, key), bytes, { mode: 0o600 });
            try {
                await transact(st => { if (receiptCorrectionIndex !== undefined) validateCorrectionEvidenceLink(st, orgId, entityId, receiptCorrectionIndex); const e = { id: key, orgId, entityId, receiptCorrectionIndex, name: file.name, sha256: createHash('sha256').update(bytes).digest('hex'), key, size: file.size, mime: file.type, actor: u.email, at: now(), description: str(form.get('description'), 'Evidence description'), category }; st.evidence.push(e); log(st, u, orgId, 'EVIDENCE_UPLOADED', entityId, `${e.name}; category ${category}; correction ${receiptCorrectionIndex ?? 'none'}; SHA256 ${e.sha256}`); });
            }
            catch (e) {
                await unlink(join(/*turbopackIgnore: true*/ root, key));
                throw e;
            }
            return NextResponse.json({ ok: true });
        }
        const p = await req.json();
        const orgId = str(p.orgId || u.orgId, 'Account');
        if (path[0] === 'invite') {
            requireCap(u, orgId, 'team');
            const email = str(p.email, 'Email', 254).toLowerCase();
            assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Enter valid email.');
            assert(['CLIENT_ADMIN', 'HELPDESK', 'CLIENT_BILLING', 'AUDITOR'].includes(p.role), 'Only client roles may be invited.');
            const token = randomBytes(32).toString('hex');
            await transact(s => { s.invites.push({ id: id(), orgId, email, role: p.role, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), used: false }); log(s, u, orgId, 'INVITED', orgId, `${email}; ${p.role}`); });
            return NextResponse.json({ url: `${process.env.DEPOT_ORIGIN || req.nextUrl.origin}/?invite=${token}`, note: 'Copy this one-time invitation link. No email has been sent.' });
        }
        if (path[0] === 'action') {
            const result = await transact(s => mutate(s, u, orgId, str(p.action, 'Action'), p));
            return NextResponse.json({ ok: true, id: result });
        }
        throw Error('Unknown route.');
    }
    catch (e) {
        return error(e);
    }
}
