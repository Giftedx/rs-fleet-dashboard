// Writes demo/public.json: a fleet of made-up bots in the format the page reads (docs/data-format.md).
// It is also the shortest example of a publisher: build the same object from your own bots and write it
// where the page is served.
// Usage: bun scripts/make-demo.ts [out folder]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const SKILLS = ['Attack', 'Defence', 'Strength', 'Hitpoints', 'Ranged', 'Prayer', 'Magic', 'Cooking', 'Woodcutting', 'Fletching', 'Fishing', 'Firemaking', 'Crafting', 'Smithing', 'Mining', 'Herblore', 'Agility', 'Thieving', 'Stat18', 'Stat19', 'Runecraft'];
const BOARDS = ['Overall', ...SKILLS.filter(s => !s.startsWith('Stat'))];

type Demo = { name: string; role: string; goal: string; skill: string; level: number; x: number; z: number; items: [number, string, number][]; online: boolean };
const DEMO: Demo[] = [
    { name: 'DemoMiner', role: 'mining', goal: 'mine iron at the Al Kharid mine', skill: 'Mining', level: 61, x: 3298, z: 3300, items: [[1271, 'Adamant pickaxe', 1], [440, 'Iron ore', 19]], online: true },
    { name: 'DemoFisher', role: 'fishing', goal: 'fish trout at Barbarian Village', skill: 'Fishing', level: 48, x: 3104, z: 3433, items: [[309, 'Fly fishing rod', 1], [314, 'Feather', 812], [335, 'Raw trout', 14]], online: true },
    { name: 'DemoChopper', role: 'woodcutting', goal: 'cut willows at Draynor', skill: 'Woodcutting', level: 55, x: 3087, z: 3234, items: [[1359, 'Rune axe', 1], [1519, 'Willow logs', 22]], online: true },
    { name: 'DemoFighter', role: 'combat', goal: 'train Strength to 60 on the Lumbridge cows', skill: 'Strength', level: 52, x: 3258, z: 3277, items: [[379, 'Lobster', 9], [995, 'Coins', 4210]], online: true },
    { name: 'DemoThief', role: 'thieving', goal: 'pickpocket knights in Ardougne', skill: 'Thieving', level: 70, x: 2662, z: 3305, items: [[995, 'Coins', 61250], [1993, 'Jug of wine', 12]], online: true },
    { name: 'DemoSmith', role: 'smithing', goal: 'smelt steel bars at Falador', skill: 'Smithing', level: 43, x: 2974, z: 3369, items: [[2353, 'Steel bar', 9]], online: false },
];

/** XP at the start of a level on the curve of the rs-sdk demo server, which the page uses too (site/xp-tracker.js). */
export function xpFor(level: number) {
    let points = 0;
    for (let l = 1; l < level; l++) points += Math.floor(l + 300 * 2 ** (l / 10));
    return Math.floor(points / 4);
}

