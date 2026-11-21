// XP tracker arithmetic for the client shell's XP Tracker plugin (the RuneLite panel): this server's level curve
// (packages/planner/src/curve.ts), a per-session baseline so gains count from the account's login as RuneLite counts
// from the client start, and one row per skill with gain, rate, level progress and time to level. Pure, so bun tests it;
// client-shell.js renders it.
(function (global) {
    // The engine stores tenths of XP: levelExperience[i] = floor(acc / 4) * 10, acc += floor(L + 2^(L/10) * 300).
    const TABLE = (() => { const t = []; let acc = 0; for (let i = 0; i < 99; i++) { const level = i + 1; acc += Math.floor(level + Math.pow(2, level / 10) * 300); t.push(Math.floor(acc / 4)); } return t; })();
    const xpForLevel = level => level <= 1 ? 0 : TABLE[Math.min(level, 99) - 2];
    const levelForXp = xp => { for (let i = 97; i >= 0; i--) if (xp >= TABLE[i]) return Math.min(i + 2, 99); return 1; };
    // The baseline for an account session: its skills' XP when the tracker first saw this login (bot.started).
    function baseline(store, bot, now) {
        const have = store[bot.name];
        if (have && have.started === (bot.started ?? null) && have.xp) return have;
        const fresh = { started: bot.started ?? null, at: now, xp: Object.fromEntries((bot.skills || []).map(k => [k.name, k.xp])) };
        store[bot.name] = fresh;
        return fresh;
    }
    // Pick the active skill reported for the account (preferring explicit rateSkill over goalSkill, ignoring "all skills").
    function activeSkill(bot) {
        if (!bot || typeof bot !== 'object') return null;
        for (const raw of [bot.rateSkill, bot.goalSkill]) {
            if (typeof raw !== 'string') continue;
            const s = raw.trim();
            if (!s || /^all skills$/i.test(s) || /^stat\d+$/i.test(s) || /^overall$/i.test(s)) continue;
            return ehpKey(s) || s;
        }
        if (typeof bot.role === 'string') {
            const k = ehpKey(bot.role);
            if (k) return k;
        }
        return null;
    }
    // serverRate: the page's own rate for the active/goal skill ({skill, xpPerHour}), which smooths over the last minutes.
    function rows(bot, base, now, serverRate) {
        const hours = Math.max((now - base.at) / 3.6e6, 1 / 3600);
        const skills = Array.isArray(bot?.skills) ? bot.skills : [];
        const out = skills.filter(k => k.name !== 'Overall' && typeof k.xp === 'number').map(k => {
            // A skill that the baseline did not hold starts its count here, and the baseline keeps it.
            if (base.xp[k.name] == null) base.xp[k.name] = k.xp;
            const start = base.xp[k.name], gained = Math.max(0, k.xp - start);
            const level = levelForXp(k.xp), next = Math.min(99, level + 1), floor = xpForLevel(level), ceil = xpForLevel(next);
            const reported = !!(serverRate && serverRate.skill && serverRate.skill.toLowerCase() === k.name.toLowerCase() && serverRate.xpPerHour > 0);
            const rate = reported ? serverRate.xpPerHour : gained / hours;
            const left = Math.max(0, ceil - k.xp);
            return { skill: k.name, xp: k.xp, level, next, gained, rate: Math.round(rate), rateSource: reported ? 'reported' : 'live', progress: ceil > floor ? Math.min(1, (k.xp - floor) / (ceil - floor)) : 1, left, ttl: rate > 0 && level < 99 ? left / rate * 3.6e6 : null };
        });
        // Hosted/remote snapshots can report active rateSkill/xpPerHour + skill level without numeric XP.
        if (serverRate && serverRate.skill && serverRate.xpPerHour > 0 && !out.some(r => r.skill.toLowerCase() === serverRate.skill.toLowerCase())) {
            const match = skills.find(k => typeof k?.name === 'string' && k.name.toLowerCase() === serverRate.skill.toLowerCase());
            const lvRaw = Number.isFinite(match?.level) ? match.level : (Number.isFinite(bot?.goalNow) && bot.goalSkill?.toLowerCase() === serverRate.skill.toLowerCase() ? bot.goalNow : null);
            if (Number.isInteger(lvRaw) && lvRaw >= 1 && lvRaw <= 99) {
                const level = lvRaw, next = Math.min(99, level + 1), floor = xpForLevel(level), ceil = xpForLevel(next);
                const xp = Number.isFinite(bot?.goalXp) && bot.goalSkill?.toLowerCase() === serverRate.skill.toLowerCase() ? bot.goalXp : floor;
                const progress = ceil > floor ? Math.min(1, Math.max(0, (xp - floor) / (ceil - floor))) : 1;
                const left = level >= 99 ? 0 : Math.max(0, ceil - xp);
                const rate = Math.round(serverRate.xpPerHour);
                out.push({ skill: match?.name || ehpKey(serverRate.skill) || serverRate.skill, xp, level, next, gained: 0, rate, rateSource: 'reported', levelOnly: !(Number.isFinite(bot?.goalXp) && bot.goalSkill?.toLowerCase() === serverRate.skill.toLowerCase()), progress, left, ttl: rate > 0 && level < 99 ? left / rate * 3.6e6 : null });
            }
        }
        return out.filter(r => r.gained > 0 || r.rate > 0).sort((a, b) => b.gained - a.gained || b.rate - a.rate);
    }
    // The bar of a row to a goal level past the next one (RuneLite's XP tracker goal with level markers): the progress from the floor of the level now to the goal, the XP left, the time left, and a mark at each level between. Null when the goal is not past the next level.
    function goalBar(row, goalLevel) {
        if (!(goalLevel > row.next) || goalLevel > 99) return null;
        const floor = xpForLevel(row.level), ceil = xpForLevel(goalLevel), span = ceil - floor, left = Math.max(0, ceil - row.xp), marks = [];
        for (let level = row.level + 1; level < goalLevel; level++) marks.push(Math.round((xpForLevel(level) - floor) / span * 1000) / 10);
        return { goal: goalLevel, progress: Math.min(1, (row.xp - floor) / span), left, ttl: row.rate > 0 ? left / row.rate * 3.6e6 : null, marks };
    }
    const total = list => list.reduce((n, r) => n + r.gained, 0);
    // Combat level and the levels each style needs for the next one (RuneLite's combatlevel plugin). The base is
    // a quarter of Defence + Hitpoints + half Prayer; the best of melee (Attack + Strength), Ranged x 1.5 or
    // Magic x 1.5 adds 0.325 of itself.
    function combat(lv) {
        const g = k => Math.max(1, Number(lv[k]) || 1);
        const base = 0.25 * (g('Defence') + g('Hitpoints') + Math.floor(g('Prayer') / 2));
        const melee = 0.325 * (g('Attack') + g('Strength')), range = 0.325 * Math.floor(g('Ranged') * 1.5), mage = 0.325 * Math.floor(g('Magic') * 1.5);
        const level = Math.floor(base + Math.max(melee, range, mage));
        if (level >= 126) return { level, next: null };
        const goal = level + 1, top = Math.max(melee, range, mage);
        // Each answer is the fewest levels of that kind alone that reach the next combat level, or null when 99 is not enough.
        const need = (fn, cap) => { for (let n = 1; n <= cap; n++) if (Math.floor(fn(n)) >= goal) return n; return null; };
        const next = {
            melee: need(n => base + Math.max(0.325 * (g('Attack') + g('Strength') + n), top), 198 - g('Attack') - g('Strength')),
            defence: need(n => base + 0.25 * n + top, 198 - g('Defence') - g('Hitpoints')),
            prayer: need(n => 0.25 * (g('Defence') + g('Hitpoints') + Math.floor((g('Prayer') + n) / 2)) + top, 99 - g('Prayer')),
            ranged: need(n => base + Math.max(0.325 * Math.floor((g('Ranged') + n) * 1.5), top), 99 - g('Ranged')),
            magic: need(n => base + Math.max(0.325 * Math.floor((g('Magic') + n) * 1.5), top), 99 - g('Magic')),
        };
        return { level, next };
    }
    // Virtual levels (RuneLite's virtual levels): the level this server's XP formula gives past 99. RuneLite stops at 126. This server's curve reaches 126 at 6.5M XP, so the count goes on to the level of the 200M XP cap (175).
    const virtualLevel = xp => { let acc = 0, level = 1; while (level < 175) { acc += Math.floor(level + Math.pow(2, level / 10) * 300); if (xp < Math.floor(acc / 4)) break; level++; } return level; };
    // Tick efficiency: what each of the last ticks did, from the status `timeline` (one letter a tick, the newest last):
    // x XP, v inventory change, m move, a anim, d dialog, s stun, i idle. Work is XP or an inventory change. Waste is the
    // biggest share that is not work. `idle` is the share of idle ticks, in percent.
    const TICK_KINDS = { x: 'xp', v: 'inventory', m: 'move', a: 'anim', d: 'dialog', s: 'stun', i: 'idle' };
    function efficiency(timeline) {
        const ticks = String(timeline || '').split('').filter(k => k in TICK_KINDS);
        if (!ticks.length) return null;
        const counts = Object.fromEntries(Object.values(TICK_KINDS).map(k => [k, 0]));
        for (const k of ticks) counts[TICK_KINDS[k]]++;
        const pct = n => n * 100 / ticks.length;
        const shares = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, pct(n)]));
        const waste = Object.entries(counts).filter(([k]) => k !== 'xp' && k !== 'inventory').sort((a, b) => b[1] - a[1])[0];
        return { ticks: ticks.length, counts, shares, idle: shares.idle, work: shares.xp + shares.inventory, waste: waste[1] ? { kind: waste[0], share: pct(waste[1]) } : null };
    }
    // Rev 289 EHP rates in XP per game tick, calibrated from the planner board benchmarks and
    // research/cooking-board.md across the 19 skills of 2004 rev 289 (never Slayer/Hunter/Farming/Construction).
    const EHP_XP_PER_TICK = {
        Attack: 185.3, Defence: 162.9, Strength: 185.3, Hitpoints: 61.4, Ranged: 309.4,
        Prayer: 10344.8, Magic: 7384.9, Cooking: 343011, Woodcutting: 3759.6, Fletching: 266008.8,
        Fishing: 2321.8, Firemaking: 19541.9, Crafting: 66843.2, Smithing: 13139.5, Mining: 97,
        Herblore: 52985.5, Agility: 196, Thieving: 2112.9, Runecraft: 4379.8,
    };
    const ehpKey = skill => Object.keys(EHP_XP_PER_TICK).find(k => k.toLowerCase() === String(skill || '').trim().toLowerCase()) || null;
    function ehpRate(skill, tickMs = 400) {
        const key = ehpKey(skill), ms = Number(tickMs);
        if (!key || !Number.isFinite(ms) || ms <= 0) return null;
        return EHP_XP_PER_TICK[key] * (3_600_000 / ms);
    }
    function ehpHours(skill, xp, tickMs = 400) {
        const rate = ehpRate(skill, tickMs), n = Number(xp);
        if (rate == null || !Number.isFinite(n) || n < 0) return null;
        return n / rate;
    }
    function sessionEhp(rowList, tickMs = 400) {
        let gainedEhp = 0, ehpPerHour = 0;
        const breakdown = [];
        for (const r of rowList || []) {
            const rate = ehpRate(r?.skill, tickMs);
            if (!rate) continue;
            const gained = Number(r.gained) > 0 ? r.gained / rate : 0;
            const rateRatio = Number(r.rate) > 0 ? r.rate / rate : 0;
            gainedEhp += gained;
            ehpPerHour += rateRatio;
            breakdown.push({ skill: r.skill, ehp: gained, ehpPerHour: rateRatio, pctOfEhp: rateRatio * 100 });
        }
        return { gainedEhp, ehpPerHour, breakdown };
    }
    function remainingEhp(skill, currentXp, targetLevel = 99, tickMs = 400) {
        const rate = ehpRate(skill, tickMs), xp = Number(currentXp);
        if (rate == null || !Number.isFinite(xp) || xp < 0) return null;
        const t = Math.max(1, Math.min(99, Math.trunc(Number(targetLevel) || 99)));
        const xpLeft = Math.max(0, xpForLevel(t) - xp);
        return { target: t, xpLeft, ehpRate: rate, ehpHours: xpLeft / rate };
    }
    function supplyBillProgress(supplies, bots, options = {}) {
        const batches = Math.max(1, Math.floor(Number(options.batches) || 1));
        const secret = String(options.secretName || '⟦MAIN⟧').toLowerCase();
        const query = String(options.query || '').trim().toLowerCase();
        const includePractice = options.includePractice === true;
        const normName = s => String(s || '').replace(/\s*\(noted\)\s*$/i, '').trim().toLowerCase();
        const merged = new Map();
        for (const raw of supplies || []) {
            const name = String(raw?.item || raw?.name || '').trim();
            const baseCount = Math.max(0, Math.floor(Number(raw?.count ?? raw?.need ?? 0)));
            if (!name || baseCount <= 0) continue;
            const id = Number.isSafeInteger(raw?.itemId) && raw.itemId >= 0 ? raw.itemId : null;
            const key = id != null ? 'id:' + id : 'name:' + normName(name);
            const cur = merged.get(key) || { item: name, itemId: id, baseCount: 0, consumer: raw?.consumer || null };
            cur.baseCount += baseCount;
            if (!cur.consumer && raw?.consumer) cur.consumer = raw.consumer;
            merged.set(key, cur);
        }
        const safeAccount = name => String(name || '').toLowerCase() === secret || name === '⟦MAIN⟧' ? 'Main · reserved' : String(name || '');
        const eligible = (bots || []).filter(b => {
            if (!b || typeof b !== 'object') return false;
            if (!includePractice && b.practice) return false;
            if (b.reserved) return false;
            const low = String(b.name || '').toLowerCase();
            if (options.includeSecret !== true && (low === secret || b.name === '⟦MAIN⟧')) return false;
            return true;
        });
        const items = [];
        for (const req of merged.values()) {
            const need = req.baseCount * batches, wantName = normName(req.item);
            let bankCount = 0, packCount = 0, wornCount = 0;
            const owners = new Map();
            const matches = item => {
                if (!item || typeof item !== 'object') return false;
                if (req.itemId != null) {
                    const iid = Object.hasOwn(item, 'baseId') && Number.isSafeInteger(item.baseId) && item.baseId >= 0 ? item.baseId : item.id;
                    if (Number.isSafeInteger(iid) && iid >= 0) return iid === req.itemId;
                }
                return normName(item.name) === wantName;
            };
            const addOwner = (b, count, place) => {
                if (count <= 0) return;
                const label = safeAccount(b.name);
                const row = owners.get(label) || { name: b.name === '⟦MAIN⟧' || String(b.name || '').toLowerCase() === secret ? label : b.name, label, count: 0, bank: 0, pack: 0, worn: 0, bankAt: b.bankAt ?? null };
                row.count += count;
                row[place] += count;
                owners.set(label, row);
            };
            const itemCount = it => {
                if (it.count == null) return 1;
                const n = Number(it.count);
                return Number.isFinite(n) && n > 0 ? n : 0;
            };
            for (const b of eligible) {
                for (const it of Array.isArray(b.bank) ? b.bank : []) if (matches(it)) { const c = itemCount(it); bankCount += c; addOwner(b, c, 'bank'); }
                for (const it of Array.isArray(b.inventory) ? b.inventory : []) if (matches(it)) { const c = itemCount(it); packCount += c; addOwner(b, c, 'pack'); }
                if (b.equipmentObserved !== false) {
                    for (const it of Array.isArray(b.equipment) ? b.equipment : []) if (matches(it)) { const c = itemCount(it); wornCount += c; addOwner(b, c, 'worn'); }
                }
            }
            const have = bankCount + packCount + wornCount;
            const short = Math.max(0, need - have);
            const pct = need > 0 ? Math.min(100, have * 100 / need) : 100;
            items.push({
                item: req.item, itemId: req.itemId, consumer: req.consumer, need, have, short, pct,
                bankCount, packCount, wornCount,
                owners: [...owners.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
            });
        }
        items.sort((a, b) => (b.short > 0 ? 1 : 0) - (a.short > 0 ? 1 : 0) || a.pct - b.pct || b.short - a.short || a.item.localeCompare(b.item));
        const filtered = query ? items.filter(it => it.item.toLowerCase().includes(query) || String(it.consumer || '').toLowerCase().includes(query)) : items;
        const totalNeed = filtered.reduce((n, r) => n + r.need, 0);
        const totalCappedHave = filtered.reduce((n, r) => n + Math.min(r.need, r.have), 0);
        const totalShort = filtered.reduce((n, r) => n + r.short, 0);
        const fulfilledCount = filtered.filter(r => r.short === 0).length;
        return {
            batches,
            items: filtered,
            itemCount: filtered.length,
            fulfilledCount,
            shortageCount: filtered.length - fulfilledCount,
            totalNeed,
            totalHave: filtered.reduce((n, r) => n + r.have, 0),
            totalShort,
            completionPct: totalNeed > 0 ? totalCappedHave * 100 / totalNeed : 100,
        };
    }
    // Archive a completed or reset XP session summary without keeping mutable baseline state.
    function archiveSession(store, bot, now, options = {}) {
        const base = store && bot && bot.name ? store[bot.name] : null;
        if (!base || !base.xp) return null;
        const at = base.paused && base.paused.at != null ? base.paused.at : now;
        const seen = base.paused && base.paused.xp
            ? { ...bot, skills: (bot.skills || []).map(k => ({ ...k, xp: base.paused.xp[k.name] ?? k.xp })) }
            : bot;
        const rowList = rows(seen, { ...base, xp: { ...base.xp } }, at, null);
        const gainedXp = total(rowList);
        if (gainedXp <= 0 && !options.includeZero) return null;
        const elapsedMs = Math.max(0, at - base.at);
        const xpPerHour = elapsedMs >= 1000 ? Math.round(gainedXp / (elapsedMs / 3.6e6)) : 0;
        const ehp = sessionEhp(rowList, options.tickMs || 400);
        return {
            started: base.started ?? null,
            fromAt: base.at,
            at,
            elapsedMs,
            gainedXp,
            xpPerHour,
            gainedEhp: ehp.gainedEhp,
            ehpPerHour: ehp.ehpPerHour,
            skills: rowList.slice(0, 3).map(r => ({ skill: r.skill, gained: r.gained, level: r.level })),
        };
    }
    function recordSessionHistory(historyMap, accountKey, entry, maxEntries = 6) {
        const out = historyMap && typeof historyMap === 'object' && !Array.isArray(historyMap) ? { ...historyMap } : {};
        if (!accountKey || !entry) return out;
        const prev = Array.isArray(out[accountKey]) ? out[accountKey] : [];
        const deduped = prev.filter(h => !(h && h.fromAt === entry.fromAt && h.at === entry.at && h.gainedXp === entry.gainedXp));
        out[accountKey] = [entry, ...deduped].slice(0, Math.max(1, maxEntries));
        return out;
    }
    global.atlasXp = { TABLE, xpForLevel, levelForXp, virtualLevel, baseline, activeSkill, rows, goalBar, total, combat, efficiency, TICK_KINDS, EHP_XP_PER_TICK, ehpRate, ehpHours, sessionEhp, remainingEhp, supplyBillProgress, archiveSession, recordSessionHistory };
})(globalThis);
