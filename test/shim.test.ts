import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import '../site/shim.js';

const shim = (globalThis as any).FleetShim;
const ID = '0f2e4a6c-1b3d-4e5f-8a9b-0c1d2e3f4a5b';

describe('route', () => {
    test('maps the local server routes the page uses', () => {
        expect(shim.route('/api/state')).toEqual({ kind: 'state' });
        expect(shim.route('http://localhost:3100/api/state?x=1')).toEqual({ kind: 'state' });
        expect(shim.route('/api/map')).toEqual({ kind: 'file', file: 'map.bin' });
        const viewer = shim.route('/api/viewer-health').body;
        expect(viewer).toMatchObject({ available: true, reason: null });
        const viewerUrl = new URL(viewer.url, 'https://example.com/fleet/');
        expect(viewerUrl.pathname).toBe('/fleet/viewer/');
        expect(viewerUrl.searchParams.get('build')).toMatch(/^[a-f0-9]{10}$/);
        expect(viewerUrl.searchParams.get('live')).toBe('wss://rs-sdk.maxbittker.com/worldfeed');
        expect(shim.route('/api/reveal')).toEqual({ kind: 'reveal' });
        expect(shim.route('/api/our-names')).toEqual({ kind: 'json', body: [] });
        expect(shim.route('/api/hidden-names')).toEqual({ kind: 'json', body: [] });
        expect(shim.route('/api/gear-catalog')).toEqual({ kind: 'json', body: [] });
        expect(shim.route('/api/death-recap?name=Bob')).toEqual({ kind: 'json', status: 501, body: { error: 'Death recap reads tick records on the PC.' } });
        expect(shim.route('/api/control')).toEqual({ kind: 'control' });
        expect(shim.route('/api/control', 'post')).toEqual({ kind: 'command' });
        expect(shim.route('items.png')).toBeNull();
        expect(shim.route('https://api.github.com/user')).toBeNull();
    });
    test('viewer transport adapts the exact demo host and preserves explicit overrides and both queries', () => {
        const source = readFileSync(new URL('../site/shim.js', import.meta.url), 'utf8');
        const cases: [string | undefined, string][] = [
            [undefined, 'wss://rs-sdk.maxbittker.com/worldfeed'],
            ['', 'wss://rs-sdk.maxbittker.com/worldfeed'],
            ['rs-sdk-demo.fly.dev', 'wss://rs-sdk.maxbittker.com/worldfeed'],
            ['rs-sdk.maxbittker.com', 'wss://rs-sdk.maxbittker.com/worldfeed'],
            ['world.example:8443', 'wss://world.example:8443/worldfeed'],
            ['rs-sdk-demo.fly.dev:443', 'wss://rs-sdk-demo.fly.dev:443/worldfeed'],
            ['rs-sdk-demo.fly.dev:8443', 'wss://rs-sdk-demo.fly.dev:8443/worldfeed'],
            ['rs-sdk-demo.fly.dev.other.example', 'wss://rs-sdk-demo.fly.dev.other.example/worldfeed'],
            ['other.example/path/rs-sdk-demo.fly.dev', 'wss://other.example/path/rs-sdk-demo.fly.dev/worldfeed'],
        ];
        for (const [server, expected] of cases) {
            const settings = { server };
            const api = runInNewContext(source + '\n;globalThis.FleetShim', { FLEET_CONFIG: settings });
            const health = api.route('/api/viewer-health').body;
            const url = new URL(health.url, 'https://example.com/fleet/');
            expect(url.pathname).toBe('/fleet/viewer/');
            expect(url.searchParams.get('build')).toMatch(/^[a-f0-9]{10}$/);
            expect(url.searchParams.get('live')).toBe(expected);
            expect([...url.searchParams.keys()]).toEqual(['build', 'live']);
            expect(settings.server).toBe(server);
        }
    });
    test('viewer transport leaves the configured logical host and Hiscores link unchanged', () => {
        const source = readFileSync(new URL('../site/shim.js', import.meta.url), 'utf8');
        const settings = { server: 'rs-sdk-demo.fly.dev' }, link = { href: 'https://example.com/hiscores' }, callbacks: (() => void)[] = [];
        const page = runInNewContext(source + '\n;globalThis', {
            FLEET_CONFIG: settings, Response, AbortSignal, URLSearchParams,
            fetch: async () => Response.json({}), location: { hostname: 'example.com', search: '' },
            document: { querySelector: () => null, querySelectorAll: () => [link], addEventListener: (_type: string, callback: () => void) => callbacks.push(callback) },
        });
        for (const callback of callbacks) callback();
        expect(new URL(page.FleetShim.route('/api/viewer-health').body.url, 'https://example.com/fleet/').searchParams.get('live')).toBe('wss://rs-sdk.maxbittker.com/worldfeed');
        expect(settings.server).toBe('rs-sdk-demo.fly.dev');
        expect(link.href).toBe('https://rs-sdk-demo.fly.dev/hiscores');
    });
});
describe('commands', () => {
    test('the envelope keeps the page fields and adds time and origin', () => {
        const cmd = shim.envelope(JSON.stringify({ id: ID, action: 'account-pause', account: 'DemoMiner' }), 1000);
        expect(cmd).toEqual({ id: ID, action: 'account-pause', account: 'DemoMiner', at: 1000, by: 'control-page' });
        expect(() => shim.envelope('{"action":"plan"}')).toThrow('id and an action');
        expect(() => shim.envelope('nope')).toThrow();
    });
    test('the acknowledgement names the task and says the PC has it next', () => {
        expect(shim.acknowledgement({ id: ID, action: 'queue', at: 1, task: { id: 'operator-' + ID } })).toEqual({ id: ID, action: 'queue', taskId: 'operator-' + ID, at: 1, status: 'sent-to-pc' });
    });
    test('the command file goes under commands/ on main with the envelope as its content', () => {
        const cmd = { id: ID, action: 'account-pause', account: 'DemoMiner', at: 1, by: 'control-page' };
        const req = shim.commandRequest('Example/fleet', cmd);
        expect(req.path).toBe(`/repos/Example/fleet/contents/commands/${ID}.json`);
        expect(req.body.branch).toBe('main');
        expect(req.body.message).toBe('fleet command: account-pause DemoMiner');
        expect(JSON.parse(Buffer.from(req.body.content, 'base64').toString('utf8'))).toEqual(cmd);
        expect(Buffer.from(shim.toBase64('⟦MAIN⟧ é'), 'base64').toString('utf8')).toBe('⟦MAIN⟧ é');
    });
});
describe('control metadata and the owner gate', () => {
    test('the page gets the PC metadata with a fixed nonce; none before the first control.json', () => {
        expect(shim.controlMeta({ control: { goals: ['wealth'], requests: [] } })).toEqual({ goals: ['wealth'], requests: [], nonce: 'github' });
        shim.sent.push({ id: 'cmd-1', action: 'plan', at: Date.now() }, { id: 'cmd-2', action: 'pause', at: Date.now() });
        const meta = shim.controlMeta({ control: { requests: [{ id: 'cmd-2', action: 'pause', at: 1, status: 'stop-requested' }] } });
        expect(meta.requests.map((r: any) => r.id + ':' + r.status)).toEqual(['cmd-1:waiting for the PC', 'cmd-2:stop-requested']);
        shim.sent.length = 0;
        expect(shim.controlMeta({ control: null })).toBeNull();
        expect(shim.controlMeta(null)).toBeNull();
    });
    test('only the repository owner may sign in', () => {
        expect(shim.acceptLogin({ login: 'Example' }, 'Example/fleet')).toEqual({ ok: true, login: 'Example' });
        expect(shim.acceptLogin({ login: 'example' }, 'Example/fleet').ok).toBe(true);
        expect(shim.acceptLogin({ login: 'intruder' }, 'Example/fleet')).toEqual({ ok: false, reason: 'this token belongs to intruder, not the owner' });
        expect(shim.acceptLogin(null, 'Example/fleet').ok).toBe(false);
        expect(shim.acceptLogin({}, 'Example/fleet').ok).toBe(false);
    });
    test('the public refusal is the text the page shows', () => {
        expect(shim.PUBLIC_REFUSAL).toBe('Public view is read only. Sign in as the owner to send commands.');
        expect(shim.MAIN_MARK).toBe('⟦MAIN⟧');
    });
});

