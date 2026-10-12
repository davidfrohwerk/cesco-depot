import { transact, close } from '../src/lib/store.ts';
import { id, log, assert, type Role } from '../src/lib/domain.ts';
import { passwordHash } from '../src/lib/security.ts';
const email = process.env.DEPOT_STAFF_EMAIL?.trim().toLowerCase();
const password = process.env.DEPOT_STAFF_PASSWORD;
const role = process.env.DEPOT_STAFF_ROLE as Role;
assert(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password, 'Set DEPOT_STAFF_EMAIL and DEPOT_STAFF_PASSWORD.');
assert(['OPERATIONS', 'FINANCE'].includes(role), 'DEPOT_STAFF_ROLE must be OPERATIONS or FINANCE.');
try {
    await transact(s => { const admin = s.users.find(x => x.role === 'SYSTEM_ADMIN'); assert(admin, 'Bootstrap the system administrator first.'); assert(!s.users.some(x => x.email === email), 'Email already exists.'); const user = { id: id(), orgId: admin.orgId, email, name: process.env.DEPOT_STAFF_NAME || email, role, password: passwordHash(password) }; s.users.push(user); log(s, admin, admin.orgId, 'STAFF_PROVISIONED', user.id, `${email}; ${role}; provisioned from trusted server console`); });
    console.log('Staff account created.');
}
finally {
    await close();
}
