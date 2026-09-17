#!/usr/bin/env node
import fs from 'node:fs/promises';
import {parseOBJ,geometryOnlyMesh,buildTopology,validateManifold,meshToOBJ} from '@meshtailor/mesh-core';
import {canonicalOrder,traceSeamChains} from '@meshtailor/chaining-seams';
import {unwrapMesh,geometryGenerationOptions,meshWithPreviewUV} from '@meshtailor/uv';
const [cmd,file,out]=process.argv.slice(2);
const usage=()=>console.log('MeshTailor-JS geometry-only CLI\n  npm run cli -- inspect mesh.obj\n  npm run cli -- baseline mesh.obj [seams.json]\n  npm run cli -- unwrap mesh.obj output.obj');
try {
 if(!cmd){usage();process.exit(0);}if(!file)throw Error('Missing OBJ path.');
 if(!['inspect','baseline','unwrap'].includes(cmd))throw Error('Only geometry inspection/generation is supported; original-UV extraction and training labels are not generator inputs.');
 const mesh=geometryOnlyMesh(parseOBJ(await fs.readFile(file,'utf8'),file));
 if(cmd==='inspect'){const t=buildTopology(mesh);console.log(JSON.stringify({name:mesh.name,vertices:mesh.positions.length,faces:mesh.faces.length,edges:t.edges.size,...validateManifold(mesh),inputPolicy:'geometry-only-v1'},null,2));}
 else{const result=unwrapMesh(mesh,new Set(),geometryGenerationOptions(mesh)),edges=new Set(result.seams);
  if(cmd==='unwrap'){if(!out)throw Error('Provide output.obj.');await fs.writeFile(out,meshToOBJ(meshWithPreviewUV(mesh,result.packed)));}
  else{const text=JSON.stringify({inputPolicy:'geometry-only-v1',edges:[...edges],chains:canonicalOrder(mesh,traceSeamChains(mesh,edges))},null,2);if(out)await fs.writeFile(out,text);else console.log(text);}}
}catch(e){console.error(e instanceof Error?e.message:String(e));process.exitCode=1;}
