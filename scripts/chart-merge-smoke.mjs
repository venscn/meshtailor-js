import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js');
 const mesh={name:'split-strip',positions:[[0,0,0],[1,0,0],[2,0,0],[3,0,0],[0,1,0],[1,1,0],[2,1,0],[3,1,0]],faces:[]};
 for(let x=0;x<3;x++){mesh.faces.push({vertices:[x,x+1,x+5],uvs:[[0,0],[1,0],[1,1]],uvSpace:'cloth'},{vertices:[x,x+5,x+4],uvs:[[0,0],[1,1],[0,1]],uvSpace:'cloth'});}
 const packed=mesh.faces.map((f,id)=>({id,faceUVs:new Map([[id,f.uvs]]),polygon:[],bounds:[0,0,1,1],uvSpace:'cloth'}));
 const source=JSON.stringify(mesh),before=structuredClone(packed),raw=uv.rawChartsFromPreview(mesh,packed),g=uv.buildChartGraph(mesh,raw.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]}))),seams=new Set(g.links.flatMap(l=>l.edges));
 assert.equal(g.links.length,5);checks++;
 const audit=uv.auditSourceUV(packed);assert.ok(audit.hasOverlaps);assert.equal(audit.domains[0].islands,6);checks++;
 const r=uv.mergeAdjacentCharts(mesh,raw,seams,{...uv.DEFAULT_UNWRAP,postMerge:true});
 assert.equal(r.raw.length,1);assert.equal(r.report.accepted,5);assert.equal(r.report.removedSeams.length,5);checks++;
 assert.equal(uv.buildCharts(mesh,r.seams).length,1);assert.ok(uv.checkUVTriangles([...r.raw[0].faceUVs.values()]).valid);checks++;
 assert.equal(r.raw[0].faceUVs.size,6);assert.deepEqual(packed,before);assert.equal(JSON.stringify(mesh),source);checks++;
 // Surviving protected cuts are not erased by an indirect merge.
 const locked='1:5',p=uv.mergeAdjacentCharts(mesh,raw,seams,{...uv.DEFAULT_UNWRAP,mergeOptions:{protectedSeams:[locked]}});
 assert.equal(p.raw.length,2);assert.ok(p.seams.has(locked));assert.ok(p.report.reasons['protected-seam']);checks++;
 const limited=uv.mergeAdjacentCharts(mesh,raw,seams,{...uv.DEFAULT_UNWRAP,mergeOptions:{maxAttempts:1}});
 assert.equal(limited.raw.length,5);assert.ok(limited.report.budgetExhausted);checks++;
 const capped=uv.mergeAdjacentCharts(mesh,raw,seams,{...uv.DEFAULT_UNWRAP,maxChartFaces:2});assert.equal(capped.raw.length,3);assert.ok(capped.report.reasons['face-budget']);checks++;
 const separated=structuredClone(mesh);for(const f of separated.faces){f.vertices=f.vertices.map(v=>{separated.positions.push([...separated.positions[v]]);return separated.positions.length-1;});}
 const g2=uv.buildChartGraph(separated,raw.map(c=>({id:c.id,faces:[...c.faceUVs.keys()]})));assert.equal(g2.links.length,0);checks++;
 assert.equal(uv.mergeAdjacentCharts(separated,raw,new Set(),uv.DEFAULT_UNWRAP).raw.length,6);checks++;
 const mirrored=structuredClone(packed);for(const vs of mirrored[0].faceUVs.values())for(const v of vs)v[0]*=-1;
 assert.ok(uv.checkUVTriangles([...uv.rawChartsFromPreview(mesh,mirrored)[0].faceUVs.values()]).valid);checks++;
 const broken=structuredClone(packed);broken[0].faceUVs.set(0,[[0,0],[0,0],[1,1]]);assert.throws(()=>uv.rawChartsFromPreview(mesh,broken),/内部/);checks++;
 assert.throws(()=>uv.mergeAdjacentCharts(mesh,raw,seams,{...uv.DEFAULT_UNWRAP,mergeOptions:{maxAttempts:NaN}}),/options/);checks++;
 assert.throws(()=>uv.mergeAdjacentCharts(mesh,raw,seams,{...uv.DEFAULT_UNWRAP,mergeOptions:{protectedSeams:['0:999']}}),/Protected/);checks++;
 let stopped=0;assert.throws(()=>uv.mergeAdjacentCharts(mesh,raw,seams,uv.DEFAULT_UNWRAP,[],{check(){if(++stopped>4)throw new uv.UVWorkStopped('cancel');},report(){}}),/cancel/);checks++;
 const material=structuredClone(mesh);material.faces.slice(2).forEach(f=>f.uvSpace='metal');
 const m=uv.mergeAdjacentCharts(material,raw,seams,{...uv.DEFAULT_UNWRAP,mergeOptions:{respectMaterials:true}});assert.equal(m.raw.length,2);checks++;
 const generated=uv.unwrapMesh(mesh,seams,{...uv.DEFAULT_UNWRAP,postMerge:true});assert.equal(generated.packed.length,1);assert.equal(generated.merge.before,6);checks++;
 const cone=core.makeComplexExample('gear','low'),run=uv.unwrapMesh(cone,new Set(),{...uv.DEFAULT_UNWRAP,initialSegmentation:'connected',postMerge:true});
 assert.equal(run.packed.reduce((s,c)=>s+c.faceUVs.size,0),cone.faces.length);for(const p of run.packed)assert.ok(uv.checkUVTriangles([...p.faceUVs.values()]).valid);checks++;
 console.log(`${checks} chart-adjacency / merge checks passed; gear low: ${run.packed.length} islands, merge: ${JSON.stringify(run.merge)}`);
}finally{await c.cleanup();}
