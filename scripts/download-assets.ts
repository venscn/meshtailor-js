/** Run with npm run assets:download [-- --only corset]. Downloads are opt-in. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { REMOTE_MESH_ASSETS } from '../packages/mesh-core/src/asset-catalog.js';
import { downloadGeometryAsset } from '../packages/mesh-core/src/asset-download.js';
const root=fileURLToPath(new URL('../apps/studio/public/assets/remote/',import.meta.url));
const onlyAt=process.argv.indexOf('--only'),only=onlyAt>=0?process.argv[onlyAt+1]:undefined;
if(onlyAt>=0&&!REMOTE_MESH_ASSETS.some(a=>a.id===only))throw new Error('Unknown --only asset. Valid IDs: '+REMOTE_MESH_ASSETS.map(a=>a.id).join(', '));
await mkdir(root,{recursive:true});
for(const asset of REMOTE_MESH_ASSETS.filter(a=>!only||a.id===only)){
  try{
    const result=await downloadGeometryAsset(asset,{onProgress:console.log});
    const sha256=createHash('sha256').update(new Uint8Array(result.data)).digest('hex');
    const metadata={...asset,downloadedAt:new Date().toISOString(),sourceBytes:result.sourceBytes,bytes:result.data.byteLength,sha256,modification:'Removed texture dependencies; retained lightweight material-domain identities, geometry, transforms, UVs and skin data.'};
    // Publish metadata last: a failed download is never reported as a valid cached asset.
    await writeFile(join(root,asset.id+'-domains-v2.glb'),new Uint8Array(result.data));
    await writeFile(join(root,asset.id+'.json'),JSON.stringify(metadata,null,2)+'\n');
    console.log(`${asset.id}: saved ${result.data.byteLength} bytes, SHA256 ${sha256}`);
  }catch(error){console.error(`${asset.id}: ${error instanceof Error?error.message:String(error)}`);process.exitCode=1;}
}
