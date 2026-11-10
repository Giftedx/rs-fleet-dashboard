// A publisher that needs no access to your bots. It reads two public sources of an rs-sdk server, the world feed
// (who is online, and where) and the hiscore pages (levels, ranks, times), and writes public.json for the page.
// It knows nothing of inventories, worn items, quests or XP: a publisher that reads your bots can add those
// (docs/data-format.md).
// Usage: bun scripts/publish.ts --names Alice,Bob [--server rs-sdk-demo.fly.dev] [--out demo] [--every 60] [--once]
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SKILLS } from './make-demo';

export const BOARDS = ['Overall', ...SKILLS.filter(s => !s.startsWith('Stat'))];
/** The hiscore category of a board: Overall is 0, a skill is its index in the server's skill list plus 1. */
export const category = (board: string) => board === 'Overall' ? 0 : SKILLS.indexOf(board) + 1;
const number = (text: string) => Number(text.replace(/,/g, ''));

export type RankRow = { board: string; rank: number; level: number; time: string };
/** The rows of a hiscore player page: "<Board> <rank> <level> <time>" once the tags are gone. */
export function playerRows(html: string): RankRow[] {
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
    const rows: RankRow[] = [];
    for (const board of BOARDS) {
        const m = text.match(new RegExp(`${board} ([0-9,]+) ([0-9,]+) ((?:\\d+h )?(?:\\d+m )?\\d+s)`));
        if (m) rows.push({ board, rank: number(m[1]!), level: number(m[2]!), time: m[3]! });
    }
    return rows;
}
export type TopRow = { rank: number; name: string; level: number; ticks: number; time: string };
/** The rows of a hiscore board page. The page is four columns (Rank, Name, Level, Time) with one line for each player. */
export function boardRows(html: string): TopRow[] {
    const column = (title: string) => { const i = html.indexOf(`<b>${title}</b>`); return i < 0 ? '' : html.slice(i, html.indexOf('</td>', i)); };
    const ranks = [...column('Rank').matchAll(/([\d,]+)\s*<br>/g)].map(m => number(m[1]!));
    const names = [...column('Name').matchAll(/href="\/hiscores\/player\/([^?"]+)/g)].map(m => decodeURIComponent(m[1]!));
    const levels = [...column('Level').matchAll(/([\d,]+)\s*<br>/g)].map(m => number(m[1]!));
    const times = [...column('Time').matchAll(/title="([\d,]+) ticks[^>]*>([^<]*)</g)].map(m => ({ ticks: number(m[1]!), time: m[2]!.trim() }));
    return names.map((name, i) => ({ rank: ranks[i] ?? i + 1, name, level: levels[i] ?? 0, ticks: times[i]?.ticks ?? 0, time: times[i]?.time ?? '' }));
}

// The world feed sends the roster as a full frame, then as changes: lv lists the slots that left, j the rows that
// joined or changed, m the players that moved. A row is [slot, name, x, z, level, combat].
export type RosterRow = [slot: number, name: string, x: number, z: number, level: number, combat: number];
export class Roster {
    rows = new Map<number, RosterRow>();
    apply(m: any) {
        if (m?.t !== 'roster') return;
        if (Array.isArray(m.p)) { this.rows.clear(); for (const r of m.p) if (Array.isArray(r)) this.rows.set(r[0], [...r] as RosterRow); return; }
        for (const slot of Array.isArray(m.lv) ? m.lv : []) this.rows.delete(slot);
        for (const r of Array.isArray(m.j) ? m.j : []) if (Array.isArray(r)) this.rows.set(r[0], [...r] as RosterRow);
        for (const r of Array.isArray(m.m) ? m.m : []) {
            const row = Array.isArray(r) ? this.rows.get(r[0]) : undefined;
            if (row) { row[2] = r[1]; row[3] = r[2]; row[4] = r[3]; if (r.length > 4) row[5] = r[4]; }
        }
    }
}

export type Known = { rows: RankRow[]; at: number; seen?: { x: number; z: number; level: number; combat: number; at: number }; first: number };
export type World = { players: number; tick: number; tickAt: number; tickMs: number; connected: boolean; rev: number };
/** public.json from what the two sources gave. `tops` is the first rows of each board page. */
export function buildState(now: number, server: string, names: string[], roster: RosterRow[], known: Map<string, Known>, tops: Map<string, TopRow[]>, world: World) {
    const online = new Map(roster.map(r => [r[1].toLowerCase(), r]));
    const ours = new Set(names.map(n => n.toLowerCase()));
    const bots = names.map(name => {
        const k = known.get(name.toLowerCase()), row = online.get(name.toLowerCase()), seen = k?.seen;
        const level = (board: string) => k?.rows.find(r => r.board === board)?.level ?? 1;
        const hitpoints = Math.max(10, level('Hitpoints'));
        return {
            name, server, side: 'fleet', practice: false, reserved: false, at: row ? now : seen?.at ?? 0, started: k?.first ?? now, fresh: !!row, inWorld: !!row,
            operation: row ? 'observed' : 'offline', pos: seen ? { x: seen.x, z: seen.z, level: seen.level } : null,
            live: row ? { name: row[1], x: row[2], z: row[3], level: row[4], combat: row[5], seen: now } : null,
            hp: { now: hitpoints, max: hitpoints }, combat: row?.[5] ?? seen?.combat ?? 3,
            skills: SKILLS.map(skill => ({ name: skill, level: skill === 'Hitpoints' ? hitpoints : level(skill), currentLevel: skill === 'Hitpoints' ? hitpoints : level(skill), xp: 0 })),
            quests: [], questsAt: null, equipment: [], equipmentObserved: false, inventory: [],
            ranks: (k?.rows ?? []).map(r => ({ ...r, delta: 0, since: null, hist: [r.rank] })), ranksAt: k?.at ?? null,
            role: 'bot', goal: '', currentGoal: '', goalSkill: null, goalLevel: null, goalNow: null, goalXp: null,
            xpPerTick: 0, xpPerHour: 0, xpLeft: 0, eta: '', rateSkill: null, spark: [], uptime: row ? now - (k?.first ?? now) : 0,
            action: row ? 'in the world' : 'idle', death: null, seenInFeed: !!row, lastSeen: seen?.at ?? null, outcome: null, training: false,
        };
    });
    const boards = BOARDS.map(board => {
        const first = tops.get(board)?.[0];
        const best = bots.flatMap(b => b.ranks.filter(r => r.board === board).map(r => ({ ...r, name: b.name }))).sort((a, b) => a.rank - b.rank)[0] ?? null;
        const top = first ? { name: first.name, level: first.level, time: first.time, ticks: first.ticks, live: true, at: now } : null;
        const gap = top && best ? { kind: 'level', ahead: best.rank === 1, text: best.rank === 1 ? 'rank 1' : best.level < top.level ? `-${top.level - best.level} lvl` : `rank ${best.rank}`, close: Math.min(1, best.level / top.level) } : null;
        return { board, kind: 'skill', top, best, gap };
    });
    const rivals = BOARDS.filter(board => tops.has(board)).map(board => ({
        board, at: now, ours: boards.find(b => b.board === board)?.best ?? null,
        rows: tops.get(board)!.slice(0, 10).map(r => { const on = online.get(r.name.toLowerCase()); return { rank: r.rank, name: r.name, level: r.level, ticks: r.ticks, fleet: ours.has(r.name.toLowerCase()), online: !!on, x: on?.[2] ?? null, z: on?.[3] ?? null }; }),
    }));
    return {
        now, snapshotAt: new Date(now).toISOString(), pageVersion: 1, hosted: { at: now, kind: 'public' },
        world: { ...world, players: roster.length }, worldPlayers: roster.length,
        map: { x0: 2368, z0: 2880, w: 560, h: 416, scale: 2, ready: false },
        roster: roster.map(r => [r[1], r[2], r[3], r[4], r[5]]), bots, boards, rivals,
        liveTops: tops.size, liveTopsAt: now, lookups: {}, contention: [], farms: [], icons: {}, results: [], events: [], alerts: [],
        economy: { farmers: [], goldPerTick: 0, itemExamine: {}, itemValues: {}, pricesAt: null, supplies: [], trend: [] },
        coordination: { agents: [], available: false, counts: { running: 0, pending: 0, succeeded: 0, failed: 0 }, fresh: false, paused: false, tasks: [] },
        fleetSides: { at: now, sides: [{ side: 'fleet', at: now, late: false, accounts: bots.map(b => ({ name: b.name, at: b.at, total: b.skills.reduce((a, s) => a + s.level, 0) })) }] },
    };
}

if (import.meta.main) {
    const arg = (name: string, fallback = '') => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] ?? '' : fallback; };
    const names = arg('names').split(',').map(n => n.trim()).filter(n => /^[A-Za-z0-9_ -]{1,12}$/.test(n));
    if (!names.length) { console.error('usage: bun scripts/publish.ts --names Alice,Bob [--server host] [--out folder] [--every seconds] [--once]'); process.exit(2); }
    const server = arg('server', 'rs-sdk-demo.fly.dev'), out = resolve(arg('out', join(import.meta.dir, '..', 'demo')));
    const every = Math.max(15, Number(arg('every', '60')) || 60) * 1000, once = process.argv.includes('--once'), HISCORE_MS = 10 * 60_000;
    const roster = new Roster(), known = new Map<string, Known>(), tops = new Map<string, TopRow[]>();
    const world: World = { players: 0, tick: 0, tickAt: 0, tickMs: 600, connected: false, rev: 0 };
    let firstFrame!: () => void; const hasRoster = new Promise<void>(done => { firstFrame = done; });
    const page = async (path: string) => { const r = await fetch(`https://${server}${path}`, { signal: AbortSignal.timeout(15_000) }); if (!r.ok) throw Error(`${path} returned HTTP ${r.status}`); return r.text(); };

    function connect() {
        const ws = new WebSocket(`wss://${server}/worldfeed`);
        ws.onopen = () => { world.connected = true; ws.send(JSON.stringify({ t: 'roster', on: true })); };
        ws.onmessage = e => {
            const m = JSON.parse(String(e.data));
            if (m.t === 'hello') { world.tick = m.tick ?? world.tick; world.tickMs = m.tickMs ?? world.tickMs; world.rev = m.rev ?? world.rev; world.tickAt = Date.now(); }
            if (m.t !== 'roster') return;
            roster.apply(m);
            if (m.k) { world.tick = m.k; world.tickAt = Date.now(); }
            firstFrame();
        };
        ws.onclose = () => { world.connected = false; if (!once) setTimeout(connect, 5000); };
        ws.onerror = () => ws.close();
        return ws;
    }
    let topsAt = 0;
    async function readHiscores(now: number) {
        for (const name of names) {
            const key = name.toLowerCase(), k = known.get(key) ?? { rows: [], at: 0, first: now };
            known.set(key, k);
            if (now - k.at < HISCORE_MS) continue;
            try { k.rows = playerRows(await page(`/hiscores/player/${encodeURIComponent(key)}?profile=main`)); k.at = now; } catch (error) { console.error(`hiscores of ${name}: ${(error as Error).message}`); }
        }
        if (tops.size && now - topsAt < HISCORE_MS) return;
        for (const board of BOARDS) {
            try { tops.set(board, boardRows(await page(`/hiscores?category=${category(board)}&profile=main`))); } catch (error) { console.error(`board ${board}: ${(error as Error).message}`); }
        }
        topsAt = now;
    }
    async function cycle() {
        const now = Date.now();
        await readHiscores(now);
        const rows = [...roster.rows.values()];
        for (const r of rows) { const k = known.get(r[1].toLowerCase()); if (k) k.seen = { x: r[2], z: r[3], level: r[4], combat: r[5], at: now }; }
        const state = buildState(now, server, names, rows, known, tops, world);
        mkdirSync(out, { recursive: true });
        // The page must never read half a file: write beside it, then rename.
        writeFileSync(join(out, 'public.json.tmp'), JSON.stringify(state));
        renameSync(join(out, 'public.json.tmp'), join(out, 'public.json'));
        console.log(`${new Date(now).toISOString()} ${state.bots.filter(b => b.inWorld).length}/${names.length} bots online, ${rows.length} players in the world, ${tops.size} boards -> ${join(out, 'public.json')}`);
    }
    const ws = connect();
    await Promise.race([hasRoster, Bun.sleep(10_000)]);
    await cycle();
    if (once) { ws.close(); process.exit(0); }
    setInterval(() => cycle().catch(error => console.error(error)), every);
}
