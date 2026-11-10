import { afterAll, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, pushSite } from '../scripts/deploy';

const work = mkdtempSync(join(tmpdir(), 'deploy-test-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

function fixture() {
    const site = join(work, 'site'), data = join(work, 'data');
    mkdirSync(join(site, 'viewer'), { recursive: true });
    mkdirSync(data, { recursive: true });
    writeFileSync(join(site, 'index.html'), '<title>page</title>');
    writeFileSync(join(site, 'viewer', 'index.html'), 'viewer');
    // A preview copy that was left in site/ must not reach the public branch.
    writeFileSync(join(site, 'control.json'), '{"private":true}');
    writeFileSync(join(data, 'public.json'), '{"now":1,"bots":[]}');
    writeFileSync(join(data, 'control.json'), '{"private":true}');
    return { site, data };
}
const git = (cwd: string, ...args: string[]) => Bun.spawnSync(['git', ...args], { cwd }).stdout.toString().trim();

test('the built folder has the page and public.json and never control.json', () => {
    const { site, data } = fixture(), out = join(work, 'out-build');
    expect(buildSite(site, data, out)).toEqual(['public.json']);
    expect(readFileSync(join(out, 'public.json'), 'utf8')).toBe('{"now":1,"bots":[]}');
    for (const name of ['index.html', 'viewer/index.html', '.nojekyll']) expect(existsSync(join(out, name))).toBe(true);
    expect(existsSync(join(out, 'control.json'))).toBe(false);
});

test('a data folder with no public.json stops the build', () => {
    const { site } = fixture(), empty = join(work, 'empty');
    mkdirSync(empty, { recursive: true });
    expect(() => buildSite(site, empty, join(work, 'out-none'))).toThrow('Run a publisher first');
});

test('each push replaces the branch with one commit', () => {
    const { site, data } = fixture(), bare = join(work, 'remote.git');
    git(work, 'init', '-q', '--bare', bare);
    for (const run of ['first', 'second']) {
        const out = join(work, `out-${run}`);
        writeFileSync(join(data, 'public.json'), `{"now":1,"bots":[],"run":"${run}"}`);
        buildSite(site, data, out);
        pushSite(out, bare, 'site');
    }
    expect(git(bare, 'rev-list', '--count', 'site')).toBe('1');
    expect(git(bare, 'show', 'site:public.json')).toContain('"run":"second"');
    expect(git(bare, 'ls-tree', '-r', '--name-only', 'site').split('\n').sort()).toEqual(['.nojekyll', 'index.html', 'public.json', 'viewer/index.html']);
});
