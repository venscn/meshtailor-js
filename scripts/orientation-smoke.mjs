import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();let checks=0;
const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
try{
 const uv=await c.load('packages/uv/src/index.js');
 const mesh={name:'asymmetric L-panel',positions:[[0,0,0],[2,0,0],[2,1,0],[0,1,0],[2,0,1],[2,1,1]],faces:[{vertices:[0,1,2]},{vertices:[0,2,3]},{vertices:[1,4,5]},{vertices:[1,5,2]}]};
 const local=uv.cutLocalMesh(mesh,[0,1,2,3],new Set()),p=uv.parameterizeChart(local);
 const area=(o,fi)=>{const i=fi*9;return(o[i+3]-o[i])*(o[i+7]-o[i+1])-(o[i+4]-o[i+1])*(o[i+6]-o[i]);};
 for(const sign of [1,-1])for(const angle of [0,Math.PI/2,Math.PI]){
  const faceUVs=new Map(local.sourceFaces.map((fi,j)=>[fi,local.triangles[j].map(v=>{const [u,vv]=p.uv[v];return [.5+Math.cos(angle)*u-Math.sin(angle)*vv*sign,.5+Math.sin(angle)*u+Math.cos(angle)*vv*sign];})]));
  const chart={id:0,faceUVs,bounds:[0,0,1,1],polygon:[]},g=uv.buildUnfoldGeometry(mesh,[chart]),before=JSON.stringify([...faceUVs]);
  const options={progress:0,selected:[0],order:'sequential',path:'hinge',separation:.5,holdNet:true};
  check(`parity ${sign}, atlas rotation ${angle.toFixed(2)}: rigid net faces target side`,()=>{
   assert.equal(g.hinge.islands[0].targetOrientation,sign);
   const basis=g.hinge.islands[0].basis,[a,b,c,d,e,f,h,i,j]=basis;
   assert.ok(Math.abs(a*(e*j-f*i)-b*(d*j-f*h)+c*(d*i-e*h)-1)<1e-9,'must be a proper rotation');
  });
  check(`parity ${sign}, rotation ${angle.toFixed(2)}: no late-stage zero-area flip`,()=>{
   for(let t=0;t<=100;t++){
    const o=uv.writeUnfoldPositions(g,{...options,progress:.7+t*.003});
    for(let fi=0;fi<mesh.faces.length;fi++)assert.ok(area(o,fi)*sign>1e-6,`pose ${.7+t*.003}, face ${fi}`);
   }
  });
  check(`parity ${sign}, rotation ${angle.toFixed(2)}: endpoint, UV export and reverse scrubbing`,()=>{
   assert.deepEqual(uv.writeUnfoldPositions(g,options),g.source);
   assert.deepEqual(uv.writeUnfoldPositions(g,{...options,progress:1}),g.target);
   assert.equal(JSON.stringify([...faceUVs]),before);
   const out=new Float32Array(g.source.length);uv.writeUnfoldPositions(g,{...options,progress:.95},out);uv.writeUnfoldPositions(g,{...options,progress:.4},out);assert.deepEqual(out,uv.writeUnfoldPositions(g,{...options,progress:.4}));
   const exported=uv.meshWithPreviewUV(mesh,[chart]);for(let fi=0;fi<mesh.faces.length;fi++)assert.deepEqual(exported.faces[fi].uvs,faceUVs.get(fi));
  });
 }
 console.log(`${checks} orientation regressions passed.`);
}finally{await c.cleanup();}
