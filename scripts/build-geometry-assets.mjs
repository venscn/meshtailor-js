/** Build local, UV-free examples from the verified source geometry. No network. */
import{readFile,writeFile,mkdir}from'node:fs/promises';import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';import{compileCore}from'./lib/compiled-core.mjs';import{loadVerifiedFixture}from'./lib/verified-model-fixtures.mjs';
const c=await compileCore(),out='apps/studio/public/assets/verified';await mkdir(out,{recursive:true});const manifest=[];const sha=b=>createHash('sha256').update(b).digest('hex');
try{const core=await c.load('packages/mesh-core/src/index.js');
for(const[name,id]of [['Corset','corset'],['FlightHelmet','flight-helmet']]){
 const loaded=await loadVerifiedFixture(core,'examples/verified-models',name,{geometryOnly:true}),mesh=core.geometryOnlyMesh(loaded.mesh),json=Buffer.from(JSON.stringify(mesh)),gz=gzipSync(json,{level:9});await writeFile(`${out}/${id}-geometry.json.gz`,gz);
 const old=JSON.parse(await readFile(`examples/verified-models/${name}/${name}.gltf`,'utf8')),bin=await readFile(`examples/verified-models/${name}/${name}.bin`),doc=core.geometryOnlyGLTF(old),chunks=[],views=[],accessors=[],ids=new Map();let length=0;
 function copy(ai){if(ids.has(ai))return ids.get(ai);const a=old.accessors[ai],v=old.bufferViews[a.bufferView],width={SCALAR:1,VEC3:3,VEC4:4}[a.type],size={5121:1,5123:2,5125:4,5126:4}[a.componentType];if(!width||!size||a.sparse)throw Error('Unsupported fixture accessor');const bytes=width*size,chunk=Buffer.alloc(Math.ceil(bytes*a.count/4)*4),start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??bytes;for(let i=0;i<a.count;i++)bin.copy(chunk,i*bytes,start+i*stride,start+i*stride+bytes);const vi=views.length,index=accessors.length;views.push({buffer:0,byteOffset:length,byteLength:bytes*a.count});const b={...a,bufferView:vi,byteOffset:0};delete b.sparse;accessors.push(b);chunks.push(chunk);length+=chunk.length;ids.set(ai,index);return index;}
 for(const m of doc.meshes)for(const p of m.primitives){p.indices=copy(p.indices);for(const k of Object.keys(p.attributes)){if(!['POSITION','NORMAL'].includes(k))throw Error('Unexpected fixture geometry attribute '+k);p.attributes[k]=copy(p.attributes[k]);}}
 doc.accessors=accessors;doc.bufferViews=views;doc.buffers=[{byteLength:length}];const glb=Buffer.from(core.writeGLB(doc,Buffer.concat(chunks)));await writeFile(`${out}/${id}-geometry.glb`,glb);
 manifest.push({id,name,license:'CC0-1.0',...loaded.identity,geometryOnly:true,faces:mesh.faces.length,vertices:mesh.positions.length,geometryJSONHash:sha(json),compressedHash:sha(gz),glbHash:sha(glb),glbBytes:glb.length});console.log(name,mesh.faces.length,'faces, UV fields:',mesh.faces.some(f=>'uvs'in f),'GLB',glb.length);
}
await writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2));
}finally{await c.cleanup()}
