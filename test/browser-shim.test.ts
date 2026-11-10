import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { rewrite } from '../scripts/import-page';

const source = readFileSync(new URL('../site/shim.js', import.meta.url), 'utf8');
const minute = 60_000;
function browser(fetch: (url: string, init?: RequestInit) => Promise<Response>) {
    const clock = { now: 100 * minute };
    const page = {
        fetch, Response, AbortSignal, URLSearchParams,
        Date: class extends Date { static now() { return clock.now; } },
        document: { querySelector: () => null, addEventListener() {} },
        location: { hostname: 'example.github.io', search: '' },
    };
    return { clock, api: runInNewContext(source + '\n;globalThis', page) };
}

test('imported owner-aware scripts wait for the shim before initializing, in document order', async () => {
    let finishLogin!: () => void;
    const ready = new Promise<void>(resolve => { finishLogin = resolve; });
    const order: string[] = [];
    const viewer = new EventTarget();
    const frame = Object.assign(new EventTarget(), { contentDocument: {}, contentWindow: viewer });
    const page = { FleetShim: { ready }, order, window: new EventTarget(), $: () => frame };
    const shell = `order.push('shell');
  window.addEventListener('keydown',e=>{
    order.push(e.type);
  },true);
  window.atlasClient={};`;
    runInNewContext(rewrite('client-shell.js', shell), page);
    runInNewContext(rewrite('operations.js', "order.push('operations')"), page);
    expect(order).toEqual([]);
    finishLogin();
    await ready;
    expect(order).toEqual(['shell', 'operations']);
    viewer.dispatchEvent(new Event('keydown'));
    expect(order).toEqual(['shell', 'operations', 'keydown']);
});

test('the browser shim returns JSON for a valid player name inherited from Object.prototype', async () => {
    const { api } = browser(async () => Response.json({ bots: [], now: 1, lookups: {} }));
    const response = await api.fetch('/api/player?name=constructor');
    expect(response.ok).toBe(true);
    expect(await response.json()).toMatchObject({ name: 'constructor', rows: null });
});

test('a failed snapshot poll stays disconnected until a valid snapshot arrives', async () => {
    const { clock, api } = browser(async () => {
        if (reply === 'offline') return new Response('', { status: 503 });
        if (reply === 'malformed') return Response.json({ error: 'bad snapshot' });
        return Response.json({ now: clock.now, bots: [], hosted: { at: clock.now } });
    });
    let reply = 'valid';
    const stream = new api.EventSource('/unused');
    const frames: any[] = [];
    let errors = 0;
    stream.onmessage = (e: any) => frames.push(JSON.parse(e.data));
    stream.onerror = () => errors++;
    await stream.tick();
    clock.now += 10 * minute;
    reply = 'offline';
    await stream.tick();
    stream.heartbeat();
    expect(frames).toHaveLength(1);
    reply = 'malformed';
    await stream.tick();
    expect(errors).toBe(2);
    expect(frames).toHaveLength(1);
    reply = 'valid';
    await stream.tick();
    expect(frames).toHaveLength(2);
    expect(frames[1].hostedAge).toBe(0);
});

test('overlapping reads share one bounded snapshot request', async () => {
    let answer!: (response: Response) => void;
    let requested!: () => void;
    const pending = new Promise<Response>(resolve => { answer = resolve; });
    const started = new Promise<void>(resolve => { requested = resolve; });
    const signals: (AbortSignal | null | undefined)[] = [];
    const { api } = browser(async (_url, init) => {
        signals.push(init?.signal);
        requested();
        return pending;
    });
    const stream = new api.EventSource('/unused');
    const first = stream.tick();
    await started;
    const second = api.fetch('/api/state');
    await new Promise(resolve => setTimeout(resolve, 0));
    answer(Response.json({ now: 1, bots: [] }));
    await Promise.all([first, second]);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
});

test('an older snapshot cannot replace the last good view or lookup data', async () => {
    const { clock, api } = browser(async () => Response.json({
        now: snapshotAt,
        hosted: { at: snapshotAt },
        bots: [],
        revision,
        lookups: { player: { name: 'Player', revision } },
    }));
    let snapshotAt = clock.now, revision = 'current';
    const stream = new api.EventSource('/unused');
    const frames: string[] = [];
    let errors = 0;
    stream.onmessage = (e: any) => frames.push(JSON.parse(e.data).revision);
    stream.onerror = () => errors++;
    await stream.tick();

    clock.now += 10 * minute;
    snapshotAt -= minute;
    revision = 'older';
    await stream.tick();
    stream.heartbeat();
    expect(errors).toBe(1);
    expect(frames).toEqual(['current']);
    expect(await (await api.fetch('/api/player?name=Player')).json()).toMatchObject({ revision: 'current' });

    snapshotAt = clock.now;
    revision = 'newer';
    await stream.tick();
    expect(frames).toEqual(['current', 'newer']);
});

test('legacy snapshots keep aging from the original now timestamp', async () => {
    const { clock, api } = browser(async () => Response.json({ now: clock.now, bots: [] }));
    const stream = new api.EventSource('/unused');
    let age = -1;
    stream.onmessage = (e: any) => { age = JSON.parse(e.data).hostedAge; };
    await stream.tick();
    clock.now += minute;
    stream.heartbeat();
    clock.now += minute;
    stream.heartbeat();
    expect(age).toBe(2 * minute);
});
