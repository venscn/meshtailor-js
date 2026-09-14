import assert from 'node:assert/strict';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore();
try{
 const uv=await c.load('packages/uv/src/index.js');
 const folded={name:'folded',positions:[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[1,0,1],[1,1,1]],faces:[{vertices:[0,1,2]},{vertices:[0,2,3]},{vertices:[1,4,5]},{vertices:[1,5,2]}]};
 const cut=uv.cutLocalMesh(folded,[0,1,2,3],new Set());assert.equal(cut.disk,true);assert.equal(cut.positions.length,6);
 const p=uv.parameterizeChart(cut);assert.equal(p.method,'lscm');assert.equal(p.quality.valid,true);
 // Ratios of edge lengths must remain exact on this developable two-panel surface.
 const ratios=[];for(const t of cut.triangles)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3];ratios.push(Math.hypot(...p.uv[a].map((x,i)=>x-p.uv[b][i]))/Math.hypot(...cut.positions[a].map((x,i)=>x-cut.positions[b][i])));}
 assert.ok(Math.max(...ratios)-Math.min(...ratios)<1e-6);
 const q=uv.parameterizeChart(cut,{method:'tutte'});assert.ok(q.quality.valid);
 const overlap=uv.checkUVTriangles([[[0,0],[1,0],[0,1]],[[.1,.1],[1.1,.1],[.1,1.1]]]);assert.equal(overlap.overlaps,1);
 const contact=uv.checkUVTriangles([[[0,0],[1,0],[0,1]],[[1,0],[1,1],[0,1]]]);assert.equal(contact.overlaps,0);assert.ok(contact.valid);
 const flipped=uv.checkUVTriangles([[[0,0],[0,1],[1,0]]]);assert.equal(flipped.flipped,1);
 const collapsed=uv.checkUVTriangles([[[0,0],[1,0],[2,0]]]);assert.equal(collapsed.degenerate,1);
 // A longitudinal slit on a tube stays ONE connected disk yet must duplicate seam vertices.
 const n=12,positions=[],faces=[];for(let z=0;z<2;z++)for(let i=0;i<n;i++)positions.push([Math.cos(i/n*2*Math.PI),Math.sin(i/n*2*Math.PI),z]);
 for(let i=0;i<n;i++){const j=(i+1)%n;faces.push({vertices:[i,j,n+j]},{vertices:[i,n+j,n+i]});}
 const tube={name:'tube',positions,faces};const uncut=uv.cutLocalMesh(tube,faces.map((_,i)=>i),new Set());assert.equal(uncut.disk,false);assert.equal(uncut.boundaryLoops,2);
 const slit=uv.cutLocalMesh(tube,faces.map((_,i)=>i),new Set(['0:12']));assert.equal(slit.disk,true);assert.equal(slit.positions.length,26);
 const s=uv.parameterizeChart(slit);assert.ok(s.quality.valid);assert.equal(s.method,'lscm');
 console.log('PASS: 10 parameterization regressions (folded panel, strict overlap, tube slit, LSCM/Tutte).');
}finally{await c.cleanup();}
