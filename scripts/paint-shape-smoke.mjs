import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),cases=[];const check=(name,fn)=>{const detail=fn();cases.push({name,passed:true,detail});console.log('PASS',name)};
try{
 const uv=await c.load('packages/uv/src/index.js'),core=await c.load('packages/mesh-core/src/index.js');
 const rectangle={name:'hand-paint rectangular panel',positions:[[0,0,0],[3,0,0],[3,1,0],[0,1,0]],faces:[{vertices:[0,1,2]},{vertices:[0,2,3]}]};
 const local=uv.cutLocalMesh(rectangle,[0,1],new Set());
 const ratios=(l,p)=>l.triangles.flatMap(t=>t.map((a,k)=>{const b=t[(k+1)%3];return Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1])/Math.hypot(...l.positions[a].map((x,j)=>x-l.positions[b][j]));}));
 check('Default objective prioritizes paintable shape',()=>assert.equal(uv.DEFAULT_UNWRAP.uvObjective,'paint'));
 check('Planar rectangular silhouette exactly preserved',()=>{const p=uv.parameterizeChart(local);assert.equal(p.method,'planar-shape');assert.ok(p.quality.valid);const q=ratios(local,p.uv);assert.ok(Math.max(...q)-Math.min(...q)<1e-12)});
 const circle=uv.parameterizeChart(local,{method:'tutte',uvObjective:'compact'});
 check('Legacy explicit circular embedding remains an auditable opt-in',()=>{assert.equal(circle.method,'tutte');assert.ok(circle.quality.valid)});
 const freed=uv.freeBoundaryARAP(local,circle.uv,60,600);
 check('Free boundary ARAP escapes circular initial boundary',()=>{const q=ratios(local,freed.uv);assert.ok(Math.max(...q)/Math.min(...q)<1.03);assert.ok(freed.energy<freed.initialEnergy*.02);assert.ok(uv.checkUVTriangles(local.triangles.map(t=>t.map(v=>freed.uv[v]))).valid);return {initial:freed.initialEnergy,final:freed.energy,iterations:freed.iterations}});
 const n=64,ring={name:'toothed annulus',positions:[],faces:[]};
 for(let r=0;r<2;r++)for(let i=0;i<n;i++){const theta=i/n*Math.PI*2,radius=r?(i%4<2?2:1.65):.6;ring.positions.push([radius*Math.cos(theta),radius*Math.sin(theta),0]);}
 for(let i=0;i<n;i++){const j=(i+1)%n;ring.faces.push({vertices:[i,n+i,n+j]},{vertices:[i,n+j,j]});}
 const rl=uv.cutLocalMesh(ring,ring.faces.map((_,i)=>i),new Set());
 check('A planar hole is not automatically cut open or made circular',()=>{assert.equal(rl.boundaryLoops,2);const p=uv.parameterizeChart(rl);assert.equal(p.method,'planar-shape');assert.ok(p.quality.valid);const q=ratios(rl,p.uv);assert.ok(Math.max(...q)-Math.min(...q)<1e-12)});
 check('Production unwrap preserves planar gear teeth and hole as one island',()=>{const p=uv.unwrapMesh(ring,new Set(),{initialSegmentation:'connected'});assert.equal(p.packed.length,1);assert.equal(p.addedSeams.length,0);assert.equal(p.diagnostics[0].method,'planar-shape');assert.ok(uv.checkUVTriangles([...p.packed[0].faceUVs.values()]).valid)});
 const raw={id:0,area3D:3,faceUVs:new Map([[0,[[0,0],[3,0],[3,1]]],[1,[[0,0],[3,1],[0,1]]]])};
 check('Shape guard allows rotation/translation/uniform scale',()=>{const m=new Map([...raw.faceUVs].map(([i,v])=>[i,v.map(p=>[-2*p[1]+10,2*p[0]-3])]));assert.ok(Math.abs(uv.uvShapeChange(rectangle,raw,m)-1)<1e-12)});
 check('Shape guard detects collapse of garment proportions',()=>{const m=new Map([...raw.faceUVs].map(([i,v])=>[i,v.map(p=>[p[0]/10,p[1]*10])]));assert.ok(uv.uvShapeChange(rectangle,raw,m)>5)});
 check('Invalid objectives fail explicitly',()=>assert.throws(()=>uv.parameterizeChart(local,{uvObjective:'bad'}),/objective/));
 check('Cancelled ARAP never returns a partial result',()=>assert.throws(()=>uv.freeBoundaryARAP(local,circle.uv,10,100,{check(){throw new uv.UVWorkStopped('cancel')},report(){}}),/cancel/));
 const models=[];
 for(const id of ['gear','garment']){
  const mesh=core.makeComplexExample(id,'low'),before=JSON.stringify(mesh);
  for(const goal of ['compact','paint']){const start=performance.now(),r=uv.unwrapMesh(mesh,new Set(),{uvObjective:goal});
   assert.ok(r.packed.every(p=>uv.checkUVTriangles([...p.faceUVs.values()]).valid));assert.equal(r.packed.reduce((n,p)=>n+p.faceUVs.size,0),mesh.faces.length);
   if(goal==='paint')assert.ok(r.diagnostics.every(d=>d.method!=='tutte'));
   const d={id,goal,faces:mesh.faces.length,islands:r.packed.length,methods:r.diagnostics.reduce((s,d)=>(s[d.method]=(s[d.method]??0)+1,s),{}),occupancy:r.occupancy,elapsedMs:performance.now()-start};models.push(d);console.log(d);
   const dest=process.argv.indexOf('--out');if(dest>=0){await mkdir(process.argv[dest+1],{recursive:true});await writeFile(process.argv[dest+1]+'/'+id+'-'+goal+'.obj',core.meshToOBJ(uv.meshWithPreviewUV(mesh,r.packed)));}
  }
  assert.equal(JSON.stringify(mesh),before);cases.push({name:id+' both objectives keep all source faces and valid UV',passed:true});
 }
 const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:cases.length,cases,models},null,2));
}finally{await c.cleanup()}
