import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { query, read } from './store.ts';
import { assert, type User } from './domain.ts';
export const hash = (x: string) => createHash('sha256').update(x).digest('hex');
export function passwordHash(password: string) { assert(password.length >= 12 && password.length <= 256, 'Use a password of 12–256 characters.'); const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }
export function passwordValid(password: string, encoded: string) { try {
    const [salt, key] = encoded.split(':');
    const expected = Buffer.from(key, 'hex');
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}
catch {
    return false;
} }
export async function session(userId: string) { const token = randomBytes(32).toString('hex'); await query('DELETE FROM depot_v2_sessions WHERE expires_at < $1', [Date.now()]); await query('INSERT INTO depot_v2_sessions VALUES($1,$2,$3)', [hash(token), userId, Date.now() + 12 * 3600000]); return token; }
export async function authenticate(token: string | undefined): Promise<User | null> { if (!token)
    return null; const r = await query('SELECT user_id FROM depot_v2_sessions WHERE token=$1 AND expires_at>$2', [hash(token), Date.now()]); const row = r.rows[0]; return row ? (await read()).users.find(x => x.id === row.user_id) || null : null; }
export async function throttle(key: string) { const r = await query('SELECT count,until_at FROM depot_v2_login_limits WHERE key=$1', [key]); const row = r.rows[0]; assert(!row || Number(row.until_at) < Date.now() || Number(row.count) < 10, 'Too many attempts. Try again in 15 minutes.'); await query('INSERT INTO depot_v2_login_limits VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN depot_v2_login_limits.until_at < $3 THEN 1 ELSE depot_v2_login_limits.count+1 END,until_at=CASE WHEN depot_v2_login_limits.until_at < $3 THEN $2 ELSE depot_v2_login_limits.until_at END', [key, Date.now() + 900000, Date.now()]); }
