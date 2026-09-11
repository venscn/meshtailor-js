import { geometryOnlyGLTF, writeGLB, type GLTFDocument } from './gltf-tools.js';
import type { RemoteMeshAsset } from './asset-catalog.js';
export interface DownloadedAsset { data:ArrayBuffer; sourceBytes:number; document:GLTFDocument }
export interface AssetDownloadOptions { signal?:AbortSignal; onProgress?:(message:string)=>void; fetcher?:typeof fetch }

/** Fetch only the glTF JSON and its geometry buffers, never the large texture set.
 * This deliberately supports one-buffer sample assets, not arbitrary remote scenes.
 */
export async function downloadGeometryAsset(asset:RemoteMeshAsset,options:AssetDownloadOptions={}):Promise<DownloadedAsset>{
  const fetcher=options.fetcher??fetch;
  const signal=options.signal??AbortSignal.timeout(120_000);
  async function get(url:string,max:number):Promise<ArrayBuffer>{
    const response=await fetcher(url,{signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}: ${url}`);
    const length=Number(response.headers.get('content-length')??0);
    if(length>max)throw new Error('Remote asset exceeds the download size limit.');
    // Stream with a cap: a missing/misleading Content-Length must not defeat limits.
    if(!response.body){const data=await response.arrayBuffer();if(data.byteLength>max)throw new Error('Remote asset exceeds the size limit.');return data;}
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
    try{while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;if(bytes>max){await reader.cancel();throw new Error('Remote asset exceeds the size limit.');}chunks.push(next.value);}}
    finally{reader.releaseLock();}
    const result=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result.buffer;
  }
  options.onProgress?.(`Fetching ${asset.name}: geometry metadata…`);
  const json=await get(asset.url,8*1024*1024),source=JSON.parse(new TextDecoder().decode(json)) as GLTFDocument;
  const doc=geometryOnlyGLTF(source);
  if(doc.buffers?.length!==1||!doc.buffers[0]?.uri)throw new Error('This example downloader requires a glTF with one external binary buffer. Use local import for other layouts.');
  const buffer=doc.buffers[0];
  const base=new URL(asset.url),binaryURL=new URL(buffer.uri!,base);
  if(binaryURL.origin!==base.origin||!binaryURL.pathname.startsWith(new URL('.',base).pathname))throw new Error('Unexpected external buffer URL.');
  if(!(buffer.byteLength>0&&buffer.byteLength<=64*1024*1024))throw new Error('Invalid or oversized geometry buffer.');
  options.onProgress?.(`Fetching ${asset.name}: ${(buffer.byteLength/1024/1024).toFixed(1)} MiB geometry…`);
  const binary=await get(binaryURL.href,64*1024*1024);
  if(binary.byteLength!==buffer.byteLength)throw new Error('Geometry buffer length mismatch; the remote file may be truncated.');
  delete buffer.uri;
  doc.asset={...doc.asset,generator:'MeshTailor-JS geometry-only repack',extras:{source:asset.source,license:asset.license,credit:asset.credit,modifications:'Materials/textures removed; geometry, transforms and UVs retained.'}};
  return {data:writeGLB(doc,new Uint8Array(binary)),sourceBytes:json.byteLength+binary.byteLength,document:doc};
}
