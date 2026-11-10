// One step of import-page.ts for a site/ that is already imported: loads config.js before shim.js, makes the game
// server a setting and stamps the links again. Run it after an edit to shim.js or config.js.
// Usage: bun scripts/apply-config.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { configureServer, stampVersions, stampViewer } from './import-page';

const site = resolve(import.meta.dir, '..', 'site'), index = join(site, 'index.html');
let html = readFileSync(index, 'utf8');
if (!html.includes('config.js')) html = html.replace('<script src="shim.js', '<script src="config.js"></script><script src="shim.js');
stampViewer(site);
writeFileSync(index, stampVersions(configureServer(html), site));
console.log('site/index.html configured');
