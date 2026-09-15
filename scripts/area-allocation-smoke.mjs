import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try {
 const uv=await c.load('packages/uv/src/index.js');
 const mesh={name:'oversized-small-detail',positions:[],faces:[]},packed=[];
 // Huge UV on smallest physical face, tiny UV on largest face. All are valid triangles.
 for(const [id,size,uvSize] of [[0,.1,10],[1,3,.1],[2,1,1]]){
  const i=mesh.positions.length;mesh.positions.push([id*4,0,0],[id*4+size,0,0],[id*4,size,0]);mesh.faces.push({vertices:[i,i+1,i+2]});
  packed.push({id,faceUVs:new Map([[id,[[0,0],[uvSize,0],[0,uvSize]]]]),bounds:[0,0,uvSize,uvSize],polygon:[]});
 }
 const source=structuredClone({mesh,packed});const a=uv.auditIslandAreas(mesh,packed);
 assert.ok(a.islands[0].densityRatio>900);assert.ok(a.oversized.includes(0));checks++;
 const raw=uv.rawChartsFromPreview(mesh,packed);
 for(const packing of ['maxrects','shelf']){
  const r=uv.packAtlas(raw,{packing});const after=uv.auditIslandAreas(mesh,r.packed);
  for(const island of after.islands)assert.ok(Math.abs(island.densityRatio-1)<1e-8);checks++;
  assert.deepEqual(r.packingReport.placementOrder,[1,2,0]);checks++;
  assert.ok(r.packingReport.searchAttempts>1&&r.packingReport.failedFits>0);checks++;
  assert.ok(uv.checkUVTriangles(r.packed.flatMap(p=>[...p.faceUVs.values()])).valid);checks++;
  const boosted=uv.packAtlas(raw,{packing,tinyIslandAreaFraction:.01,maxTinyAreaBoost:2});
  const factors=boosted.packingReport.areaBoosts;assert.equal(factors.length,1);assert.equal(factors[0].factor,2);checks++;
  const b=uv.auditIslandAreas(mesh,boosted.packed);const d=b.islands.map(x=>x.areaUV/x.area3D);assert.ok(Math.abs(d[0]/d[1]-2)<1e-8);checks++;
 }
 assert.deepEqual({mesh,packed},source);checks++;
 for(const opts of [{maxTinyAreaBoost:Infinity},{maxTinyAreaBoost:5},{tinyIslandAreaFraction:-1},{packingOrder:'banana'}]){assert.throws(()=>uv.packAtlas(raw,opts),/allocation/);checks++;}
 console.log(`${checks} area allocation checks passed: original small island >900x share; normalized density ratio 1; large-first placement; <=2x area boost; no mutation.`);
}finally{await c.cleanup();}
