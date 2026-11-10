// Copies the page out of the folder of a local dashboard server into site/ and makes it servable from a sub-path
// (GitHub Pages serves a project at /<name>/): absolute asset paths become relative, and config.js and shim.js,
// which replaces the local server's routes, load before anything else.
// Usage: bun scripts/import-page.ts <folder with the page files>
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';

export const PAGE_FILES = ['index.html', 'xp-tracker.js', 'client-shell.js', 'client-shell.css', 'client-viewer.css', 'map-shell.js', 'map-shell.css', 'operations.js', 'operations.css', 'items.json', 'items.png', 'RUNELITE-LICENSE.txt'];
export const ASSET_DIR = 'client-assets';
// Present only when the source folder has the exported world map.
export const OPTIONAL_FILES = ['worldmap.png'];
export const OPTIONAL_DIRS = ['map-squares'];

const VIEWER_CONTROLS = `
  };
  window.addEventListener('keydown',gameKeys,true);
  const gameFrame=$('#rsw');
  function releaseCamera(){
    if(mode!=='3d'||window.atlasFreeCamera)return;
    tourSet(false);
    window.atlasFreeCamera=true;
    window.atlasFollowOther=null;
    window.atlasDestination=null;
    window.atlasOpponentClear?.();
    focusSay('Free camera',1400);
    render();
  }
  function bindViewerControls(){
    if(!gameFrame.contentDocument)return;
    gameFrame.contentWindow.addEventListener('keydown',gameKeys,true);
    gameFrame.contentWindow.addEventListener('atlasCameraReleased',releaseCamera);
  }
  gameFrame.addEventListener('load',bindViewerControls);
  bindViewerControls();
  window.atlasClient=`;

export function connectViewerControls(shell: string): string {
    const start = "  window.addEventListener('keydown',e=>{";
    const end = /  \},true\);\r?\n  window\.atlasClient=/g;
    if (shell.split(start).length !== 2 || [...shell.matchAll(end)].length !== 1) {
        throw Error('The imported client keyboard handler changed');
    }
    return shell.replace(start, '  const gameKeys=e=>{').replace(end, VIEWER_CONTROLS.slice(1));
}

