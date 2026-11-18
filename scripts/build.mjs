import {cp, mkdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = new URL('../public/', import.meta.url);
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
for (const path of ['index.html','app.js','studio.css','scene.css','motion.js','composition.js','defaults.js','scene-assets.js','assets','_headers']) {
  await cp(new URL(path, `file://${root}`), new URL(path, output), {recursive:true});
}
console.log('Built static site in public/');
