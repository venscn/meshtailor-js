import assert from'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';import{compileCore}from'./lib/compiled-core.mjs';import{loadVerifiedFixture}from'./lib/verified-model-fixtures.mjs';
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'validation/local-continuous-structure';await mkdir(out,{recursive:true});const c=await compileCore(),tests=[];
try{const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js'),sq=await c.load('packages/uv/src/chart-quality.js');
const whole=core.geometryOnlyMesh((await loadVerifiedFixture(core,'examples/verified-models','FlightHelmet',{geometryOnly:true})).mesh),components=uv.buildCharts(whole,new Set());
// Fixed-count selectors ONLY identify the exact QA part; production has no names/counts.
const fixtures=[['folded-strip',components.find(g=>g.faces.length===262)],['large-shell',components.find(g=>g.faces.length===14992)]];
for(const[name,comp]of fixtures){assert.ok(comp);const mesh={name:'unnamed geometry',positions:whole.positions,faces:comp.faces.map(f=>whole.faces[f])},ids=mesh.faces.map((_,i)=>i),before=JSON.stringify(mesh),opts=uv.geometryGenerationOptions(mesh);console.log('START',name,opts.maxChartFaces);const plan=uv.planSurfaceGroups(mesh,new Set(),opts);console.log('PLAN',name,plan.report.groups.map(g=>[g.kind,g.faces.length]));
 if(name==='folded-strip'){assert.ok(plan.report.groups.some(g=>g.kind==='longitudinal-panels'));assert.deepEqual(plan.report.groups.map(g=>g.faces.length).sort((a,b)=>a-b),[6,32,32,96,96],'Thin longitudinal bevels are combined with complete return sides');const bands=plan.report.groups.filter(g=>g.faces.length>=8);assert.ok(bands.length>=2);assert.ok(bands.every(g=>g.faces.length>=16));}
 else {assert.equal(plan.report.groups.length,2);assert.ok(plan.report.groups.every(g=>g.kind==='symmetric-sheet'));}
 const result=uv.unwrapMesh(mesh,new Set(),opts);console.log('RESULT',name,result.packed.length,result.diagnostics.map(d=>({n:d.faces,m:d.method,s:d.symmetry?.status,r:d.symmetry?.after.rms})));
 assert.equal(JSON.stringify(mesh),before);assert.equal(new Set(result.packed.flatMap(ch=>[...ch.faceUVs.keys()])).size,mesh.faces.length);assert.equal(result.packed.reduce((s,ch)=>s+ch.faceUVs.size,0),mesh.faces.length);assert.ok(uv.checkUVTriangles(result.packed.flatMap(ch=>[...ch.faceUVs.values()])).valid);
 if(name==='large-shell'){assert.equal(result.packed.length,2);assert.equal(result.peel.surfaceContracts.length,2);assert.ok(result.diagnostics.every(d=>d.symmetry&&d.symmetry.status!=='rejected'));assert.equal(uv.validateSurfaceSymmetryOutput(mesh,result.packed,result.peel).size,2);}
 if(name==='folded-strip'){assert.equal(result.packed.length,plan.report.groups.length,'No recursive diagonal bisection of recognized ribbons');assert.ok(result.diagnostics.filter(d=>d.faces>=8).every(d=>['intrinsic-strip','planar-shape','symmetry-constrained','projected-free','lscm'].includes(d.method)));}
 let pairedAudit;
 if(name==='folded-strip'){
   const returns=result.packed.filter(ch=>ch.faceUVs.size===96),local=uv.cutLocalMesh(mesh,ids,new Set()),reflection=uv.detectSurfaceReflection(local);assert.ok(reflection);
   const evalUV=(b,ch)=>{const t=ch.faceUVs.get(local.sourceFaces[b.face]);return [0,1].map(k=>t.reduce((sum,p,i)=>sum+p[k]*b.weights[i],0));};
   const pairs=reflection.pairs.filter(p=>returns[0].faceUVs.has(local.sourceFaces[p.a.face])&&returns[1].faceUVs.has(local.sourceFaces[p.b.face])).map(p=>({a:evalUV(p.a,returns[0]),b:evalUV(p.b,returns[1]),w:p.weight}));assert.ok(pairs.length>=20);
   const total=pairs.reduce((sum,p)=>sum+p.w,0),mean=key=>[0,1].map(k=>pairs.reduce((sum,p)=>sum+p[key][k]*p.w,0)/total),a=mean('a'),b=mean('b');let C=0,S=0,N=0,radius=0;
   for(const p of pairs){const x=-(p.a[0]-a[0]),y=p.a[1]-a[1],u=p.b[0]-b[0],v=p.b[1]-b[1];C+=p.w*(x*u+y*v);S+=p.w*(x*v-y*u);N+=p.w*(x*x+y*y);radius=Math.max(radius,u*u+v*v);}
   const angle=Math.atan2(S,C),scale=Math.hypot(C,S)/N,cs=Math.cos(angle),sn=Math.sin(angle);let error=0,maximum=0;
   for(const p of pairs){const x=-(p.a[0]-a[0]),y=p.a[1]-a[1],d=Math.hypot(scale*(cs*x-sn*y)-(p.b[0]-b[0]),scale*(sn*x+cs*y)-(p.b[1]-b[1]));error+=p.w*d*d;maximum=Math.max(maximum,d);}
   pairedAudit={surfaceSamples:pairs.length,rms:Math.sqrt(error/total)/(2*Math.sqrt(radius)),max:maximum/(2*Math.sqrt(radius)),note:'Independent paired return-side similarity/reflection audit; this is not a global semantic score.'};assert.ok(pairedAudit.rms<.005&&pairedAudit.max<.02);
 }
 const obj=core.meshToOBJ(uv.meshWithPreviewUV(mesh,result.packed));await writeFile(out+'/'+name+'.obj',obj);await writeFile(out+'/'+name+'.json',JSON.stringify({mesh,sourceFaces:comp.faces,seams:result.seams,charts:result.packed.map(ch=>({...ch,faceUVs:[...ch.faceUVs]})),diagnostics:result.diagnostics,peel:result.peel}));tests.push({name,passed:true,pairedAudit,sourceFaces:mesh.faces.length,islands:result.packed.length,parts:result.diagnostics.map(d=>({faces:d.faces,method:d.method,symmetry:d.symmetry,shape:{maxStretch:d.maxStretch,areaStretch:d.areaStretch}})),reasons:result.peel.groups.map(g=>g.structureReason)});await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));
}
} catch(e){console.error(e);await writeFile(out+'/failure.txt',String(e.stack??e));process.exitCode=1;}finally{await c.cleanup();}
