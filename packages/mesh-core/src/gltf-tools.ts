/** Small format helpers shared by browser imports, offline downloads and tests.
 * Geometry-only mode never rewrites accessors, transforms, UVs, skins or morphs.
 * It removes material/image references so missing textures cannot block a seam study.
 */
export interface GLTFDocument {
  asset: { version: string; [key: string]: unknown };
  meshes?: { primitives: { material?: number; extensions?: Record<string, unknown>; [key:string]:unknown }[]; [key:string]:unknown }[];
  buffers?: { byteLength: number; uri?: string; [key:string]:unknown }[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  [key: string]: unknown;
}
const visual = (name: string) => name.startsWith('KHR_materials_') || name.startsWith('KHR_texture_') || name === 'EXT_texture_webp' || name === 'EXT_texture_avif';
export function geometryOnlyGLTF(input: GLTFDocument): GLTFDocument {
  if (input.asset?.version !== '2.0') throw new Error('Only glTF 2.0 is supported.');
  const doc = structuredClone(input);
  for (const key of ['materials','textures','images','samplers']) delete doc[key];
  for (const mesh of doc.meshes ?? []) for (const p of mesh.primitives) {
    delete p.material;
    if (p.extensions) for (const key of Object.keys(p.extensions)) if (visual(key)) delete p.extensions[key];
  }
  for (const key of ['extensionsUsed','extensionsRequired'] as const) if(doc[key]) doc[key] = doc[key]!.filter(n => !visual(n));
  const ext = doc.extensions as Record<string, unknown> | undefined;
  if (ext) for (const key of Object.keys(ext)) if(visual(key)) delete ext[key];
  return doc;
}
export function readGLB(data: ArrayBuffer): { document: GLTFDocument; binary?: Uint8Array } {
  if (data.byteLength < 20) throw new Error('Truncated GLB.');
  const view = new DataView(data);
  if (view.getUint32(0,true) !== 0x46546c67 || view.getUint32(4,true) !== 2) throw new Error('Invalid glTF 2.0 GLB header.');
  if (view.getUint32(8,true) !== data.byteLength) throw new Error('GLB length mismatch.');
  let document:GLTFDocument|undefined,binary:Uint8Array|undefined;
  for(let offset=12;offset<data.byteLength;){
    if(offset+8>data.byteLength) throw new Error('Truncated GLB chunk header.');
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    if(length%4 || offset+length>data.byteLength) throw new Error('Invalid GLB chunk size.');
    if(type===0x4e4f534a) {
      if(document || offset!==20) throw new Error('GLB JSON must be the first and only JSON chunk.');
      document=JSON.parse(new TextDecoder().decode(new Uint8Array(data,offset,length)).trim()) as GLTFDocument;
    } else if(type===0x004e4942){if(binary)throw new Error('Duplicate GLB BIN chunk.');binary=new Uint8Array(data,offset,length);}
    offset+=length;
  }
  if(!document)throw new Error('GLB has no JSON chunk.');
  return {document,binary};
}
export function writeGLB(document: GLTFDocument, binary?: Uint8Array): ArrayBuffer {
  const json=new TextEncoder().encode(JSON.stringify(document)),jsonSize=Math.ceil(json.length/4)*4,binSize=binary?Math.ceil(binary.length/4)*4:0;
  const buffer=new ArrayBuffer(20+jsonSize+(binary?8+binSize:0)),view=new DataView(buffer),bytes=new Uint8Array(buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,buffer.byteLength,true);
  view.setUint32(12,jsonSize,true);view.setUint32(16,0x4e4f534a,true);bytes.fill(32,20,20+jsonSize);bytes.set(json,20);
  if(binary){view.setUint32(20+jsonSize,binSize,true);view.setUint32(24+jsonSize,0x004e4942,true);bytes.set(binary,28+jsonSize);}
  return buffer;
}
