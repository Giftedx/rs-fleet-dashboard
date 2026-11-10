import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stampVersions } from './import-page';

// Adapt the reviewed rs-world bundle used by the hosted viewer. The dashboard already passes client=1.
// Camera angles are in 2048 units per turn. Standalone and embed modes keep their own defaults.
export function tuneViewerCamera(bundle: string): string {
    const replacements = [
        ['this.fov=90', 'this.fov=dashboardCamera?55:90', 1],
        ['const Bc=new URLSearchParams(window.location.search),zc=', 'const Bc=new URLSearchParams(window.location.search),dashboardCamera=Bc.get("client")==="1",zc=', 1],
        ['zc?20:11', 'zc?20:dashboardCamera?7:11', 3],
        ['zc?Vc:-185', 'zc?Vc:dashboardCamera?-245:-185', 2],
        ['zc&&(this.orbitDistance=20,e.pitch=Vc)', '(zc||dashboardCamera)&&(this.orbitDistance=zc?20:7,e.pitch=zc?Vc:-245)', 1],
        ['?y.unfollow():y.zoom(v)', '?(y.unfollow(),dashboardCamera&&window.dispatchEvent(new Event("atlasCameraReleased"))):y.zoom(v)', 1],
    ] as const;

    for (const [before, after, count] of replacements) {
        if (bundle.split(before).length - 1 !== count) throw Error(`Viewer camera anchor changed: ${before}`);
        bundle = bundle.replaceAll(before, after);
    }
    return bundle;
}

if (import.meta.main) {
    const site = join(import.meta.dir, '..', 'site');
    const viewer = join(site, 'viewer');
    const indexPath = join(viewer, 'index.html');
    const index = readFileSync(indexPath, 'utf8');
    const main = index.match(/src="(static\/js\/main\.[a-f0-9]+\.js)(?:\?v=[a-f0-9]+)?"/);
    if (!main) throw Error('The viewer entry does not name a reviewed main bundle');
    const bundlePath = join(viewer, main[1]!);
    const bundle = tuneViewerCamera(readFileSync(bundlePath, 'utf8'));
    const version = createHash('sha256').update(bundle.replaceAll('\r\n', '\n')).digest('hex').slice(0, 10);
    const shimPath = join(site, 'shim.js');
    const shim = readFileSync(shimPath, 'utf8').replace(/url: 'viewer\/(?:\?build=[a-f0-9]+)?'/, `url: 'viewer/?build=${version}'`);
    const pagePath = join(site, 'index.html');
    writeFileSync(bundlePath, bundle);
    writeFileSync(indexPath, index.replace(main[0], `src="${main[1]}?v=${version}"`));
    writeFileSync(shimPath, shim);
    writeFileSync(pagePath, stampVersions(readFileSync(pagePath, 'utf8'), site));
}
