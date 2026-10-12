import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { emptyState, type State } from './domain.ts';
const url = process.env.DEPOT_DATABASE_URL;
const pool = url ? new pg.Pool({ connectionString: url, max: 5 }) : null;
let local: DatabaseSync | null = null;
if (!pool) {
    const path = resolve(/*turbopackIgnore: true*/ process.env.DEPOT_DATABASE_PATH || 'data/depot-v2.sqlite');
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    local = new DatabaseSync(path);
    local.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
}
type Client = pg.PoolClient | null;
let init: Promise<void> | undefined;
async function raw(sql: string, values: (string | number | null)[] = [], client: Client = null): Promise<{
    rows: Record<string, unknown>[];
}> {
    if (pool)
        return (client || pool).query(sql, values);
    const args: (string | number | null)[] = [];
    const sqliteSql = sql.replace(/\$(\d+)/g, (_, n) => { args.push(values[Number(n) - 1]); return '?'; }).replace(/ FOR UPDATE/g, '');
    const stmt = local!.prepare(sqliteSql);
    return /^\s*(SELECT|.*RETURNING)/i.test(sqliteSql) ? { rows: stmt.all(...args) as Record<string, unknown>[] } : (stmt.run(...args), { rows: [] });
}
async function initialize() { if (!init)
    init = (async () => { await raw('CREATE TABLE IF NOT EXISTS depot_v2_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL, revision INTEGER NOT NULL)'); await raw('CREATE TABLE IF NOT EXISTS depot_v2_sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at BIGINT NOT NULL)'); await raw('CREATE TABLE IF NOT EXISTS depot_v2_login_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until_at BIGINT NOT NULL)'); await raw('INSERT INTO depot_v2_state VALUES(1,$1,0) ON CONFLICT(id) DO NOTHING', [JSON.stringify(emptyState())]); })(); await init; }
export async function query(sql: string, values: (string | number | null)[] = []) { await initialize(); return raw(sql, values); }
export async function read(): Promise<State> { const result = await query('SELECT payload FROM depot_v2_state WHERE id=1'); return { ...emptyState(), ...JSON.parse(result.rows[0].payload as string) }; }
let localQueue: Promise<unknown> = Promise.resolve();
export function transact<T>(fn: (s: State) => T): Promise<T> { if (pool)
    return transaction(fn); const result = localQueue.then(() => transaction(fn)); localQueue = result.catch(() => undefined); return result; }
async function transaction<T>(fn: (s: State) => T): Promise<T> {
    await initialize();
    const client = pool ? await pool.connect() : null;
    try {
        if (client)
            await client.query('BEGIN');
        else
            local!.exec('BEGIN IMMEDIATE');
        const r = await raw('SELECT payload FROM depot_v2_state WHERE id=1 FOR UPDATE', [], client);
        const s: State = { ...emptyState(), ...JSON.parse(r.rows[0].payload as string) };
        const result = fn(s);
        await raw('UPDATE depot_v2_state SET payload=$1,revision=revision+1 WHERE id=1', [JSON.stringify(s)], client);
        if (client)
            await client.query('COMMIT');
        else
            local!.exec('COMMIT');
        return result;
    }
    catch (e) {
        if (client)
            await client.query('ROLLBACK');
        else
            local!.exec('ROLLBACK');
        throw e;
    }
    finally {
        client?.release();
    }
}
export async function close() { if (pool)
    await pool.end();
else
    local?.close(); }
