import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),tests=[];
const test=(name,fn)=>{const detail=fn();tests.push({name,passed:true,detail});console.log('PASS',name)};
const get=(k,d)=>process.argv.includes(k)?process.argv[process.argv.indexOf(k)+1]:d;
const out=get('--out','validation/local-tubes');await mkdir(out,{recursive:true});
try{
 const core=await c.load('packages/mesh-core/src/index.js'),uv=await c.load('packages/uv/src/index.js');
 const verify=(mesh,r)=>{const q=uv.checkUVTriangles(r.packed.flatMap(c=>[...c.faceUVs.values()]));assert.ok(q.valid);assert.equal(new Set(r.packed.flatMap(c=>[...c.faceUVs.keys()])).size,mesh.faces.length);assert.equal(r.packed.reduce((s,c)=>s+c.faceUVs.size,0),mesh.faces.length);uv.validateTubeOutput(r.packed,new Set(r.seams),r.peel?.tubeContracts);const top=core.buildTopology(mesh);assert.ok(r.seams.every(e=>top.edges.has(e)));};
 const signature=r=>JSON.stringify({seams:r.seams,uv:r.packed.map(c=>[c.id,[...c.faceUVs]])});
 let medium,mediumMesh;
 for(const detail of ['low','medium','high']){
  const mesh=core.geometryOnlyMesh(core.makeTorusKnot(detail)),before=JSON.stringify(mesh),opts=uv.geometryGenerationOptions(mesh);let r;
  test(detail+': default geometry route yields rectangles, not tree/cotree ribbons',()=>{r=uv.unwrapMesh(mesh,new Set(),opts);assert.ok(r.peel?.tubeReports?.length===1);assert.ok(r.diagnostics.every(d=>d.method==='closed-tube-strip'));assert.equal(r.packed.length,detail==='high'?2:1);assert.ok(r.diagnostics.every(d=>d.faces<=opts.maxChartFaces));verify(mesh,r);assert.equal(JSON.stringify(mesh),before);return{faces:mesh.faces.length,islands:r.packed.length,report:r.peel.tubeReports[0],occupancy:r.occupancy};});
  test(detail+': per-face metric does not collapse either direction',()=>{const report=r.peel.tubeReports[0];assert.ok(report.maxStretch<1.2);assert.ok(report.minAreaDensity>.85);assert.ok(report.maxAreaDensity<1.2);assert.ok(report.aspect>20&&report.aspect<21);assert.ok(r.diagnostics.every(d=>Math.abs(d.fill-1)<1e-8));});
  if(detail==='medium'){medium=r;mediumMesh=mesh;await writeFile(out+'/knot-single.obj',core.meshToOBJ(uv.meshWithPreviewUV(mesh,r.packed)));}
  test(detail+': explicit five panels retain all sides and produce a denser tile without shearing',()=>{const r=uv.unwrapMesh(mesh,new Set(),{...opts,closedTubePanels:5});assert.equal(r.packed.length,5);verify(mesh,r);assert.ok(r.occupancy>.74);assert.ok(r.peel.tubeReports[0].transverseEdges===5*r.peel.tubeReports[0].verticesPerRing);if(detail==='medium'){
    // Outputs are written after the synchronous assertion block below.
    globalThis.fiveResult={mesh,result:r};
  }return{occupancy:r.occupancy,panels:5};});
 }
 if(globalThis.fiveResult){const{mesh,result}=globalThis.fiveResult;await writeFile(out+'/knot-five.obj',core.meshToOBJ(uv.meshWithPreviewUV(mesh,result.packed)));}
 const base=core.geometryOnlyMesh(core.makeTorusKnot('low')),opts=uv.geometryGenerationOptions(base),ref=uv.unwrapMesh(base,new Set(),opts);
 test('original, removed, randomized, and throwing UV getters yield the identical full result',()=>{
  const original=core.makeTorusKnot('low'),random={...base,faces:base.faces.map((f,i)=>({...f,uvs:[[i,-8],[1,i],[88,7]],uvIndices:[999,i,0]}))};
  const poisoned={...base,name:'not-a-knot',faces:base.faces.map(f=>({vertices:f.vertices,get uvs(){throw Error('SOURCE UV READ')},get uvIndices(){throw Error('SOURCE UV INDEX READ')},get sourceIsland(){throw Error('SOURCE ISLAND READ')}}))};
  for(const mesh of [original,random,poisoned])assert.equal(signature(uv.unwrapMesh(mesh,new Set(),opts)),signature(ref));
 });
 const altered=(flips=false)=>{const m={...base,faces:[]};for(let i=0;i<base.faces.length;i+=2){const[a,b,e]=base.faces[i].vertices,d=base.faces[i+1].vertices[2];if(!flips||i%6===0)m.faces.push({vertices:[a,b,d]},{vertices:[b,e,d]});else m.faces.push(base.faces[i],base.faces[i+1]);}return m;};
 for(const mixed of [false,true])test((mixed?'mixed':'opposite')+' quad diagonals retain tube coordinates from geometry',()=>{const mesh=altered(mixed),r=uv.unwrapMesh(mesh,new Set(),opts);assert.ok(r.peel.tubeReports?.length===1);verify(mesh,r);assert.ok(r.peel.tubeReports[0].maxStretch<1.22);});
 test('vertex/face reindexing and triangle cyclic permutations preserve rectangle recognition',()=>{const n=base.positions.length,perm=Array.from({length:n},(_,i)=>(i*17+53)%n);assert.equal(new Set(perm).size,n);const positions=Array(n);base.positions.forEach((p,i)=>positions[perm[i]]=p);const faces=base.faces.slice().reverse().map((f,i)=>({vertices:[0,1,2].map(k=>perm[f.vertices[(k+i)%3]])}));const mesh={name:'shuffled',positions,faces},r=uv.unwrapMesh(mesh,new Set(),opts);verify(mesh,r);assert.equal(r.peel.tubeReports?.length,1);assert.equal(r.peel.tubeReports[0].rings,96);assert.ok(Math.abs(r.peel.tubeReports[0].aspect-ref.peel.tubeReports[0].aspect)<1e-6);});
 test('proper rotation/translation and uniform scale preserve measured aspect and valid cuts',()=>{const mesh={...base,positions:base.positions.map(([x,y,z])=>{const a=.713,b=.381,X=x*Math.cos(a)-z*Math.sin(a),Z=x*Math.sin(a)+z*Math.cos(a);return[4+X*3.7,-2+3.7*(y*Math.cos(b)-Z*Math.sin(b)),1+3.7*(y*Math.sin(b)+Z*Math.cos(b))]})};const r=uv.unwrapMesh(mesh,new Set(),opts);verify(mesh,r);assert.ok(Math.abs(r.peel.tubeReports[0].aspect-ref.peel.tubeReports[0].aspect)<1e-6);});
 // Independent test sweeps: no source UV fields, no production generator.
 function sweep(wavy=false,variable=false){const N=72,M=16,positions=[],faces=[];const unit=p=>{const l=Math.hypot(...p);return p.map(x=>x/l)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
  for(let i=0;i<N;i++){const t=2*Math.PI*i/N,center=[1.6*Math.cos(t),wavy?.22*Math.sin(3*t):0,1.6*Math.sin(t)],T=unit([-1.6*Math.sin(t),wavy?.66*Math.cos(3*t):0,1.6*Math.cos(t)]),R=[Math.cos(t),0,Math.sin(t)],d=dot(R,T),U=unit(R.map((x,k)=>x-d*T[k])),V=cross(T,U),r=.16*(variable?1+.04*Math.cos(3*t):1);
   for(let j=0;j<M;j++){const a=2*Math.PI*j/M;positions.push(center.map((x,k)=>x+r*(Math.cos(a)*U[k]+Math.sin(a)*V[k])));}}
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*M+j,b=(i+1)%N*M+j,d=i*M+(j+1)%M,e=(i+1)%N*M+(j+1)%M;faces.push({vertices:[a,b,e]},{vertices:[a,e,d]});}return{name:'anonymous closed sweep',positions,faces};}
 for(const [wavy,variable]of [[false,false],[true,false],[true,true]])test(`independent sweep: wavy=${wavy}, variable radius=${variable}`,()=>{const mesh=sweep(wavy,variable),r=uv.unwrapMesh(mesh,new Set(),uv.geometryGenerationOptions(mesh));assert.equal(r.peel.tubeReports?.length,1);verify(mesh,r);assert.ok(r.peel.tubeReports[0].maxStretch<1.5);return r.peel.tubeReports[0].maxStretch;});
 test('open, nonmanifold, planar and noncircular gear inputs are not falsely forced to rectangles',()=>{
  const open={...base,faces:base.faces.slice(24)},bad={...base,faces:[...base.faces,base.faces[0]]};
  for(const mesh of [open,bad,core.makeGearHousing('low'),core.makeCube(),core.makePleatedGarment('low')])assert.equal(uv.inspectClosedTube(mesh,mesh.faces.map((_,i)=>i),new Set()),undefined);
 });
 test('explicit cut constraints and disabled/strict policy are honored',()=>{
  assert.equal(uv.unfoldClosedTube(base,base.faces.map((_,i)=>i),0,new Set([core.edgeKey(...base.faces[0].vertices.slice(0,2))]),opts),undefined);
  assert.equal(uv.unfoldClosedTube(base,base.faces.map((_,i)=>i),0,new Set(),{...opts,closedTubeStrips:false}),undefined);
  assert.equal(uv.unfoldClosedTube(base,base.faces.map((_,i)=>i),0,new Set(),{...opts,closedTubeMaxStretch:1.05}),undefined);
 });
 test('cancellation and parameter validation never return a partial tube',()=>{assert.throws(()=>uv.unwrapMesh(base,new Set(),opts,{check(){throw new uv.UVWorkStopped('cancel-test')},report(){}}),/cancel-test/);for(const options of [{closedTubePanels:0},{closedTubePanels:2.5},{closedTubePanels:65},{closedTubeStrips:'yes'},{closedTubeMaxStretch:100}])assert.throws(()=>uv.unwrapMesh(base,new Set(),{...opts,...options}));});
 test('rectangle output validation catches shear, collapsed side and a lost seam',()=>{const bad=structuredClone(medium.packed);for(const chart of bad)for(const t of chart.faceUVs.values())for(const p of t)p[0]+=.2*p[1];assert.throws(()=>uv.validateTubeOutput(bad,new Set(medium.seams),medium.peel.tubeContracts),/distorted/);assert.throws(()=>uv.validateTubeOutput(medium.packed,new Set(),medium.peel.tubeContracts),/seam lost/);});
 await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests},null,2));console.log('PASS ALL',tests.length);
}catch(error){await writeFile(out+'/report.json',JSON.stringify({passed:tests.length,tests,error:String(error.stack??error)},null,2));throw error;}finally{await c.cleanup()}