describe('player lookup', () => {
    const now = 1_000_000;
    const lookupShim = () => runInNewContext(readFileSync(new URL('../site/shim.js', import.meta.url), 'utf8') + '\n;globalThis.FleetShim', {
        Date: class extends Date { static now() { return now; } },
    });
    const kept = { name: 'Zezima', at: 123, online: true, rows: [{ board: 'Attack', rank: 1, level: 99 }], worn: [{ slot: 'Weapon', name: 'Bronze sword' }], wornAt: 234 };
    const state = () => ({ now, world: { connected: true, tickAt: now - 5000 }, lookups: { zezima: kept }, roster: [['Bob', 10, 20, 0, 33]] });

    test('explicit published presence stamps and unknowns cannot be replaced by the collector clock', () => {
        const api = lookupShim();
        for (const presenceObservedAt of [null, now - 10_000, now - 40_000]) {
            const receipt = { ...kept, presenceObservedAt }, input = { ...state(), lookups: { zezima: receipt } };
            expect(api.playerLookup(input, 'Zezima')).toEqual(receipt);
            expect(receipt.presenceObservedAt).toBe(presenceObservedAt);
        }
        for (const presenceObservedAt of [undefined, 0, -1, NaN, Infinity, String(now), now + 1]) {
            const receipt = { ...kept, presenceObservedAt };
            expect(api.playerLookup({ ...state(), lookups: { zezima: receipt } }, 'Zezima')).toEqual({ ...kept, presenceObservedAt: null });
            expect(Object.hasOwn(receipt, 'presenceObservedAt')).toBe(true);
            expect(Object.is(receipt.presenceObservedAt, presenceObservedAt)).toBe(true);
        }
    });

    test('legacy published entries and roster-only lookups use the actual feed tick rather than collector now', () => {
        const api = lookupShim(), input = state();
        expect(api.playerLookup(input, 'Zezima')).toEqual({ ...kept, presenceObservedAt: now - 5000 });
        expect(api.playerLookup(input, 'Bob')).toMatchObject({ online: true, x: 10, z: 20, presenceObservedAt: now - 5000 });
        expect(api.playerLookup(input, 'Nobody')).toMatchObject({ online: false, presenceObservedAt: now - 5000 });
        expect(kept).not.toHaveProperty('presenceObservedAt');
        const legacy = { ...input, hosted: { at: now - 2000 }, world: { connected: true } };
        expect(api.playerLookup(legacy, 'Zezima').presenceObservedAt).toBe(now - 2000);
        expect(api.playerLookup({ ...legacy, world: { connected: true, tickAt: undefined } }, 'Zezima').presenceObservedAt).toBeNull();
    });

    test('legacy presence needs both a fresh valid collector receipt and fresh valid feed evidence', () => {
        const api = lookupShim(), input = state();
        const invalid = [
            ...[undefined, null, NaN, Infinity, 0, -1, String(now), now + 1, now - 30_000].map(value => ({ ...input, now: value })),
            ...[undefined, null, NaN, Infinity, 0, -1, String(now), now + 1, now - 30_000].map(tickAt => ({ ...input, world: { connected: true, tickAt } })),
            { ...input, world: { connected: false, tickAt: now } }, { ...input, stateError: 'unavailable' },
            { ...input, now: now - 40_000, hosted: { at: now }, world: { connected: true, tickAt: now } },
            { ...input, world: { connected: true }, hosted: { at: null } },
        ];
        for (const value of invalid) for (const name of ['Zezima', 'Bob', 'Nobody'])
            expect(api.playerLookup(value, name).presenceObservedAt).toBeNull();
    });
    test('routes /api/player with its name', () => {
        expect(shim.route('/api/player?name=Zezima')).toEqual({ kind: 'player', name: 'Zezima' });
    });
    test('answers from the published lookups, else from the roster without hiscores', () => {
        const current = Date.now(), lookupState = { now: current, world: { connected: true, tickAt: current }, lookups: { zezima: { name: 'Zezima', rows: [{ board: 'Attack', rank: 1, level: 99, time: '1h' }] } }, roster: [['Bob', 10, 20, 0, 33]] };
        expect(shim.playerLookup(lookupState, 'zezima').rows[0].level).toBe(99);
        const bob = shim.playerLookup(lookupState, 'Bob');
        expect([bob.online, bob.x, bob.z, bob.combat, bob.rows]).toEqual([true, 10, 20, 33, null]);
        expect(bob.note).toContain('top 10');
        expect(bob.wild).toBeUndefined();
        const wildState = { now: current, world: { connected: true, tickAt: current }, roster: [['PKer', 3094, 3600, 0, 75]] };
        const pker = shim.playerLookup(wildState, 'PKer');
        expect(pker).toMatchObject({ online: true, x: 3094, z: 3600, combat: 75, wild: { wild: 11, minCombat: 64, maxCombat: 86 } });
        expect(pker.note).toContain('no CORS');
        expect(shim.playerLookup(lookupState, 'bad name!').error).toBeTruthy();
    });
});

