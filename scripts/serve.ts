// Local preview of the site: serves site/ with public.json, control.json and map.bin from a data folder.
// Usage: bun scripts/serve.ts [--data <folder>]   -> http://127.0.0.1:3200
// Your publisher writes that folder. Default: site/ itself. `bun run demo` fills demo/ with made-up bots first.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const site = join(root, 'site');
const dataArg = process.argv.indexOf('--data');
const data = dataArg >= 0 ? resolve(process.argv[dataArg + 1]!) : site;
const PORT = Number(process.env.PORT ?? 3200);
const TYPES: Record<string, string> = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.bin': 'application/octet-stream', '.txt': 'text/plain' };
const DATA_FILES = new Set(['/public.json', '/control.json', '/map.bin']);

Bun.serve({
    hostname: '127.0.0.1', port: PORT,
    fetch(req) {
        let path = decodeURIComponent(new URL(req.url).pathname);
        if (path.endsWith('/')) path += 'index.html';
        if (path.includes('..')) return new Response('bad path', { status: 400 });
        const file = DATA_FILES.has(path) ? join(data, path) : join(site, path);
        if (!existsSync(file)) return new Response('not found', { status: 404 });
        const ext = file.slice(file.lastIndexOf('.'));
        return new Response(Bun.file(file), { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' } });
    },
});
console.log(`serving ${site} with data from ${data} at http://127.0.0.1:${PORT}`);
