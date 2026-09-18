/** Restore generated references, not source UV; no network or model solving. */
import{readFile,writeFile,mkdir}from'node:fs/promises';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import{join}from'node:path';
const root=fileURLToPath(new URL('../',import.meta.url)),manifest=JSON.parse(await readFile(join(root,'examples/generated-0.4.21/manifest.json'),'utf8')),out=join(root,'results/v0.4.21');await mkdir(out,{recursive:true});
for(const f of manifest.files){const data=gunzipSync(await readFile(join(root,f.path)));if(createHash('sha256').update(data).digest('hex')!==f.objSHA256)throw Error('Reference checksum failed');const path=join(out,f.asset+'-generated.obj');await writeFile(path,data);console.log(path)}
console.log('Use an external UV viewer to inspect these exact references. Studio deliberately ignores all imported UV and generates new coordinates.');