export function makeDemo(now: number) {
    const minute = 60_000, hour = 60 * minute;
    const bots = DEMO.map((d, i) => {
        const levels = SKILLS.map(name => name === d.skill ? d.level : name === 'Hitpoints' ? 10 + i * 6 : name.startsWith('Stat') ? 1 : 1 + ((i * 7 + name.length * 3) % 30));
        const skills = SKILLS.map((name, k) => ({ name, level: levels[k]!, currentLevel: levels[k]!, xp: levels[k] === 1 ? 0 : xpFor(levels[k]!) + 120 }));
        const total = levels.reduce((a, b) => a + b, 0), xpPerHour = 18_000 + i * 6_500;
        const xp = skills.find(s => s.name === d.skill)!.xp, xpLeft = Math.max(0, xpFor(d.level + 1) - xp);
        return {
            name: d.name, server: 'demo', side: 'demo', practice: false, reserved: false,
            at: now - (d.online ? 4_000 : 3 * hour), started: now - (40 + i * 25) * minute, fresh: d.online, inWorld: d.online,
            operation: d.online ? 'observed' : 'offline', pos: { x: d.x, z: d.z, level: 0 },
            live: d.online ? { name: d.name, x: d.x, z: d.z, level: 0, combat: 20 + i * 9, seen: now - 4_000 } : null,
            hp: { now: 10 + i * 6 - (i % 3), max: 10 + i * 6 }, combat: 20 + i * 9,
            skills, quests: [{ id: 7333, name: "Cook's Assistant", state: i % 2 ? 'complete' : 'not started' }, { id: 7344, name: 'Sheep Shearer', state: 'not started' }], questsAt: now - minute,
            equipment: [], equipmentObserved: true,
            inventory: d.items.map(([id, name, count]) => ({ id, baseId: id, name, count })),
            ranks: [
                { board: 'Overall', rank: 900 + i * 410, level: total, time: `${3 + i}h ${10 + i * 7}m`, delta: 12 - i, since: now - 5 * hour, hist: [940 + i * 410, 921 + i * 410, 900 + i * 410] },
                { board: d.skill, rank: 40 + i * 55, level: d.level, time: `${2 + i}h 5m`, delta: 3, since: now - 2 * hour, hist: [46 + i * 55, 43 + i * 55, 40 + i * 55] },
            ],
            ranksAt: now - 2 * minute, role: d.role, goal: d.goal, currentGoal: d.goal, goalSkill: d.skill, goalLevel: d.level + 1, goalNow: d.level, goalXp: xp,
            xpPerTick: xpPerHour / 9000, xpPerHour, xpLeft, eta: `${Math.floor(xpLeft / xpPerHour * 60)}m 0s`, rateSkill: d.skill, spark: [0.8, 1, 0.9, 1.1, 1].map(f => Math.round(xpPerHour / 9000 * f * 10) / 10),
            uptime: (40 + i * 25) * minute, action: d.online ? d.role : 'idle', death: null, seenInFeed: d.online, lastSeen: now - (d.online ? 4_000 : 3 * hour), outcome: null, training: d.online,
        };
    });
    const online = bots.filter(b => b.inWorld);
    const rival = (board: string, rank: number) => ({ rank, name: `Rival${rank}`, level: board === 'Overall' ? 1500 - rank * 20 : 99 - rank, ticks: 30_000 + rank * 1_500, fleet: false, online: false, x: null, z: null });
    return {
        now, snapshotAt: new Date(now).toISOString(), pageVersion: 1, hosted: { at: now, kind: 'public' },
        world: { players: online.length + 12, tick: 120_000, tickAt: now - 200, tickMs: 600, connected: true, rev: 289 }, worldPlayers: online.length + 12,
        map: { x0: 2368, z0: 2880, w: 560, h: 416, scale: 2, ready: false },
        // Everyone in the world: [name, x, z, level, combat].
        roster: [...online.map(b => [b.name, b.pos.x, b.pos.z, 0, b.combat]), ...Array.from({ length: 12 }, (_, i) => [`Player${i + 1}`, 3200 + i * 7, 3210 + i * 11, 0, 3 + i * 8])],
        bots,
        boards: BOARDS.map((board, k) => {
            const best = bots.flatMap(b => b.ranks.filter(r => r.board === board).map(r => ({ ...r, name: b.name }))).sort((a, b) => a.rank - b.rank)[0] ?? null;
            const top = { name: 'Rival1', level: board === 'Overall' ? 1480 : 98, time: `${1 + k % 4}h 12m`, ticks: 31_500, live: true, at: now - 2 * minute };
            return { board, kind: 'skill', top, best, gap: best ? { kind: 'level', ahead: false, text: `-${top.level - best.level} lvl`, close: best.level / top.level } : null };
        }),
        rivals: BOARDS.slice(0, 3).map(board => ({ board, at: now - 2 * minute, ours: null, rows: [1, 2, 3, 4, 5].map(r => rival(board, r)) })),
        liveTops: BOARDS.length, liveTopsAt: now - 2 * minute,
        lookups: Object.fromEntries([1, 2, 3].map(r => [`rival${r}`, { name: `Rival${r}`, at: now - 2 * minute, rows: [{ board: 'Overall', rank: r, level: 1500 - r * 20, time: '4h 2m' }], online: false, x: null, z: null, plane: null, combat: null, lastSeen: null, worn: null, wornAt: null }])),
        contention: [{ side: 'demo', resource: 'knight:2662,3305', kind: 'knight', x: 2662, z: 3305, others: ['Player3', 'Player7'], ours: ['DemoThief'] }],
        farms: [],
        // Item name -> item id, for each item the bots hold: the page draws the icon from items.png.
        icons: Object.fromEntries(DEMO.flatMap(d => d.items.map(([id, name]) => [name, String(id)]))),
        results: bots.slice(0, 4).map((b, i) => ({ at: now - (i + 1) * 9 * minute, name: b.name, ok: i !== 2, text: i === 2 ? 'ran out of food' : b.goal })),
        events: [], alerts: [],
        economy: { farmers: [], goldPerTick: 0, itemExamine: { Feather: 'Used for fly fishing.' }, itemValues: { Feather: 3, 'Iron ore': 60, 'Willow logs': 25, 'Steel bar': 420 }, pricesAt: now - 5 * minute, supplies: [], trend: [] },
        coordination: { agents: [], available: false, counts: { running: 0, pending: 0, succeeded: 0, failed: 0 }, fresh: false, paused: false, tasks: [] },
        fleetSides: { at: now, sides: [{ side: 'demo', at: now, late: false, accounts: bots.map(b => ({ name: b.name, at: b.at, total: b.skills.reduce((a, s) => a + s.level, 0) })) }] },
    };
}

if (import.meta.main) {
    const out = resolve(process.argv[2] ?? join(import.meta.dir, '..', 'demo'));
    mkdirSync(out, { recursive: true });
    const state = makeDemo(Date.now());
    writeFileSync(join(out, 'public.json'), JSON.stringify(state));
    console.log(`${state.bots.length} demo bots written to ${join(out, 'public.json')}`);
}
