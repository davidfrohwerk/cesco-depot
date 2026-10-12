import { transact, close } from '../src/lib/store.ts';
import { id, now } from '../src/lib/domain.ts';
import { passwordHash } from '../src/lib/security.ts';
const email = process.env.DEPOT_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.DEPOT_ADMIN_PASSWORD;
if (!email || !password)
    throw Error('Set DEPOT_ADMIN_EMAIL and DEPOT_ADMIN_PASSWORD (at least 12 characters).');
await transact(s => { if (s.users.some(x => x.role === 'SYSTEM_ADMIN'))
    throw Error('System administrator already exists.'); const orgId = id(); const uid = id(); s.organizations.push({ id: orgId, name: 'CESCo Operations', termsDays: 0, currency: 'USD' }); s.users.push({ id: uid, orgId, name: 'CESCo Administrator', email, password: passwordHash(password), role: 'SYSTEM_ADMIN' }); s.audit.push({ id: id(), orgId, at: now(), actor: email, action: 'SYSTEM_BOOTSTRAP', entityId: uid, detail: 'Administrator created from server console.' }); });
console.log('Administrator created. Sign in using the configured email.');
await close();
