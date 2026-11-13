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
    // serverRate: the page's own rate for the goal skill ({skill, xpPerHour}), which smooths over the last minutes.
    function rows(bot, base, now, serverRate) {
        const hours = Math.max((now - base.at) / 3.6e6, 1 / 3600);
        return (bot.skills || []).filter(k => k.name !== 'Overall' && typeof k.xp === 'number').map(k => {
            // A skill that the baseline did not hold starts its count here, and the baseline keeps it.
            if (base.xp[k.name] == null) base.xp[k.name] = k.xp;
            const start = base.xp[k.name], gained = Math.max(0, k.xp - start);
            const level = levelForXp(k.xp), next = Math.min(99, level + 1), floor = xpForLevel(level), ceil = xpForLevel(next);
            const rate = serverRate && serverRate.skill === k.name && serverRate.xpPerHour > 0 ? serverRate.xpPerHour : gained / hours;
            const left = Math.max(0, ceil - k.xp);
            return { skill: k.name, xp: k.xp, level, next, gained, rate: Math.round(rate), progress: ceil > floor ? Math.min(1, (k.xp - floor) / (ceil - floor)) : 1, left, ttl: rate > 0 && level < 99 ? left / rate * 3.6e6 : null };
        }).filter(r => r.gained > 0 || r.rate > 0).sort((a, b) => b.gained - a.gained || b.rate - a.rate);
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
    global.atlasXp = { TABLE, xpForLevel, levelForXp, virtualLevel, baseline, rows, goalBar, total, combat, efficiency, TICK_KINDS };
})(globalThis);
