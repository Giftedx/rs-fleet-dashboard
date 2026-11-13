// Runs before the page's own scripts. It stands in for the local dashboard server: the page's fetches of /api/* and
// its EventSource('/events') are answered from public.json next to the page (GitHub Pages) or, once the owner has
// signed in with a GitHub token, from control.json on the repository's data branch; a command becomes a file under
// commands/ on main, which the publisher applies. The pure parts hang on globalThis.FleetShim so bun can test
// them; the install step runs only in a browser.
(function (global) {
    // config.js (loaded before this file) names the GitHub repository that holds the data and takes the commands.
    // On <owner>.github.io/<repo>/ the address gives it. With no repository the page is public view only.
    function pagesRepo(loc) {
        const owner = /^([a-z0-9-]+)\.github\.io$/i.exec(loc && loc.hostname || ''), repo = String(loc && loc.pathname || '').split('/')[1];
        // A user site (<owner>.github.io with no project folder) has a file name there, or nothing.
        return owner && repo && !repo.includes('.') ? owner[1] + '/' + repo : '';
    }
    const SETTINGS = global.FLEET_CONFIG || {};
    const CONFIG = { repo: SETTINGS.repo || pagesRepo(global.location), publicPollMs: 30000, publicEveryMs: 600000, controlPollMs: 30000, publicFreshMs: 15 * 60000, controlFreshMs: 3 * 60000, heartbeatMs: 4000, tokenKey: 'fleet-command.token', api: 'https://api.github.com' };
    const CONTROL_PATH = '/repos/' + CONFIG.repo + '/contents/control.json?ref=data';
    let clockOffset = 0; // viewer clock against the Pages server's Date header, for publicDue
    const MAIN_MARK = '⟦MAIN⟧';
    const PUBLIC_REFUSAL = 'Public view is read only. Sign in as the owner to send commands.';

    function route(url, method) {
        const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
        if (path === '/api/state') return { kind: 'state' };
        if (path === '/api/map') return { kind: 'file', file: 'map.bin' };
        // The 3D viewer is hosted next to the page (viewer/, a build of the rs-world fork); it streams
        // the public world feed itself and reads api/hidden-names and api/our-names as files beside the page.
        if (path === '/api/viewer-health') return { kind: 'json', body: { available: true, url: 'viewer/?build=eda9928ac8', reason: null } };
        if (path === '/api/viewer-timing') return { kind: 'json', body: { ok: true } };
        if (path === '/api/reveal') return { kind: 'reveal' };
        if (path === '/api/our-names' || path === '/api/hidden-names') return { kind: 'json', body: [] };
        if (path === '/api/control') return { kind: (method || 'GET').toUpperCase() === 'POST' ? 'command' : 'control' };
        if (path === '/api/player') return { kind: 'player', name: new URLSearchParams(String(url).split('?')[1] || '').get('name') || '' };
        return null;
    }
    // A player lookup on the hosted page: the demo hiscores send no CORS header, so the page cannot read them here.
    // The published state carries the lookups the PC keeps (each board's 10 rivals, the players at our spots); for any
    // other name the answer is where the world feed saw the player, without hiscores.
    function playerLookup(state, name) {
        if (!/^[A-Za-z0-9_ -]{1,12}$/.test(name)) return { error: 'a player name is 1-12 letters, digits, spaces, - or _' };
        const key = name.toLowerCase(), lookups = state?.lookups;
        const kept = lookups && Object.hasOwn(lookups, key) ? lookups[key] : null;
        if (kept) return kept;
        const seen = (state && Array.isArray(state.roster) ? state.roster : []).find(r => String(r[0]).toLowerCase() === key);
        return { name, at: null, rows: null, online: !!seen, x: seen ? seen[1] : null, z: seen ? seen[2] : null, plane: seen ? seen[3] : null, combat: seen ? seen[4] : null, lastSeen: null,
            note: 'Hiscores show here only for the top 10 on each board and players near our accounts.' };
    }
    // The page's command envelope plus the time and origin the PC checks.
    function envelope(body, now) {
        const cmd = JSON.parse(body);
        if (!cmd || typeof cmd !== 'object' || typeof cmd.id !== 'string' || typeof cmd.action !== 'string') throw Error('command needs an id and an action');
        return Object.assign({}, cmd, { at: now == null ? Date.now() : now, by: 'control-page' });
    }
    // What the page gets back at once; the PC's receipt arrives later in the command ledger.
    function acknowledgement(cmd) { return { id: cmd.id, action: cmd.action, taskId: cmd.task && cmd.task.id, at: cmd.at, status: 'sent-to-pc' }; }
    // Commands this page sent and the PC has not answered yet show as waiting in the command list.
    const sent = [];
    function controlMeta(control) {
        const meta = control && control.control; if (!meta || typeof meta !== 'object') return null;
        const requests = Array.isArray(meta.requests) ? meta.requests : [];
        const known = new Set(requests.map(r => r.id));
        const waiting = sent.filter(c => !known.has(c.id) && Date.now() - c.at < 30 * 60000).map(c => ({ id: c.id, action: c.action, at: c.at, taskId: c.taskId || null, status: 'waiting for the PC' }));
        return Object.assign({}, meta, { nonce: 'github', requests: waiting.concat(requests) });
    }
    // The token must belong to the owner of the repository, whoever holds it.
    function acceptLogin(user, repo) {
        const owner = String(repo).split('/')[0];
        if (!user || typeof user.login !== 'string') return { ok: false, reason: 'the token names no user' };
        if (user.login.toLowerCase() !== owner.toLowerCase()) return { ok: false, reason: 'this token belongs to ' + user.login + ', not the owner' };
        return { ok: true, login: user.login };
    }
    function toBase64(text) { return btoa(String.fromCharCode.apply(null, Array.from(new TextEncoder().encode(text)))); }
    function commandRequest(repo, cmd) {
        return { path: '/repos/' + repo + '/contents/commands/' + cmd.id + '.json', body: { message: 'fleet command: ' + cmd.action + (cmd.account ? ' ' + cmd.account : ''), branch: 'main', content: toBase64(JSON.stringify(cmd)) } };
    }
    function snapshotAt(state) {
        return Number.isFinite(state?.hosted?.at) ? state.hosted.at : Number.isFinite(state?.now) ? state.now : null;
    }
    // How old the loaded file is, and whether the PC has missed its publishing: past the age at which current() stops
    // counting the file as live, the page says so. A stopped publisher leaves the last file up.
    function dataAge(state, now, control) {
        const at = snapshotAt(state);
        if (at == null) return null;
        const ms = Math.max(0, now - at), limit = control ? CONFIG.controlFreshMs : CONFIG.publicFreshMs;
        return { at, ms, stale: ms >= limit, text: ageText(ms) };
    }
    function ageText(ms) {
        const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
        return d ? d + 'd ' + (h % 24) + 'h' : h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
    }
    // The public file loses nothing the page needs; the main account's row is gone and its name is masked already.
    global.FleetShim = { CONFIG, pagesRepo, MAIN_MARK, PUBLIC_REFUSAL, route, envelope, acknowledgement, controlMeta, acceptLogin, commandRequest, toBase64, playerLookup, publicDue, offsetFrom, dataAge, ageText, sent };
    if (!global.document || !global.fetch) return;

    // ---------- browser install ----------
    const fetch0 = global.fetch.bind(global);
    const json = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: { 'content-type': 'application/json' } });
    const store = { get() { try { return localStorage.getItem(CONFIG.tokenKey) || ''; } catch { return ''; } }, set(v) { try { v ? localStorage.setItem(CONFIG.tokenKey, v) : localStorage.removeItem(CONFIG.tokenKey); return true; } catch { return false; } } };
    // On localhost, ?control previews the control view without a token: control.json is read next to the page and
    // commands are acknowledged but not sent (FleetShim.previewCommands keeps them).
    const PREVIEW = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('control');
    let token = store.get(), login = null, latest = null, pending = null, lastError = '', snapshotError = '', authError = '', age = null;
    const readSignal = () => AbortSignal.timeout(10000);
    global.FleetShim.previewCommands = [];
    const signedIn = () => !!login;
    global.FleetShim.signedIn = () => login;
    global.FleetShim.signOut = () => { store.set(''); location.reload(); };
    async function api(path, init = {}, credential = token) {
        const { accept = 'application/vnd.github+json', ...options } = init;
        const headers = { authorization: 'Bearer ' + credential, accept, 'x-github-api-version': '2022-11-28' };
        const signal = options.method === 'PUT' ? undefined : readSignal();
        const response = await fetch0(CONFIG.api + path, { ...options, signal, headers });
        if (!response.ok) {
            const error = new Error('GitHub returned HTTP ' + response.status + ' for ' + path);
            error.status = response.status;
            throw error;
        }
        return response;
    }
    // A file younger than its refresh period is current: its clock moves on so the page reads it as live. Every file
    // carries its age in hostedAge, measured on the PC's clock (the Pages Date header gives the offset).
    function snapshotFrame(state, measured) {
        return { ...state, hostedAge: measured.ms, clockOffset, now: measured.stale ? state.now : measured.at + measured.ms };
    }
    // api.github.com does not expose its Date header to the page, so the signed-in view reads the offset from Pages.
    let clockSynced = false;
    async function syncClock() {
        if (clockSynced) return;
        clockSynced = true;
        try { const r = await fetch0('shim.js', { method: 'HEAD', cache: 'no-store', signal: readSignal() }); clockOffset = offsetFrom(r.headers.get('date'), Date.now()); } catch { /* keep the viewer clock */ }
    }
    async function readState() {
        await ready;
        let response;
        if (signedIn() && !PREVIEW) {
            await syncClock();
            response = await api(CONTROL_PATH, { accept: 'application/vnd.github.raw+json' });
        } else {
            const file = PREVIEW ? 'control.json' : 'public.json';
            response = await fetch0(file + '?t=' + Date.now(), { cache: 'no-store', signal: readSignal() });
            if (!response.ok) throw Error(file + ' returned HTTP ' + response.status);
            clockOffset = offsetFrom(response.headers.get('date'), Date.now());
        }
        const state = await response.json();
        if (!Array.isArray(state?.bots) || !Number.isFinite(state.now)) throw Error('Invalid fleet snapshot');
        if (latest && snapshotAt(state) < snapshotAt(latest)) throw Error('Received an older fleet snapshot');
        latest = state;
        return state;
    }
    function loadState() {
        return pending ??= readState().finally(() => { pending = null; });
    }
    global.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : input && input.url;
        const r = route(url, init && init.method);
        if (!r) return fetch0(input, init);
        try {
            if (r.kind === 'json') return json(r.body);
            if (r.kind === 'file') return fetch0(r.file);
            if (r.kind === 'state') {
                const state = await loadState();
                lastError = '';
                snapshotError = '';
                age = dataAge(state, Date.now() + clockOffset, signedIn());
                badge();
                return json(snapshotFrame(state, age));
            }
            if (r.kind === 'player') return json(playerLookup(latest || await loadState(), r.name));
            await ready;
            if (r.kind === 'reveal') return new Response(signedIn() && latest && latest.revealName ? latest.revealName : MAIN_MARK, { headers: { 'content-type': 'text/plain' } });
            if (!signedIn()) return json({ error: PUBLIC_REFUSAL }, 403);
            if (r.kind === 'control') { const meta = controlMeta(latest || await loadState()); return meta ? json(meta) : json({ error: 'control.json carries no command metadata yet' }, 503); }
            const cmd = envelope(init && init.body || '{}');
            const req = commandRequest(CONFIG.repo, cmd);
            if (PREVIEW) { global.FleetShim.previewCommands.push(cmd); sent.push(acknowledgement(cmd)); return json(Object.assign(acknowledgement(cmd), { status: 'preview-only' })); }
            await api(req.path, { method: 'PUT', body: JSON.stringify(req.body) });
            sent.push(acknowledgement(cmd));
            return json(acknowledgement(cmd));
        } catch (e) {
            const error = String(e && e.message || e);
            if (r.kind === 'state') snapshotError = error;
            else lastError = error;
            badge();
            return json({ error }, 502);
        }
    };
    // The PC writes public.json at most every publicEveryMs: until the next one is due, a public poll keeps the file
    // it has (425 KB, 68 KB compressed) instead of downloading it again every 30 s.
    // hosted.at is the PC's clock; a viewer clock minutes off would wait that much longer, so the wait uses the
    // offset the last response's Date header gave.
    function offsetFrom(dateHeader, now) { const t = Date.parse(dateHeader || ''); return Number.isFinite(t) ? t - now : 0; }
    function publicDue(last, now) { return !last || !last.hosted || !Number.isFinite(last.hosted.at) || now + clockOffset - last.hosted.at >= CONFIG.publicEveryMs; }
    // The page opens EventSource('/events') for a state every 2 s; here a poll of the published file stands in.
    global.EventSource = class {
        constructor(url) {
            this.onmessage = null; this.onerror = null; this.readyState = 1; this.last = null;
            if (route(url) || url === '/events') { this.tick(); this.timer = setInterval(() => this.tick(), signedIn() ? CONFIG.controlPollMs : CONFIG.publicPollMs); this.beat = setInterval(() => this.heartbeat(), CONFIG.heartbeatMs); }
        }
        async tick() {
            if (this.readyState === 2 || this.polling || !signedIn() && !publicDue(this.last, Date.now())) return;
            this.polling = true;
            try {
                const state = await loadState();
                if (this.readyState === 2) return;
                this.last = state;
                this.failed = false;
                lastError = '';
                snapshotError = '';
                this.heartbeat(true);
            } catch (error) {
                if (this.readyState === 2) return;
                this.failed = true;
                snapshotError = String(error.message || error);
                badge();
                this.onerror?.(error);
            } finally { this.polling = false; }
        }
        heartbeat(published = false) {
            if (!this.last) return;
            const measured = dataAge(this.last, Date.now() + clockOffset, signedIn());
            const changed = !age || age.stale !== measured.stale || age.text !== measured.text;
            age = measured;
            if (published || changed) badge();
            if (!this.failed && (published || !age.stale)) this.onmessage?.({ data: JSON.stringify(snapshotFrame(this.last, measured)) });
        }
        close() { clearInterval(this.timer); clearInterval(this.beat); this.readyState = 2; }
    };
    // Sign-in lives in the page's own title bar (client-shell.js builds it after this script runs). The token goes to
    // GitHub only, over the API, never to the page's own origin.
    function badge() {
        const title = document.querySelector('.client-title');
        if (!title) { if (document.body) setTimeout(badge, 200); return; }
        let box = document.getElementById('fleet-bar');
        if (!document.getElementById('fleet-style')) { const st = document.createElement('style'); st.id = 'fleet-style'; st.textContent = '#fleet-bar{white-space:nowrap}@media(max-width:740px){#fleet-bar>span{display:none}}#fleet-signin-box::backdrop{background:#0009}' +
            '#fleet-stale{position:fixed;left:0;right:0;top:28px;height:22px;box-sizing:border-box;z-index:75;padding:0 10px;background:#5a1410;border-bottom:1px solid #000;color:#ffd7a0;font:12px/21px Arial,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '.fleet-stale #world-panel,.fleet-stale .game-hud,.fleet-stale .client-plugin,.fleet-stale .client-rail{top:50px!important}'; document.head.appendChild(st); }
        if (!box) { box = document.createElement('span'); box.id = 'fleet-bar'; box.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:6px;font:11px Arial,sans-serif;color:#bbb'; const anchor = title.querySelector('#client-sidebar'); title.insertBefore(box, anchor || null); }
        const state = (PREVIEW ? 'Control preview · commands are not sent' : signedIn() ? 'Control · ' + login : 'Public view · read only') + (age && age.stale ? ' · data ' + age.text + ' old' : '');
        const buttonId = signedIn() ? 'fleet-signout' : 'fleet-signin';
        if (!box.querySelector('#' + buttonId)) {
            box.innerHTML = '<span></span><button id="' + buttonId + '"></button>';
            const button = box.querySelector('button');
            button.textContent = signedIn() ? 'Sign out' : 'Sign in';
            button.title = signedIn() ? 'Sign out' : 'Sign in as owner';
            button.style.cssText = 'font:11px Arial,sans-serif;background:#2a2114;color:#f0e0b8;border:1px solid #6b5631;border-radius:3px;padding:1px 7px;cursor:pointer';
            button.onclick = signedIn() ? global.FleetShim.signOut : askToken;
            button.hidden = !CONFIG.repo && !signedIn();
        }
        const label = box.querySelector('span'), problem = authError || snapshotError || lastError;
        label.title = problem;
        label.style.color = problem ? '#e0a060' : '';
        label.textContent = problem ? state + ' · ' + problem.slice(0, 60) : state;
        staleBar();
    }
    // Keep refresh failures visible while the last good snapshot is still on screen.
    function staleBar() {
        let bar = document.getElementById('fleet-stale');
        const visible = !!(age?.stale || snapshotError || authError);
        document.documentElement.classList.toggle('fleet-stale', visible);
        if (!visible) { if (bar) bar.remove(); return; }
        if (!bar) {
            bar = document.createElement('div'); bar.id = 'fleet-stale'; bar.setAttribute('role', 'status');
            document.body.appendChild(bar);
        }
        const when = age?.stale ? new Date(age.at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '';
        const message = authError || (snapshotError ? (age ? 'Fleet refresh failed. Showing the last snapshot (' + age.text + ' old).' :
            'Fleet snapshot unavailable. Retrying automatically.') :
            'Fleet snapshot is ' + age.text + ' old. The world feed updates separately.');
        if (bar.textContent !== message) bar.textContent = message;
        bar.title = [message, snapshotError, when].filter(Boolean).join(' ');
    }
    function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
    async function checkControlRead(candidate) {
        try {
            const response = await api(CONTROL_PATH, { accept: 'application/vnd.github.object+json', cache: 'no-store' }, candidate);
            if ((await response.json()).type === 'file') return;
        } catch (error) {
            if (error.status !== 403 && error.status !== 404) throw error;
        }
        throw Error('Could not read the private fleet snapshot. Check the selected repository and Contents permission.');
    }
    function askToken() {
        if (document.getElementById('fleet-signin-box')) return;
        const box = document.createElement('dialog');
        box.id = 'fleet-signin-box';
        box.setAttribute('aria-labelledby', 'fleet-signin-title');
        // The look of a RuneLite side panel: a dark flat card, an orange title, a flat field and the panel's buttons.
        box.style.cssText = 'box-sizing:border-box;width:min(340px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;padding:0;background:#282828;border:1px solid #3c3c3c;border-radius:4px;box-shadow:0 12px 40px #000a;color:#c6c6c6;font:12px Arial,sans-serif;text-align:left';
        box.innerHTML = '<form style="display:grid;gap:10px;padding:0 12px 12px"><div style="display:flex;align-items:center;gap:8px;margin:0 -12px;padding:8px 12px;background:#1e1e1e;border-bottom:1px solid #3c3c3c"><img src="client-assets/runelite.png" alt="" width="16" height="16"><b id="fleet-signin-title" style="color:#ff981f;font:bold 13px Arial,sans-serif">Owner sign-in</b></div>' +
            '<label for="fleet-token">GitHub token for <b style="color:#fff;font-weight:normal">' + escapeHtml(CONFIG.repo) + '</b></label>' +
            '<input id="fleet-token" type="password" autocomplete="off" required autofocus placeholder="github_pat_..." style="min-width:0;font:12px Arial,sans-serif;padding:7px 8px;background:#1b1b1b;color:#fff;border:1px solid #111;border-radius:3px">' +
            '<div style="display:flex;gap:8px;align-items:center"><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" style="color:#ff981f;margin-right:auto">Create a token</a><button id="fleet-cancel" type="button">Cancel</button><button id="fleet-go" type="submit">Login</button></div><div id="fleet-signin-error" role="alert" style="color:#ff6a5a"></div><details style="color:#a0a0a0"><summary style="cursor:pointer">Which token?</summary><p style="margin:6px 0 0">A fine-grained token for this repository only, with Contents set to read and write. It stays in this browser. The PC accepts a command only when GitHub says the repository owner committed it.</p></details></form>';
        for (const b of box.querySelectorAll('button')) b.style.cssText = 'font:12px Arial,sans-serif;padding:6px 16px;border-radius:3px;cursor:pointer;' + (b.id === 'fleet-go' ? 'background:#dc8a00;border:1px solid #111;color:#111;font-weight:bold' : 'background:#353535;border:1px solid #555;color:#ccc');
        box.addEventListener('close', () => { box.remove(); document.getElementById('fleet-signin')?.focus(); }, { once: true });
        box.querySelector('#fleet-cancel').onclick = () => box.close();
        const submit = box.querySelector('#fleet-go'), input = box.querySelector('#fleet-token'), notice = box.querySelector('#fleet-signin-error');
        box.querySelector('form').onsubmit = async event => {
            event.preventDefault();
            if (submit.disabled) return;
            const candidate = input.value.trim();
            if (!candidate) { notice.textContent = 'Enter a token.'; return; }
            notice.textContent = '';
            submit.disabled = true;
            input.readOnly = true;
            try {
                const verdict = acceptLogin(await (await api('/user', { cache: 'no-store' }, candidate)).json(), CONFIG.repo);
                if (!verdict.ok) throw Error(verdict.reason);
                if (!box.open) return;
                await checkControlRead(candidate);
                if (!box.open) return;
                if (!store.set(candidate)) throw Error('This browser could not save the token.');
                location.reload();
            } catch (error) {
                if (!box.open) return;
                notice.textContent = String(error.message || error);
                submit.disabled = false;
                input.readOnly = false;
                input.focus();
            }
        };
        document.body.appendChild(box);
        box.showModal();
    }
    async function start() {
        if (PREVIEW) { login = 'preview'; badge(); return; }
        if (token) {
            try {
                const verdict = acceptLogin(await (await api('/user')).json(), CONFIG.repo);
                if (verdict.ok) login = verdict.login;
                else { authError = 'Saved sign-in refused: ' + verdict.reason; store.set(''); }
            } catch (error) {
                if (error.status === 401) { authError = 'Saved sign-in expired. Sign in again.'; store.set(''); }
                else authError = 'Could not check owner sign-in. Reload to retry.';
            }
        }
        badge();
    }
    // The page's inline script runs after this one and opens the EventSource; the token check must finish first,
    // so the first state load waits on it.
    const ready = global.FleetShim.ready = start();
    // The page names the default game server in its Hiscores link. config.js can name a different one.
    function serverLinks() {
        if (!SETTINGS.server) return;
        for (const link of document.querySelectorAll('a[href$="/hiscores"]')) link.href = 'https://' + SETTINGS.server + '/hiscores';
    }
    document.addEventListener('DOMContentLoaded', serverLinks);
    document.addEventListener('DOMContentLoaded', badge);
})(globalThis);
