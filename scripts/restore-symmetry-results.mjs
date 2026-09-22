/** Restore exact reference outputs locally. These are generated UVs, not a
 * source-UV fallback. Verify the whole set before changing any output file. */
import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dirname,join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=join(root,'examples/generated-0.4.25');
const manifest=JSON.parse(await readFile(join(source,'manifest.json'),'utf8'));
if(manifest.version!=='0.4.25'||!Array.isArray(manifest.files))throw Error('Invalid result manifest.');
const output=join(root,'results/v0.4.25'),pending=[];
for(const f of manifest.files){
 if(typeof f.file!=='string'||basename(f.file)!==f.file||!f.file.endsWith('.obj'))throw Error('Invalid result filename.');
 const bytes=gunzipSync(await readFile(join(source,f.file+'.gz')),{maxOutputLength:64*1024*1024});
 if(bytes.length!==f.bytes||createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Result checksum mismatch: '+f.file);
 pending.push({name:f.file,bytes});
}
await mkdir(output,{recursive:true});
for(const f of pending){const path=join(output,f.name),temp=path+'.partial';try{await writeFile(temp,f.bytes);await rename(temp,path);}finally{await rm(temp,{force:true})}console.log('Verified:',path);}
console.log('These are exact reference results. Importing them into this app intentionally ignores their UV and generates a new atlas. Use an external UV viewer for an unchanged comparison.');
