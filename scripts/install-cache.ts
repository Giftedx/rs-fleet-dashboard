// Copies the game cache that the 3D view reads into site/viewer/caches/. The cache is not in this repository:
// `yarn sync-cache` in a checkout of the rs-world fork makes it from your rs-sdk engine or from a server.
// Usage: bun scripts/install-cache.ts <rs-world folder>
import { cpSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const world = process.argv[2];
if (!world) { console.error('usage: bun scripts/install-cache.ts <rs-world folder>'); process.exit(2); }
const from = join(resolve(world), 'caches');
if (!existsSync(join(from, 'caches.json'))) { console.error(`${from} has no caches.json. Run "yarn sync-cache" in the rs-world folder first.`); process.exit(1); }
const to = resolve(import.meta.dir, '..', 'site', 'viewer', 'caches');
cpSync(from, to, { recursive: true });
console.log(`cache copied to ${to}`);
