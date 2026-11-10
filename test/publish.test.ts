import { describe, expect, test } from 'bun:test';
import { BOARDS, boardRows, buildState, category, playerRows, Roster, type Known, type RosterRow, type TopRow } from '../scripts/publish';

const span = (ticks: string, time: string) => `<span title="${ticks} ticks normalized to 400 ms per tick">${time}</span>`;
const PLAYER_PAGE = `<table><tr><td>Skill</td><td>Rank</td><td>Level</td><td>Time</td></tr>
<tr><td><a href="/hiscores?category=0&profile=main" class="c">Overall</a></td><td align="right">1,204</td><td align="right">1,310</td><td align="right">${span('33,011', '3h 40m 04s')}</td></tr>
<tr><td><a href="/hiscores?category=15&profile=main" class="c"><img src="/img/skill/mining.png">Mining</a></td><td align="right">13</td><td align="right">99</td><td align="right">${span('10,345', '1h 08m 58s')}</td></tr></table>`;
const BOARD_PAGE = `<table><tr><td align="right" valign="top"> <b>Rank</b><br> 1<br> 2<br> </td><td>&nbsp;</td>
<td valign="top"> <b>Name</b><br> <a href="/hiscores/player/alice?profile=main" class="c">Alice</a><br> <a href="/hiscores/player/bob%20b?profile=main" class="c">Bob B</a><br> </td><td>&nbsp;</td>
<td valign="top"> <b>Level</b><br> 99<br> 98<br> </td><td>&nbsp;</td>
<td align="right" valign="top"> <b>Time</b><br> ${span('3,964', '26m 25s')}<br> ${span('4,317', '28m 46s')}<br> </td></tr></table>`;

describe('hiscore pages', () => {
    test('a player page gives a row for each board that it lists', () => {
        expect(playerRows(PLAYER_PAGE)).toEqual([{ board: 'Overall', rank: 1204, level: 1310, time: '3h 40m 04s' }, { board: 'Mining', rank: 13, level: 99, time: '1h 08m 58s' }]);
        expect(playerRows('<p>No player</p>')).toEqual([]);
    });
    test('a board page gives its players in rank order with level, ticks and time', () => {
        expect(boardRows(BOARD_PAGE)).toEqual([{ rank: 1, name: 'alice', level: 99, ticks: 3964, time: '26m 25s' }, { rank: 2, name: 'bob b', level: 98, ticks: 4317, time: '28m 46s' }]);
        expect(boardRows('<p>down</p>')).toEqual([]);
    });
    test('the category of a board is its place in the skill list of the server', () => {
        expect([category('Overall'), category('Attack'), category('Mining'), category('Runecraft')]).toEqual([0, 1, 15, 21]);
    });
});

describe('world feed roster', () => {
    test('a change frame removes, adds and moves the players of the full frame', () => {
        const roster = new Roster();
        roster.apply({ t: 'roster', p: [[1, 'Alice', 10, 20, 0, 3], [2, 'Bob', 11, 21, 0, 40]] });
        roster.apply({ t: 'roster', d: 1, lv: [2], j: [[3, 'Cara', 5, 6, 1, 9]], m: [[1, 12, 22, 0], [9, 0, 0, 0]] });
        expect([...roster.rows.values()]).toEqual([[1, 'Alice', 12, 22, 0, 3], [3, 'Cara', 5, 6, 1, 9]]);
        roster.apply({ t: 'roster', d: 1, m: [[1, 13, 23, 0, 4]] });
        expect(roster.rows.get(1)).toEqual([1, 'Alice', 13, 23, 0, 4]);
        roster.apply({ t: 'hello' });
        expect(roster.rows.size).toBe(2);
    });
});

describe('the published state', () => {
    const now = 1_800_000_000_000;
    const roster: RosterRow[] = [[1, 'Alice', 3222, 3218, 0, 50], [2, 'Rival', 3100, 3400, 0, 126]];
    const known = new Map<string, Known>([
        ['alice', { rows: [{ board: 'Overall', rank: 40, level: 900, time: '5h 1m 2s' }, { board: 'Mining', rank: 2, level: 98, time: '1h 0m 0s' }, { board: 'Hitpoints', rank: 70, level: 60, time: '2h 0m 0s' }], at: now, first: now - 60_000 }],
        ['bob', { rows: [], at: now, first: now }],
    ]);
    const tops = new Map<string, TopRow[]>([['Mining', [{ rank: 1, name: 'rival', level: 99, ticks: 3964, time: '26m 25s' }, { rank: 2, name: 'alice', level: 98, ticks: 4317, time: '28m 46s' }]]]);
    const state = buildState(now, 'example.test', ['Alice', 'Bob'], roster, known, tops, { players: 0, tick: 7, tickAt: now, tickMs: 600, connected: true, rev: 289 });

    test('a bot in the roster plays at its tile; a bot that is not there is offline', () => {
        const [alice, bob] = state.bots;
        expect([alice!.inWorld, alice!.operation, alice!.live]).toEqual([true, 'observed', { name: 'Alice', x: 3222, z: 3218, level: 0, combat: 50, seen: now }]);
        expect([bob!.inWorld, bob!.operation, bob!.live, bob!.pos]).toEqual([false, 'offline', null, null]);
        expect(alice!.skills.find(s => s.name === 'Mining')!.level).toBe(98);
        expect(alice!.hp).toEqual({ now: 60, max: 60 });
        expect(bob!.skills.find(s => s.name === 'Hitpoints')!.level).toBe(10);
    });
    test('a board names rank 1, the best bot and the gap; the rivals mark the fleet and the players online', () => {
        const mining = state.boards.find(b => b.board === 'Mining')!;
        expect(mining.top!.name).toBe('rival');
        expect([mining.best!.name, mining.best!.rank, mining.gap!.text]).toEqual(['Alice', 2, '-1 lvl']);
        expect<unknown>(state.boards.find(b => b.board === 'Attack')).toEqual({ board: 'Attack', kind: 'skill', top: null, best: null, gap: null });
        expect(state.rivals).toHaveLength(1);
        expect(state.rivals[0]!.rows.map(r => [r.name, r.fleet, r.online, r.x])).toEqual([['rival', false, true, 3100], ['alice', true, true, 3222]]);
    });
    test('the file passes the checks of the shim and lists each player in the world', () => {
        expect(state.now).toBe(now);
        expect(state.hosted).toEqual({ at: now, kind: 'public' });
        expect(state.roster).toEqual([['Alice', 3222, 3218, 0, 50], ['Rival', 3100, 3400, 0, 126]]);
        expect(state.world.players).toBe(2);
        expect(state.boards.map(b => b.board)).toEqual(BOARDS);
    });
});
