/** Four-model production regression. No source UV enters the worker.
 * Optional --baseline-js points to an independently compiled older UV module;
 * its packing is evaluated on the very same generated input charts. */
import assert from 'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{join}from'node:path';import{pathToFileURL}from'node:url';import{createHash}from'node:crypto';
import{compileCore}from'./lib/compiled-core.mjs';import{runGeometryJob}from'./lib/geometry-worker.mjs';import{loadVerifiedFixture}from'./lib/verified-model-fixtures.mjs';
const get=(s,d)=>{const i=process.argv.indexOf(s);return i<0?d:process.argv[i+1]},out=get('--out','validation/local-seams-fill'),names=get('--assets','garment,gear,Corset,FlightHelmet').split(','),seconds=Number(get('--seconds',30));await mkdir(out,{recursive:true});const c=await compileCore(),records=[];
const config={fillMode:'area-priority',fillTimeBudgetMs:seconds*1000,fillRounds:8,timeBudgetMs:300000};
try{const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),old=get('--baseline-js')?await import(pathToFileURL(get('--baseline-js'))):undefined;
 for(const name of names){const mesh=core.geometryOnlyMesh(['garment','gear'].includes(name)?core.makeComplexExample(name,'medium'):(await loadVerifiedFixture(core,'examples/verified-models',name,{geometryOnly:true})).mesh);const initial=JSON.stringify(mesh);console.log('GENERATE',name);
  const base=await runGeometryJob(c,{mesh,edges:[],target:'generated',config:{timeBudgetMs:300000}});let reference;
  if(old){console.log('OLD FILL',name);const b=old.fillCurrentUV(mesh,base.packed,new Set(base.seams),config);reference=b.packingReport.refinement;await writeFile(join(out,name+'-old-fill.obj'),core.meshToOBJ(uv.meshWithPreviewUV(mesh,b.packed)));}
  console.log('NEW FILL',name);const filled=await runGeometryJob(c,{mesh,edges:base.seams,target:'fill',seedPolicy:base.inputPolicy,seedCharts:base.packed,seedHuman:base.human,seedPeel:base.peel,config});
  assert.deepEqual(filled.seams,base.seams);assert.equal(filled.packed.length,base.packed.length);assert.equal(JSON.stringify(mesh),initial);let covered=0;
  for(const chart of filled.packed){const original=base.packed.find(c=>c.id===chart.id);assert.deepEqual([...chart.faceUVs.keys()],[...original.faceUVs.keys()]);covered+=chart.faceUVs.size;let scale;
   for(const[fi,t]of chart.faceUVs){const a=original.faceUVs.get(fi);for(let k=0;k<3;k++){const l=Math.hypot(...t[k].map((x,j)=>x-t[(k+1)%3][j])),L=Math.hypot(...a[k].map((x,j)=>x-a[(k+1)%3][j]));if(L<1e-12)continue;const s=l/L;scale??=s;assert.ok(Math.abs(s-scale)<1e-6);assert.ok(s>=1-1e-7);}}
  }
  assert.equal(covered,mesh.faces.length);const quality=uv.checkUVTriangles(filled.packed.flatMap(c=>[...c.faceUVs.values()]),100);assert.ok(quality.valid);assert.ok(quality.area+1e-10>=base.metrics.occupancy);
  const report=filled.packingReport.refinement;assert.ok(Math.abs(report.after-quality.area)<1e-9);assert.ok(report.gains.every(g=>g.areaFactor>=1-1e-10));
  const obj=core.meshToOBJ(uv.meshWithPreviewUV(mesh,filled.packed));await writeFile(join(out,name+'-generated.obj'),obj);await writeFile(join(out,name+'-before-fill.obj'),core.meshToOBJ(uv.meshWithPreviewUV(mesh,base.packed)));
  if(process.argv.includes('--snapshots'))await writeFile(join(out,name+'-snapshot.json'),JSON.stringify({mesh,seams:filled.seams,packed:filled.packed.map(c=>({...c,faceUVs:[...c.faceUVs]})),base:base.packed.map(c=>({...c,faceUVs:[...c.faceUVs]}))}));
  const r={name,faces:covered,islands:filled.packed.length,quality,inputUVRead:false,fragmentation:base.fragmentation?.reasons,human:base.human?.entries.map(e=>({status:e.status,reason:e.reason,panels:e.plannedPanels})),before:base.metrics.occupancy,oldFill:reference,newFill:report,sha256:createHash('sha256').update(obj).digest('hex')};records.push(r);console.log('PASS',name,'occupancy',r.before,reference?.after,report.after,'largestGap',report.cavities?.largestBefore,report.cavities?.largestAfter,'stop',report.stop,'elapsed',filled.timing.elapsedMs);await writeFile(join(out,'report.json'),JSON.stringify({passed:records.length,config,records},null,2));
 }
}finally{await c.cleanup()}
