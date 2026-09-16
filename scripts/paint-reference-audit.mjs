/** Verify fixed input-outline bounds on already-produced real-model snapshots. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const i=process.argv.indexOf('--root');if(i<0)throw Error('Pass --root <verified result snapshots>');
const root=process.argv[i+1],c=await compileCore(),report={scope:'All valid original source UV charts, area-weighted 99% similarity-normalized edge change',assets:[]};
try{
 const uv=await c.load('packages/uv/src/index.js'),seams=await c.load('packages/chaining-seams/src/index.js');
 for(const name of ['Corset','FlightHelmet']){
  const s=JSON.parse(await readFile(root+'/'+name+'-source-atlas-mesh.json','utf8')),mesh=s.mesh;
  const charts=uv.sourceUVPreview(mesh,uv.buildCharts(mesh,seams.extractSeamEdgesFromUV(mesh)),'overlay');
  const next=new Map(s.packed.flatMap(c=>c.faceUVs)),audits=[];
  for(const ch of charts){const q=uv.checkUVTriangles([...ch.faceUVs.values()]);if(q.overlaps||q.degenerate||q.flipped!==0&&q.flipped!==q.triangles)continue;
   const change=uv.uvShapeChange(mesh,{...ch,area3D:0},next);assert.ok(change<=1.5+1e-8,`${name} source #${ch.id+1} outline change ${change}`);audits.push({id:ch.id+1,change});
  }
  report.assets.push({name,checked:audits.length,preservedSimilarity:audits.filter(x=>x.change<1+1e-5).length,maximumChange:Math.max(...audits.map(x=>x.change)),audits});
 }
 const o=process.argv.indexOf('--report');if(o>=0)await writeFile(process.argv[o+1],JSON.stringify(report,null,2));console.log(JSON.stringify(report.assets.map(({audits,...r})=>r),null,2));
}finally{await c.cleanup()}
