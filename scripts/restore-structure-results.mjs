/** Offline restoration of generated (never author) coordinates for comparison. */
import{readFile,writeFile,mkdir}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import{join}from'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),manifest=JSON.parse(await readFile(join(root,'examples/generated-0.4.22/manifest.json'),'utf8')),out=join(root,'results/v0.4.22');await mkdir(out,{recursive:true});
for(const f of manifest.files){const b=gunzipSync(await readFile(join(root,f.path)));if(createHash('sha256').update(b).digest('hex')!==f.objSHA256)throw Error('Generated result checksum mismatch');await writeFile(join(out,f.asset+'-generated.obj'),b);console.log(f.asset,f.objSHA256);}
console.log('Use an external UV editor to inspect the exact result. This application deliberately discards imported UV and regenerates from geometry.');
