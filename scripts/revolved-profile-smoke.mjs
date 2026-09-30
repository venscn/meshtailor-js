/** Regression of the repeated meridian, not a rectangular bounding-box test. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-revolved-profile';
await mkdir(out,{recursive:true});const c=await compileCore(),tests=[];
try {
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js');
 const mesh=core.geometryOnlyMesh(core.makeGearHousing('medium'));
 const fs=mesh.faces.map((_,i)=>i).filter(i=>mesh.faces[i].vertices.every(v=>Math.hypot(mesh.positions[v][0],mesh.positions[v][2])<.500001));
 const r=uv.unfoldBand(mesh,fs,0,new Set(),{...uv.geometryGenerationOptions(mesh),humanTemplates:{panels:'auto',minAreaFraction:0}},1);
 assert.ok(r.raw,JSON.stringify(r));assert.equal(r.raw.length,1);assert.equal(r.raw[0].faceUVs.size,2304);
 const columns=new Map();
 for(const[fi,t]of r.raw[0].faceUVs){const vs=mesh.faces[fi].vertices;for(let k=0;k<3;k++){
  const a=vs[k],b=vs[(k+1)%3],pa=mesh.positions[a],pb=mesh.positions[b],theta=Math.atan2(pa[2],pa[0]);
  if(Math.abs(Math.sin((theta-Math.atan2(pb[2],pb[0]))/2))>1e-8)continue;
  const edges=columns.get(theta.toFixed(7))??new Map();edges.set([a,b].sort((a,b)=>a-b).join(':'),[Math.hypot(...pa.map((x,j)=>x-pb[j])),Math.hypot(...t[k].map((x,j)=>x-t[(k+1)%3][j]))]);columns.set(theta.toFixed(7),edges);
 }}
 const widths=[...columns.values()].map(es=>[...es.values()].reduce((a,b)=>[a[0]+b[0],a[1]+b[1]],[0,0]));
 const spread=Math.max(...widths.map(w=>w[1]))/Math.min(...widths.map(w=>w[1]));
 const metric={crossSections:widths.length,sourceWidthRange:[Math.min(...widths.map(w=>w[0])),Math.max(...widths.map(w=>w[0]))],generatedWidthRatio:spread,method:r.diagnostics[0].method};
 await writeFile(out+'/measurement.json',JSON.stringify(metric,null,2));
 assert.ok(spread<1.00001,`Identical repeated 3D profiles acquired unequal UV widths: ${spread}`);
 tests.push({name:'beveled bore: identical meridians have equal UV widths',passed:true,detail:metric});
 await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));console.log('PASS',tests[0].name,metric);
}catch(e){await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests,error:String(e.stack??e)},null,2));throw e;}finally{await c.cleanup();}
