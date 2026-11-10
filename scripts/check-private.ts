// Fails when a file that git tracks holds a name from your private list, or one of the data files that must stay
// off main. Put the names in .private-names (one for each line; git ignores that file) or pass a file with
// PRIVATE_NAMES_FILE. With no list, only the data files are checked.
// Usage: bun scripts/check-private.ts
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const DATA_FILES = /(^|\/)(public\.json|control\.json|map\.bin|bot\.env)$/;
// The viewer's spawn tables come from the game: an npc there can share a name with an account.
export const GAME_DATA = /^site\/viewer\/static\/media\/npc-spawns-/;
const TEXT = /\.(ts|js|json|html|css|md|txt|py|yml|yaml)$|^[^.]+$/;

export function readNames(text: string): string[] {
    return text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
}
/** Each hit is "<file>: <reason>". A name matches as a whole word, in any case. */
export function findPrivate(files: { path: string; text: string | null }[], names: string[]): string[] {
    const hits: string[] = [];
    const words = names.map(name => ({ name, test: new RegExp(`(?<![A-Za-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'i') }));
    for (const file of files) {
        if (DATA_FILES.test(file.path)) hits.push(`${file.path}: a data file`);
        if (file.text == null || GAME_DATA.test(file.path)) continue;
        for (const word of words) if (word.test.test(file.text) || word.test.test(file.path)) hits.push(`${file.path}: holds the private name ${word.name}`);
    }
    return hits;
}

if (import.meta.main) {
    const root = resolve(import.meta.dir, '..');
    const listFile = process.env.PRIVATE_NAMES_FILE ?? join(root, '.private-names');
    const names = existsSync(listFile) ? readNames(readFileSync(listFile, 'utf8')) : [];
    const tracked = Bun.spawnSync(['git', 'ls-files', '-z'], { cwd: root }).stdout.toString().split('\0').filter(Boolean);
    const files = tracked.map(path => ({ path, text: TEXT.test(path) && existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null }));
    const hits = findPrivate(files, names);
    for (const hit of hits) console.error(hit);
    console.log(`${tracked.length} files checked against ${names.length} private names: ${hits.length ? `${hits.length} FOUND` : 'clean'}`);
    process.exit(hits.length ? 1 : 0);
}
