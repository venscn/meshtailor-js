#!/usr/bin/env node
import fs from 'node:fs/promises';
import { parseOBJ, buildTopology, validateManifold } from '@meshtailor/mesh-core';
import { canonicalOrder, extractSeamEdgesFromUV, traceSeamChains } from '@meshtailor/chaining-seams';
import { generateGeometricSeams } from '@meshtailor/runtime';
import { buildTrainingSample, MESH_TAILOR_V2_SPEC } from '@meshtailor/model';

const [cmd,file,out]=process.argv.slice(2);
async function load(path:string){return parseOBJ(await fs.readFile(path,'utf8'),path.split('/').pop());}
const usage=()=>console.log(`MeshTailor-JS CLI\n\n  npm run cli -- inspect mesh.obj\n  npm run cli -- baseline mesh.obj [out.json]\n  npm run cli -- uv-seams mesh.obj [out.json]\n  npm run cli -- training-sample mesh.obj [out.json]\n  npm run cli -- paper-spec\n`);

if(!cmd){usage();process.exit(0);}
if(cmd==='paper-spec'){console.log(JSON.stringify(MESH_TAILOR_V2_SPEC,null,2));process.exit(0);}
if(!file){usage();process.exit(1);}
const mesh=await load(file);
if(cmd==='inspect'){
  const t=buildTopology(mesh),m=validateManifold(mesh); console.log(JSON.stringify({name:mesh.name,vertices:mesh.positions.length,triangles:mesh.faces.length,edges:t.edges.size,boundaryEdges:t.boundaryEdges.size,...m},null,2));
}else if(cmd==='baseline'){
  const r=generateGeometricSeams(mesh); const data={edges:[...r.seamEdges],chains:r.chains}; const text=JSON.stringify(data,null,2); if(out)await fs.writeFile(out,text);else console.log(text);
}else if(cmd==='uv-seams'){
  const edges=extractSeamEdgesFromUV(mesh); const chains=canonicalOrder(mesh,traceSeamChains(mesh,edges)); const text=JSON.stringify({edges:[...edges],chains},null,2); if(out)await fs.writeFile(out,text);else console.log(text);
}else if(cmd==='training-sample'){
  const text=JSON.stringify(buildTrainingSample(mesh),null,2); if(out)await fs.writeFile(out,text);else console.log(text);
}else {usage();process.exit(1);}
