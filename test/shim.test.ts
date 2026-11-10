import { describe, expect, test } from 'bun:test';
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
        expect(viewer.url).toMatch(/^viewer\/\?build=[a-f0-9]{10}$/);
        expect(shim.route('/api/reveal')).toEqual({ kind: 'reveal' });
        expect(shim.route('/api/hidden-names')).toEqual({ kind: 'json', body: [] });
        expect(shim.route('/api/control')).toEqual({ kind: 'control' });
        expect(shim.route('/api/control', 'post')).toEqual({ kind: 'command' });
        expect(shim.route('items.png')).toBeNull();
        expect(shim.route('https://api.github.com/user')).toBeNull();
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
    test('routes /api/player with its name', () => {
        expect(shim.route('/api/player?name=Zezima')).toEqual({ kind: 'player', name: 'Zezima' });
    });
    test('answers from the published lookups, else from the roster without hiscores', () => {
        const state = { lookups: { zezima: { name: 'Zezima', rows: [{ board: 'Attack', rank: 1, level: 99, time: '1h' }] } }, roster: [['Bob', 10, 20, 0, 33]] };
        expect(shim.playerLookup(state, 'zezima').rows[0].level).toBe(99);
        const bob = shim.playerLookup(state, 'Bob');
        expect([bob.online, bob.x, bob.z, bob.combat, bob.rows]).toEqual([true, 10, 20, 33, null]);
        expect(bob.note).toContain('top 10');
        expect(shim.playerLookup(state, 'bad name!').error).toBeTruthy();
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