/** The page names one game server. config.js (FLEET_CONFIG.server) replaces it in the feed address; shim.js sets the Hiscores link. */
export const DEFAULT_SERVER = 'rs-sdk-demo.fly.dev';
const SERVER_EXPR = `(window.FLEET_CONFIG&&window.FLEET_CONFIG.server||'${DEFAULT_SERVER}')`;
export function configureServer(html: string): string {
    // An older import set the link in an onclick, which a middle click does not run.
    html = html.replace(/ onclick="this\.href='https:\/\/'\+[^"]*\+'\/hiscores'"/g, '');
    return html.replaceAll(`'wss://${DEFAULT_SERVER}/worldfeed'`, `'wss://'+${SERVER_EXPR}+'/worldfeed'`);
}
/** Absolute paths the page uses for its own files become relative; the shim loads first. */
export function rewrite(name: string, text: string): string {
    if (name === 'index.html') {
        // Every file of the page that the HTML names by an absolute path, in attributes and in script strings.
        text = text.replace(/(href|src)="\/(map-shell|client-shell|operations|client-viewer|xp-tracker)\./g, '$1="$2.');
        text = text.replaceAll(`href="/${ASSET_DIR}/`, `href="${ASSET_DIR}/`);
        // The page stamps its sprite sheet with a query, so the match stops at the file name and keeps what follows.
        text = text.replace(/'\/(items\.png|items\.json)(?=['?])/g, "'$1");
        // site/worldmap.webp is the same art as worldmap.png at 0.6 MB instead of 4.3 MB.
        text = text.replaceAll("'/worldmap.png'", "'worldmap.webp'");
        // site/items.webp has the same pixels as items.png at 0.7 MB instead of 1.2 MB. The query stays the PNG's hash.
        text = text.replace(/url\('items\.png(?=[?'])/g, "url('items.webp");
        if (!text.includes('shim.js')) text = text.replace(/<head>/, '<head><script src="shim.js"></script>');
        if (!text.includes('config.js')) text = text.replace('<script src="shim.js', '<script src="config.js"></script><script src="shim.js');
        text = configureServer(text);
        if (!text.includes('<base ')) text = text.replace(/<head>/, '<head><base href="./">');
        if (!text.includes('runelite-chrome.css')) text = text.replace('</head>', '<link rel="stylesheet" href="runelite-chrome.css"></head>');
    }
    if (name.endsWith('.css') || name.endsWith('.js')) text = text.replaceAll("'/map-squares/'", "'map-squares/'").replaceAll(`'/${ASSET_DIR}/`, `'${ASSET_DIR}/`).replaceAll(`"/${ASSET_DIR}/`, `"${ASSET_DIR}/`).replaceAll(`(/${ASSET_DIR}/`, `(${ASSET_DIR}/`);
    // Both scripts build different parts of the toolbar from the owner's verified sign-in state.
    if (name === 'client-shell.js') text = connectViewerControls(text);
    if (name === 'client-shell.js' || name === 'operations.js') text = 'FleetShim.ready.then(() => {\n' + text + '\n});\n';
    return text;
}
// GitHub Pages caches every file for ten minutes. A content hash on each script and style link makes a deploy
// take effect on the next load; the links point at the files as they are in `to` (shim.js included).
export function stampVersions(html: string, dir: string): string {
    return html.replace(/((?:src|href)=")([a-z-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")/g, (whole, pre, file, post) => {
        const path = join(dir, file);
        if (!existsSync(path)) return whole;
        return `${pre}${file}?v=${createHash('sha256').update(readFileSync(path, 'utf8').replaceAll('\r\n', '\n')).digest('hex').slice(0, 10)}${post}`;
    });
}
// The viewer build in site/viewer/ has no versions on its links. Each script and style link in the
// viewer's index.html gets a content hash. The build id in shim.js becomes the hash of that index.html, so the
// address of the viewer frame changes when a viewer file changes.
export function stampViewer(to: string) {
    const viewer = join(to, 'viewer'), index = join(viewer, 'index.html'), shim = join(to, 'shim.js');
    if (!existsSync(index) || !existsSync(shim)) return;
    const hash = (text: string) => createHash('sha256').update(text.replaceAll('\r\n', '\n')).digest('hex').slice(0, 10);
    const html = readFileSync(index, 'utf8').replace(/((?:src|href)=")([\w./-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?(")/g, (whole, pre, file, post) => {
        const path = join(viewer, file);
        return existsSync(path) ? `${pre}${file}?v=${hash(readFileSync(path, 'utf8'))}${post}` : whole;
    });
    writeFileSync(index, html);
    const text = readFileSync(shim, 'utf8');
    if (!/viewer\/\?build=[0-9a-f]+/.test(text)) throw Error('shim.js has no viewer build id');
    writeFileSync(shim, text.replace(/viewer\/\?build=[0-9a-f]+/, `viewer/?build=${hash(html)}`));
}
/** site/items.webp is made from site/items.png, so a new sheet from the page needs a new WebP first. */
export function checkItemSheet(from: string, to: string) {
    const sheet = join(to, 'items.png'), source = join(from, 'items.png');
    if (existsSync(sheet) && !readFileSync(sheet).equals(readFileSync(source))) throw Error('items.png changed: copy it to site/, run python scripts/make-items-webp.py, then import again');
}
export function importPage(from: string, to: string) {
    mkdirSync(to, { recursive: true });
    checkItemSheet(from, to);
    for (const name of PAGE_FILES) {
        const source = join(from, name);
        if (!existsSync(source)) throw Error(`missing ${source}`);
        if (/\.(png)$/.test(name)) cpSync(source, join(to, name));
        else writeFileSync(join(to, name), rewrite(name, readFileSync(source, 'utf8')));
    }
    for (const name of OPTIONAL_FILES) if (existsSync(join(from, name))) cpSync(join(from, name), join(to, name));
    for (const name of OPTIONAL_DIRS) if (existsSync(join(from, name))) cpSync(join(from, name), join(to, name), { recursive: true });
    cpSync(join(from, ASSET_DIR), join(to, ASSET_DIR), { recursive: true });
    stampViewer(to);
    writeFileSync(join(to, 'index.html'), stampVersions(readFileSync(join(to, 'index.html'), 'utf8'), to));
}
if (import.meta.main) {
    const from = resolve(process.argv[2] ?? '');
    if (!process.argv[2]) { console.log('usage: bun scripts/import-page.ts <folder with the page files>'); process.exit(2); }
    importPage(from, resolve(import.meta.dir, '..', 'site'));
    console.log(`imported ${PAGE_FILES.length} files and ${ASSET_DIR}/ from ${from}`);
}
