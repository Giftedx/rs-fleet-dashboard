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

test('installed player lookup normalizes producer/feed dates once and cannot renew legacy presence through heartbeat clocks', async () => {
    for (const offset of [60_000, -60_000]) {
        let reads = 0;
        const { clock, api } = browser(async () => {
            reads++;
            return Response.json(snapshot, { headers: { date: new Date(serverNow).toUTCString() } });
        });
        const viewerNow = clock.now, serverNow = viewerNow + offset;
        const facts = { at: 123, rows: [{ board: 'Overall', rank: 23, level: 72 }], worn: [{ slot: 'Weapon', name: 'Bronze sword' }], wornAt: 234 };
        const snapshot = { now: serverNow, hosted: { at: serverNow }, bots: [], world: { connected: true, tickAt: serverNow - 5000 }, roster: [['Bob', 10, 20, 0, 33]], lookups: {
            unknown: { ...facts, name: 'Unknown', online: null, presenceObservedAt: null },
            dated: { ...facts, name: 'Dated', online: true, presenceObservedAt: serverNow - 10_000 },
            legacy: { ...facts, name: 'Legacy', online: true },
        } };
        const stream = new api.EventSource('/unused'), frames: any[] = [];
        stream.onmessage = (event: any) => frames.push(JSON.parse(event.data));
        await stream.tick();
        const lookup = async (name: string) => (await api.fetch('/api/player?name=' + name)).json();
        expect(await lookup('Unknown')).toEqual({ ...facts, name: 'Unknown', online: null, presenceObservedAt: null });
        expect(await lookup('Dated')).toEqual({ ...facts, name: 'Dated', online: true, presenceObservedAt: viewerNow - 10_000 });
        expect(await lookup('Legacy')).toEqual({ ...facts, name: 'Legacy', online: true, presenceObservedAt: viewerNow - 5000 });
        expect(await lookup('Bob')).toMatchObject({ online: true, x: 10, z: 20, presenceObservedAt: viewerNow - 5000 });
        expect(snapshot.lookups.dated.presenceObservedAt).toBe(serverNow - 10_000);
        expect(snapshot.lookups.legacy).not.toHaveProperty('presenceObservedAt');
        clock.now += 40_000; stream.heartbeat();
        expect(frames.at(-1)).toMatchObject({ now: clock.now + offset, hostedAge: 40_000, clockOffset: offset });
        expect((await lookup('Unknown')).presenceObservedAt).toBeNull();
        expect((await lookup('Dated')).presenceObservedAt).toBe(viewerNow - 10_000);
        expect((await lookup('Legacy')).presenceObservedAt).toBeNull();
        expect((await lookup('Bob')).presenceObservedAt).toBeNull();
        expect(reads).toBe(1);
    }
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

test('a public collector warning survives clock framing and clears in the actual status consumer on recovery', async () => {
    const warning = 'Fleet data could not be refreshed; showing the last snapshot.';
    let failed = true;
    const { clock, api } = browser(async () => Response.json({
        now: clock.now - minute, hosted: { at: clock.now }, bots: [],
        ...(failed ? { stateError: warning } : {}),
    }));
    const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
    const consumer = html.slice(html.indexOf('function connectionState(){'), html.indexOf("$('#inspector').addEventListener"));
    expect(consumer).toContain('function connectionState(){');
    const raw = { textContent: '', className: '', title: '' }, visible = { ...raw };
    let frozen = false;
    const page = {
        S: null as any, connected: true, lastReceived: clock.now, mode: '2d', VIEWER: {},
        Date: class extends Date { static now() { return clock.now; } },
        performance: { now: () => 20_000 }, $: () => raw,
        document: { body: { classList: { toggle: (_key: string, value: boolean) => { frozen = value; } } }, querySelector: () => visible },
        window: { atlasOperator: () => false, atlasLiveRoster: () => false },
    };
    const stream = new api.EventSource('/unused');
    stream.onmessage = (event: any) => {
        page.S = JSON.parse(event.data); page.lastReceived = clock.now;
        runInNewContext(consumer + ';connectionState();', page);
    };
    await stream.tick();
    expect(page.S.now).toBe(clock.now);
    expect(page.S.stateError).toBe(warning);
    expect([raw.textContent, visible.textContent, frozen]).toEqual(['STATE ERROR', 'STATE ERROR', true]);
    clock.now += 4000; stream.heartbeat();
    expect(page.S.stateError).toBe(warning);
    expect([raw.textContent, frozen]).toEqual(['STATE ERROR', true]);
    failed = false; clock.now += 10 * minute;
    await stream.tick();
    expect(page.S).not.toHaveProperty('stateError');
    expect([raw.textContent, visible.textContent, frozen]).toEqual(['● LIVE', '● LIVE', false]);
});

test('cold cache prefetch stores missing files in Cache API once and exposes in-flight promises immediately via ready', async () => {
    const storeMap = new Map<string, Response>([['/fleet/viewer/caches/rs-sdk-289/main_file_cache.idx0', new Response('cached')]]);
    const putKeys: string[] = [];
    const fetched: string[] = [];
    let finishDat!: (r: Response) => void;
    const datPending = new Promise<Response>(resolve => { finishDat = resolve; });

    const page = {
        Response, AbortSignal, URLSearchParams, URL,
        document: { baseURI: 'https://example.com/fleet/', querySelector: () => null, addEventListener() {} },
        location: { hostname: 'example.com', pathname: '/fleet/', search: '' },
        caches: {
            async open(name: string) {
                expect(name).toBe('rs-sdk-289');
                return {
                    async match(key: string) { return storeMap.get(key); },
                    async put(key: string, resp: Response) { putKeys.push(key); storeMap.set(key, resp); },
                };
            },
        },
        fetch: async (input: string | URL) => {
            const url = String(input);
            fetched.push(url);
            if (url.endsWith('caches.json')) return Response.json([{ name: 'rs-sdk-289' }]);
            if (url.endsWith('main_file_cache.dat')) return datPending;
            if (url.endsWith('main_file_cache.idx2')) return new Response('partial', { status: 206, headers: { 'content-range': 'bytes 0-6/10' } });
            return new Response('ok-' + url.split('/').pop(), { status: 200 });
        },
    };
    const ctx = runInNewContext(source + '\n;globalThis', page) as any;
    expect(ctx.__atlasCachePrefetch).toBeTruthy();
    expect(ctx.__atlasCachePrefetch.files).toBeInstanceOf(ctx.Map);
    await ctx.__atlasCachePrefetch.ready;
    const datUrl = '/fleet/viewer/caches/rs-sdk-289/main_file_cache.dat';
    const idx0Url = '/fleet/viewer/caches/rs-sdk-289/main_file_cache.idx0';
    const idx2Url = '/fleet/viewer/caches/rs-sdk-289/main_file_cache.idx2';
    expect(ctx.__atlasCachePrefetch.files.has(idx0Url)).toBe(false);
    expect(ctx.__atlasCachePrefetch.files.has(datUrl)).toBe(true);

    finishDat(new Response('dat-bytes', { status: 200 }));
    const results = await Promise.all([...ctx.__atlasCachePrefetch.files.values()]);
    expect(results).toContain(true);
    expect(await ctx.__atlasCachePrefetch.files.get(datUrl)).toBe(true);
    expect(ctx.__atlasCachePrefetch.files.has(idx2Url)).toBe(false);
    expect(putKeys).toContain(datUrl);
    expect(putKeys).not.toContain(idx0Url);
    expect(putKeys).not.toContain(idx2Url);
    expect(fetched.filter(u => u.endsWith('main_file_cache.dat'))).toHaveLength(1);
});

test('installed shim answers /api/gear-catalog and /api/death-recap cleanly without network 404', async () => {
    const networkCalls: string[] = [];
    const { api } = browser(async url => {
        networkCalls.push(url);
        return new Response('unexpected', { status: 404 });
    });
    const gear = await api.fetch('/api/gear-catalog');
    expect(gear.status).toBe(200);
    expect(await gear.json()).toEqual([]);
    const recap = await api.fetch('/api/death-recap?name=Bob');
    expect(recap.status).toBe(501);
    expect(await recap.json()).toMatchObject({ error: expect.any(String) });
    expect(networkCalls).toEqual([]);
});
