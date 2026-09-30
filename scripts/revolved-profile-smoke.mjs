/** Regression of the repeated meridian, not a rectangular bounding-box test. */
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
import {lathedFixture,permuteGeometry,rigidVariant,bevelProfile,flangeProfile} from './lib/revolved-profile-fixtures.mjs';
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
 const test=(name,fn)=>{const detail=fn();tests.push({name,passed:true,detail});console.log('PASS',name);};
 const solve=(m,extra={})=>uv.unfoldBand(m,m.faces.map((_,i)=>i),0,new Set(),{...uv.geometryGenerationOptions(m),humanTemplates:{panels:'auto',minAreaFraction:0},...extra},1);
 const validate=(m,r,mapping='rectangle')=>{
  assert.ok(r.raw,JSON.stringify(r));assert.equal(r.entry.metric?.mapping,mapping);assert.equal(r.raw.reduce((n,ch)=>n+ch.faceUVs.size,0),m.faces.length);
  for(const chart of r.raw)assert.ok(uv.checkUVTriangles([...chart.faceUVs.values()]).valid);
  const seams=new Set([...r.seams,...r.locked]);uv.validateRevolvedMetric(r.raw,seams,r.entry.metricContracts,undefined,m);
  return {islands:r.raw.length,mode:r.entry.metric.mapping,maxStretch:r.entry.maxAnisotropy,sections:r.entry.metric.sections};
 };
 const repeated=lathedFixture(bevelProfile),source=JSON.stringify(repeated);
 for(const[title,m]of[['straight cylinder',lathedFixture([[.5,-.4],[.5,0],[.5,.4]])],['symmetric bevel',repeated],['opposite diagonals',lathedFixture(bevelProfile,48,{alternating:true})],['renumbered and reversed faces',permuteGeometry(repeated)],['rotated, translated, seam not on a world axis',rigidVariant(repeated)],['uniform tiny scale',rigidVariant(repeated,.003)],['uniform huge scale',rigidVariant(repeated,50)],['shifted azimuth samples',lathedFixture(bevelProfile,64,{phase:.047})]]){
  test(title,()=>validate(m,solve(m)));
 }
 test('low, medium and high default gear bores use the same metric',()=>{
  const out=[];for(const detail of ['low','medium','high']){const m=core.geometryOnlyMesh(core.makeGearHousing(detail)),faces=m.faces.map((_,i)=>i).filter(i=>m.faces[i].vertices.every(v=>Math.hypot(m.positions[v][0],m.positions[v][2])<.500001));const r=uv.unfoldBand(m,faces,0,new Set(),{...uv.geometryGenerationOptions(m),humanTemplates:{panels:'auto',minAreaFraction:0}},1);assert.ok(r.raw);assert.equal(r.entry.metric?.mapping,'rectangle');assert.equal(r.raw.length,1);assert.equal(r.raw[0].faceUVs.size,faces.length);out.push({detail,faces:faces.length,maxStretch:r.entry.maxAnisotropy});}return out;
 });
 test('explicit two panels and per-panel budget still respected',()=>{
  for(const extra of [{humanTemplates:{panels:2,minAreaFraction:0}},{maxChartFaces:repeated.faces.length/2}]){const r=solve(repeated,extra);validate(repeated,r);assert.equal(r.raw.length,2);}return{faces:repeated.faces.length};
 });
 test('source UV getters cannot influence the metric',()=>{const poison={...repeated,faces:repeated.faces.map(f=>({vertices:f.vertices,get uvs(){throw Error('SOURCE UV');},get uvIndices(){throw Error('SOURCE UV INDEX');}}))};assert.deepEqual(solve(poison).raw,solve(repeated).raw);});
 test('turning off the policy reproduces legacy width drift',()=>{const legacy=uv.unfoldBand(mesh,fs,0,new Set(),{...uv.geometryGenerationOptions(mesh),humanTemplates:{panels:1,minAreaFraction:0,revolvedProfiles:false}},1);assert.equal(legacy.diagnostics[0].method,'human-contour-band');assert.equal(legacy.entry.metric,undefined);});
 test('steep cone remains a sector, not forced to a rectangle',()=>{const m=lathedFixture([[.4,-.5],[.5,0],[.6,.5]]),r=solve(m);assert.ok(r.raw);assert.equal(r.entry.template,'cone-sector');assert.equal(r.entry.metric,undefined);});
 test('eccentric rings are not falsely labelled as repeated circular sections',()=>{const m=lathedFixture(bevelProfile,48,{ellipse:.7}),b=uv.inspectBand(m,m.faces.map((_,i)=>i));assert.ok(b.ok);assert.equal(uv.inspectRevolvedProfile(b.local,b.coord),undefined);});
 test('teeth and pleats are not collapsed into cylinders',()=>{for(const m of [core.makePleatedGarment('low'),core.makeGearHousing('low')]){const b=uv.inspectBand(m,m.faces.map((_,i)=>i));if(b.ok)assert.equal(uv.inspectRevolvedProfile(b.local,b.coord),undefined);}});
 for(const[title,m]of[['radial flange with return detail',lathedFixture(flangeProfile)],['rotated radial flange',rigidVariant(lathedFixture(flangeProfile))]])test(title,()=>{const r=solve(m),d=validate(m,r,'annulus');assert.equal(r.entry.seamEdges.length,0);assert.equal(uv.cutLocalMesh(m,m.faces.map((_,i)=>i),r.seams).boundaryLoops,2);return d;});
 test('hole preservation never discards a protected internal edge',()=>{const m=lathedFixture(flangeProfile),e=[...core.buildTopology(m).edges.values()].find(e=>e.faces.length===2);const r=solve(m,{mergeOptions:{protectedSeams:[core.edgeKey(e.a,e.b)]}});assert.ok(!r.raw);assert.equal(r.reason,'protected-seam-would-be-removed');});
 test('similarity edits accepted; taper/shear and missing meridian rejected',()=>{
  const r=solve(repeated),seams=new Set([...r.seams,...r.locked]),copy=()=>structuredClone(r.raw),good=copy();
  for(const ch of good)for(const[f,t]of ch.faceUVs)ch.faceUVs.set(f,t.map(([x,y])=>[.4*x-.3*y+5,.3*x+.4*y-1]));uv.validateRevolvedMetric(good,seams,r.entry.metricContracts);
  const bad=copy();for(const ch of bad)for(const[f,t]of ch.faceUVs)ch.faceUVs.set(f,t.map(([x,y])=>[x,y*(1+.2*x)]));assert.throws(()=>uv.validateRevolvedMetric(bad,seams,r.entry.metricContracts),/metric changed/);
  const broken=copy();const tri=broken[0].faceUVs.values().next().value;tri[1][0]+=.001;assert.throws(()=>uv.validateRevolvedMetric(broken,seams,r.entry.metricContracts,undefined,repeated),/continuity|metric changed/);
  const missing=new Set(seams);missing.delete(r.entry.metricContracts[0].seams[0]);assert.throws(()=>uv.validateRevolvedMetric(r.raw,missing,r.entry.metricContracts),/seam/);
 });
 test('cancellation and option validation are not swallowed',()=>{assert.throws(()=>uv.unfoldBand(repeated,repeated.faces.map((_,i)=>i),0,new Set(),uv.geometryGenerationOptions(repeated),1,{check(){throw new uv.UVWorkStopped('cancel');}}),/cancel/);assert.throws(()=>uv.humanOptions({revolvedProfiles:'yes'}),/boolean/);});
 test('input geometry, indices and face order stay unchanged',()=>assert.equal(JSON.stringify(repeated),source));
 await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));console.log('PASSED',tests.length);

}catch(e){await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests,error:String(e.stack??e)},null,2));throw e;}finally{await c.cleanup();}
