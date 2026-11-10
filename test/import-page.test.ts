import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkItemSheet, rewrite, stampVersions, stampViewer } from '../scripts/import-page';

describe('import rewrite', () => {
    test('absolute page paths become relative and the settings and the shim load first', () => {
        const out = rewrite('index.html', '<head><link href="/client-shell.css"><script src="/xp-tracker.js"></script></head><script>fetch(\'/items.png\')</script>');
        expect(out).toContain('<head><base href="./"><script src="config.js"></script><script src="shim.js"></script>');
        expect(out).toContain('href="client-shell.css"');
        expect(out).toContain('src="xp-tracker.js"');
        expect(out).toContain('<link rel="stylesheet" href="runelite-chrome.css"></head>');
        expect(out).toContain("fetch('items.png')");
        expect(rewrite('client-shell.css', "url('/client-assets/a.png')")).toBe("url('client-assets/a.png')");
    });
    test('a sprite sheet stamped with a query also becomes relative', () => {
        const out = rewrite('index.html', "<head></head><style>.ico{background-image:url('/items.png?v=f91ca1')}</style>");
        expect(out).toContain("url('items.webp?v=f91ca1')");
        expect(out).not.toContain("items.png");
    });
    test('a changed item sheet stops the import until its WebP is rebuilt', () => {
        const from = mkdtempSync(join(tmpdir(), 'sheet-from-')), to = mkdtempSync(join(tmpdir(), 'sheet-to-'));
        writeFileSync(join(from, 'items.png'), 'a');
        writeFileSync(join(to, 'items.png'), 'a');
        expect(() => checkItemSheet(from, to)).not.toThrow();
        writeFileSync(join(from, 'items.png'), 'b');
        expect(() => checkItemSheet(from, to)).toThrow('items.png changed');
        rmSync(from, { recursive: true });
        rmSync(to, { recursive: true });
    });
    test('script and style links carry a content hash that changes with the file', () => {
        const dir = mkdtempSync(join(tmpdir(), 'stamp-'));
        writeFileSync(join(dir, 'shim.js'), 'a\n');
        writeFileSync(join(dir, 'client-shell.css'), 'b');
        const html = '<script src="shim.js"></script><link href="client-shell.css"><script src="missing.js"></script>';
        const one = stampVersions(html, dir);
        expect(one).toMatch(/src="shim\.js\?v=[0-9a-f]{10}"/);
        expect(one).toMatch(/href="client-shell\.css\?v=[0-9a-f]{10}"/);
        expect(one).toContain('src="missing.js"');
        writeFileSync(join(dir, 'shim.js'), 'a\r\n');
        expect(stampVersions(html, dir)).toBe(one);
        writeFileSync(join(dir, 'shim.js'), 'changed');
        const two = stampVersions(one, dir);
        expect(two).not.toBe(one);
        expect(two.match(/shim\.js\?v=[0-9a-f]{10}/g)).toHaveLength(1);
        rmSync(dir, { recursive: true, force: true });
    });
    test('viewer links carry content hashes and the build id in the shim follows the viewer files', () => {
        const dir = mkdtempSync(join(tmpdir(), 'viewer-'));
        mkdirSync(join(dir, 'viewer', 'static', 'js'), { recursive: true });
        writeFileSync(join(dir, 'viewer', 'bridge.js'), 'bridge');
        writeFileSync(join(dir, 'viewer', 'client-viewer.css'), 'style');
        writeFileSync(join(dir, 'viewer', 'static', 'js', 'main.a8aba595.js'), 'bundle');
        writeFileSync(join(dir, 'viewer', 'index.html'), '<script src="bridge.js"></script><link rel="stylesheet" href="client-viewer.css"><script defer="defer" src="static/js/main.a8aba595.js?v=0000000000"></script><link href="static/css/missing.css" rel="stylesheet">');
        writeFileSync(join(dir, 'shim.js'), "url: 'viewer/?build=7de7544680'");
        const build = () => readFileSync(join(dir, 'shim.js'), 'utf8').match(/viewer\/\?build=([0-9a-f]{10})'/)![1];
        stampViewer(dir);
        const html = readFileSync(join(dir, 'viewer', 'index.html'), 'utf8'), first = build();
        expect(html).toMatch(/src="bridge\.js\?v=[0-9a-f]{10}"/);
        expect(html).toMatch(/href="client-viewer\.css\?v=[0-9a-f]{10}"/);
        expect(html).toMatch(/src="static\/js\/main\.a8aba595\.js\?v=[0-9a-f]{10}"/);
        expect(html).not.toContain('0000000000');
        expect(html).toContain('href="static/css/missing.css"');
        expect(first).not.toBe('7de7544680');
        stampViewer(dir);
        expect(readFileSync(join(dir, 'viewer', 'index.html'), 'utf8')).toBe(html);
        expect(build()).toBe(first);
        writeFileSync(join(dir, 'viewer', 'static', 'js', 'main.a8aba595.js'), 'bundle with a patch');
        stampViewer(dir);
        expect(build()).not.toBe(first);
        writeFileSync(join(dir, 'shim.js'), 'no id');
        expect(() => stampViewer(dir)).toThrow('shim.js has no viewer build id');
        rmSync(dir, { recursive: true, force: true });
    });
});

test('the page loads the WebP world map', () => {
    const html = rewrite('index.html', "<head></head><script>art.src='/worldmap.png';</script>");
    expect(html).toContain("art.src='worldmap.webp'");
    expect(html).not.toContain('worldmap.png');
});
