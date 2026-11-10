import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { DATA_FILES, findPrivate, readNames } from '../scripts/check-private';
import { configureServer, DEFAULT_SERVER } from '../scripts/import-page';
import { makeDemo, SKILLS, xpFor } from '../scripts/make-demo';

const shimSource = readFileSync(new URL('../site/shim.js', import.meta.url), 'utf8');
const shim = (page: object) => (runInNewContext(shimSource + '\n;globalThis', page) as { FleetShim: { CONFIG: { repo: string }; pagesRepo(loc: object): string } }).FleetShim;

describe('private data check', () => {
    test('a name matches as a whole word in any case, in text and in a path', () => {
        const files = [{ path: 'a.md', text: 'the bot MYMAIN mined' }, { path: 'b.md', text: 'mymainland' }, { path: 'notes/MyMain.md', text: '' }];
        expect(findPrivate(files, ['MyMain'])).toEqual(['a.md: holds the private name MyMain', 'notes/MyMain.md: holds the private name MyMain']);
    });
    test('a published data file on main is a hit with no name list', () => {
        expect(findPrivate([{ path: 'site/public.json', text: null }, { path: 'site/items.json', text: null }], [])).toEqual(['site/public.json: a data file']);
        expect(DATA_FILES.test('control.json')).toBe(true);
    });
    test('the name list skips blank lines and comments', () => {
        expect(readNames('# mine\nAlpha\r\n\n  Beta  \n')).toEqual(['Alpha', 'Beta']);
    });
});

describe('settings', () => {
    test('the repository comes from config.js, else from a GitHub Pages address, else there is none', () => {
        expect(shim({ FLEET_CONFIG: { repo: 'Owner/fleet' } }).CONFIG.repo).toBe('Owner/fleet');
        expect(shim({ location: { hostname: 'owner.github.io', pathname: '/my-fleet/' } }).CONFIG.repo).toBe('owner/my-fleet');
        expect(shim({ location: { hostname: 'example.com', pathname: '/x/' } }).CONFIG.repo).toBe('');
        expect(shim({}).pagesRepo({ hostname: 'owner.github.io', pathname: '/' })).toBe('');
    });
    test('the page takes the game server from config.js in the feed address and the Hiscores link', () => {
        const html = configureServer(`<a href="https://${DEFAULT_SERVER}/hiscores" target="_blank">x</a><script>set('live','wss://${DEFAULT_SERVER}/worldfeed')</script>`);
        expect(html).toContain("set('live','wss://'+(window.FLEET_CONFIG&&window.FLEET_CONFIG.server||'rs-sdk-demo.fly.dev')+'/worldfeed')");
        expect(html).toContain('onclick="this.href=');
        expect(configureServer(html)).toBe(html);
    });
    test('the imported page loads config.js before shim.js and uses the setting', () => {
        const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
        expect(html.indexOf('config.js')).toBeGreaterThan(0);
        expect(html.indexOf('config.js')).toBeLessThan(html.indexOf('shim.js'));
        expect(html).not.toContain(`'wss://${DEFAULT_SERVER}/worldfeed'`);
    });
});

describe('demo data', () => {
    const now = 1_800_000_000_000, state = makeDemo(now);
    test('passes the checks the shim makes on a snapshot', () => {
        expect(Array.isArray(state.bots)).toBe(true);
        expect(state.now).toBe(now);
        expect(state.hosted).toEqual({ at: now, kind: 'public' });
    });
    test('each bot has every skill, a position and ranks; each roster row is name, x, z, level, combat', () => {
        for (const bot of state.bots) {
            expect(bot.skills.map(s => s.name)).toEqual(SKILLS);
            expect(Number.isInteger(bot.pos.x) && Number.isInteger(bot.pos.z)).toBe(true);
            expect(bot.ranks.length).toBe(2);
        }
        for (const row of state.roster) expect(row.length).toBe(5);
        expect(state.roster.length).toBe(state.worldPlayers);
    });
    test('a bot that is logged out is offline and not in the roster', () => {
        const off = state.bots.filter(b => !b.inWorld);
        expect(off.map(b => b.operation)).toEqual(['offline']);
        expect(state.roster.some(row => row[0] === off[0]!.name)).toBe(false);
    });
    test('the demo XP is on the curve of the page: the level that the page reads from it is the level of the skill', () => {
        const source = readFileSync(new URL('../site/xp-tracker.js', import.meta.url), 'utf8');
        expect(source).toContain('Math.pow(2, level / 10) * 300');
        expect([xpFor(1), xpFor(2), xpFor(99)]).toEqual([0, 80, 998458]);
    });
    test('every item a bot holds has an icon id', () => {
        for (const bot of state.bots) for (const item of bot.inventory) expect(state.icons[item.name]).toBe(String(item.id));
    });
});