describe('public polls', () => {
    test('a public file is fetched again only once the next one is due', () => {
        const now = 10_000_000;
        expect(shim.publicDue(null, now)).toBe(true);
        expect(shim.publicDue({ hosted: {} }, now)).toBe(true);
        expect(shim.publicDue({ hosted: { at: now - 60_000 } }, now)).toBe(false);
        expect(shim.publicDue({ hosted: { at: now - 600_000 } }, now)).toBe(true);
    });
    test('the viewer clock offset comes from the Date header; a missing or bad header gives none', () => {
        const now = Date.parse('Sun, 01 Nov 2026 03:27:23 GMT');
        expect(shim.offsetFrom('Sun, 01 Nov 2026 03:32:23 GMT', now)).toBe(300_000);
        expect(shim.offsetFrom(null, now)).toBe(0);expect(shim.offsetFrom('soon', now)).toBe(0);
    });
});
describe('data age', () => {
    test('a file is stale once current() stops counting it live: 15 minutes public, 3 minutes control', () => {
        const at = 1_000_000, min = 60000;
        expect(shim.dataAge({ hosted: { at } }, at + 14 * min, false).stale).toBe(false);
        expect(shim.dataAge({ hosted: { at } }, at + 16 * min, false)).toEqual({ at, ms: 16 * min, stale: true, text: '16m' });
        expect(shim.dataAge({ hosted: { at } }, at + 4 * min, true).stale).toBe(true);
        expect(shim.dataAge({ now: at }, at + 5 * min, false).stale).toBe(false);
        expect(shim.dataAge({}, at, false)).toBeNull();
    });
    test('the age reads in days and hours, hours and minutes, or minutes', () => {
        expect(shim.ageText((3 * 24 + 3) * 3600e3 + 40 * 60e3)).toBe('3d 3h');
        expect(shim.ageText(2 * 3600e3 + 5 * 60e3)).toBe('2h 5m');
        expect(shim.ageText(59e3)).toBe('0m');
    });
});
