// Puts the page and a public.json on one branch, for GitHub Pages to serve. The branch holds one commit: each run
// replaces it, so the branch keeps no history of your data.
// Usage: bun scripts/deploy.ts --data <folder with public.json> [--remote origin] [--branch site] [--dry-run]
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** The files that a publisher may write for the public page. control.json is private and never goes here. */
export const PUBLIC_DATA = ['public.json', 'map.bin'];

/** Copies site/ and the public data files into `out`. Returns the names of the data files that it copied. */
export function buildSite(site: string, data: string, out: string): string[] {
    if (!existsSync(join(data, 'public.json'))) throw Error(`${join(data, 'public.json')} is not there. Run a publisher first.`);
    cpSync(site, out, { recursive: true });
    for (const name of ['public.json', 'control.json', 'map.bin']) rmSync(join(out, name), { force: true });
    const copied = PUBLIC_DATA.filter(name => existsSync(join(data, name)));
    for (const name of copied) cpSync(join(data, name), join(out, name));
    // GitHub Pages must serve each file as it is.
    writeFileSync(join(out, '.nojekyll'), '');
    return copied;
}

function git(cwd: string, ...args: string[]): string {
    const run = Bun.spawnSync(['git', ...args], { cwd, windowsHide: true });
    if (run.exitCode !== 0) throw Error(`git ${args[0]} failed: ${run.stderr.toString().trim()}`);
    return run.stdout.toString().trim();
}
/** Makes `out` one commit and replaces `branch` on `url` with it. */
export function pushSite(out: string, url: string, branch: string): string {
    git(out, 'init', '-q');
    git(out, 'add', '-A');
    git(out, '-c', 'user.name=fleet-dashboard', '-c', 'user.email=fleet-dashboard@users.noreply.github.com', 'commit', '-q', '-m', 'Publish the page');
    git(out, 'push', '-q', '--force', url, `HEAD:refs/heads/${branch}`);
    return git(out, 'rev-parse', '--short', 'HEAD');
}

if (import.meta.main) {
    const arg = (name: string, fallback = '') => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] ?? '' : fallback; };
    const root = resolve(import.meta.dir, '..'), data = arg('data');
    if (!data) { console.error('usage: bun scripts/deploy.ts --data <folder with public.json> [--remote origin] [--branch site] [--dry-run]'); process.exit(2); }
    const out = mkdtempSync(join(tmpdir(), 'fleet-site-'));
    try {
        const copied = buildSite(join(root, 'site'), resolve(data), out);
        if (process.argv.includes('--dry-run')) { console.log(`built ${out} with ${copied.join(', ')}; nothing is pushed`); process.exit(0); }
        const branch = arg('branch', 'site'), url = git(root, 'remote', 'get-url', arg('remote', 'origin'));
        console.log(`commit ${pushSite(out, url, branch)} is now branch ${branch} with ${copied.join(', ')}`);
    } catch (error) {
        console.error((error as Error).message);
        process.exitCode = 1;
    } finally {
        if (!process.argv.includes('--dry-run')) rmSync(out, { recursive: true, force: true });
    }
}
