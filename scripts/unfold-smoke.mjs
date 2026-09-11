import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileCore } from './lib/compiled-core.mjs';
const compiled = await compileCore();
const report = { suite: 'Unfold correspondence, selection and endpoint regression', cases: [] };
const check = (name, fn) => { fn(); report.cases.push({ name, passed: true }); };
const near = (a,b,e=2e-6) => assert.ok(Math.abs(a-b)<e, `${a} != ${b}`);
try {
  const core = await compiled.load('packages/mesh-core/src/index.js');
  const uv = await compiled.load('packages/uv/src/index.js');
  const seams = await compiled.load('packages/chaining-seams/src/index.js');
  const view = await compiled.load('apps/studio/src/viewport-math.js');
  const cube = core.parseOBJ(await readFile(join(compiled.root,'examples/cube_uv.obj'),'utf8'));
  const make = (mesh,source=false) => {
    const edges = source ? seams.extractSeamEdgesFromUV(mesh) : new Set(core.buildTopology(mesh).edges.keys());
    const charts=uv.buildCharts(mesh,edges);
    const packed=source?uv.sourceUVPreview(mesh,charts):uv.planarPackPreview(mesh,charts);
    return { packed, geometry:uv.buildUnfoldGeometry(mesh,packed,edges), edges };
  };
  const {geometry:g,packed,edges}=make(cube,true);
  const demoModule=await compiled.load('apps/studio/src/unfold/demo.js');
  check('One-click demo has six real charts and matching source UVs',()=>{const demo=demoModule.makeUnfoldDemo();assert.equal(uv.buildCharts(demo.mesh,demo.edges).length,6);assert.equal(seams.extractSeamEdgesFromUV(demo.mesh).size,demo.edges.size);assert.ok(demo.frames.length>0);assert.ok(demo.mesh.faces.every(f=>f.uvs?.length===3));});
  const all=g.islands.map(i=>i.id);
  const opts={progress:0,selected:all,order:'together',path:'staged',separation:.6};
  check('UV cube has six real islands, not a triangle-per-island proxy',()=>assert.equal(g.islands.length,6));
  check('Source positions match traversal normalization exactly',()=>assert.deepEqual(g.source,view.prepareViewportMesh(cube).triangles));
  check('Every corner retains its exact face/UV pairing',()=>{
    for(const chart of packed)for(const [fi,vs] of chart.faceUVs){assert.equal(g.faceChart[fi],chart.id);vs.forEach((q,k)=>{const w=uv.uvToWorld(q,g.atlas);for(let a=0;a<3;a++)near(g.target[fi*9+k*3+a],w[a]);});}
  });
  for(const order of ['together','sequential'])for(const path of ['direct','staged']){
    check(`${order}/${path}: 0% is EXACT source`,()=>assert.deepEqual(uv.writeUnfoldPositions(g,{...opts,order,path}),g.source));
    check(`${order}/${path}: 100% is EXACT shared UV target`,()=>assert.deepEqual(uv.writeUnfoldPositions(g,{...opts,order,path,progress:1}),g.target));
    check(`${order}/${path}: scrubbing backward has no state accumulation`,()=>{
      const buffer=new Float32Array(g.source.length);uv.writeUnfoldPositions(g,{...opts,order,path,progress:.73},buffer);
      uv.writeUnfoldPositions(g,{...opts,order,path,progress:.16},buffer);
      assert.deepEqual(buffer,uv.writeUnfoldPositions(g,{...opts,order,path,progress:.16}));
    });
  }
  check('Single and multi selection leave ALL other vertices at source',()=>{
    for(const chosen of [[all[2]],[all[1],all[4]]]){const out=uv.writeUnfoldPositions(g,{...opts,selected:chosen,progress:1});for(let fi=0;fi<cube.faces.length;fi++){const expected=chosen.includes(g.faceChart[fi])?g.target:g.source;assert.deepEqual(out.slice(fi*9,fi*9+9),expected.slice(fi*9,fi*9+9));}}
  });
  check('Empty selection leaves everything assembled',()=>assert.deepEqual(uv.writeUnfoldPositions(g,{...opts,selected:[],progress:1}),g.source));
  check('Sequential schedule: completed/current/waiting islands differ',()=>{
    const out=uv.writeUnfoldPositions(g,{...opts,progress:1.5/all.length,order:'sequential'});
    for(const island of g.islands){const fi=island.faces[0],v=out.slice(fi*9,fi*9+9);if(island.id===all[0])assert.deepEqual(v,g.target.slice(fi*9,fi*9+9));else if(island.id===all[1]){assert.notDeepEqual(v,g.source.slice(fi*9,fi*9+9));assert.notDeepEqual(v,g.target.slice(fi*9,fi*9+9));}else assert.deepEqual(v,g.source.slice(fi*9,fi*9+9));}
  });
  check('Selections are deduplicated; custom selection order is retained',()=>assert.deepEqual(uv.selectedIslands(g,[all[3],all[1],all[3],999]),[all[3],all[1]]));
  check('Cut boundary keeps BOTH sides of each source seam',()=>assert.equal(g.boundaries.length/2,edges.size*2));
  check('Shared source vertex splits into distinct UV coordinates across seams',()=>{
    const separate=uv.buildUnfoldGeometry(cube,uv.planarPackPreview(cube,uv.buildCharts(cube,edges)),edges);
    const vi=cube.faces[0].vertices[0],targets=new Set();cube.faces.forEach((f,fi)=>f.vertices.forEach((v,k)=>{if(v===vi)targets.add([...separate.target.slice(fi*9+k*3,fi*9+k*3+3)].join(','));}));assert.ok(targets.size>=3);
  });
  check('Staged transition is continuous at both phase boundaries',()=>{
    for(const t of [.2,.8]){const a=uv.writeUnfoldPositions(g,{...opts,progress:t-1e-7});const b=uv.writeUnfoldPositions(g,{...opts,progress:t+1e-7});a.forEach((v,i)=>near(v,b[i],1e-5));}
  });
  check('NaN/invalid settings cannot poison the GPU buffers',()=>{
    assert.throws(()=>uv.writeUnfoldPositions(g,{...opts,progress:NaN}));assert.throws(()=>uv.writeUnfoldPositions(g,{...opts,separation:-1}));assert.throws(()=>uv.writeUnfoldPositions(g,opts,g.source));assert.throws(()=>uv.writeUnfoldPositions(g,opts,new Float32Array(1)));
  });
  check('Incomplete, duplicate and malformed atlas coverage fails loudly',()=>{
    assert.throws(()=>uv.buildUnfoldGeometry(cube,packed.slice(1)));
    assert.throws(()=>uv.buildUnfoldGeometry(cube,[...packed,packed[0]]));
    const bad=structuredClone(packed);bad[0].faceUVs.values().next().value[0][0]=NaN;assert.throws(()=>uv.buildUnfoldGeometry(cube,bad));
  });
  check('Original UV target rejects missing UVs instead of silently inventing them',()=>{
    const m=structuredClone(cube);delete m.faces[0].uvs;assert.throws(()=>uv.sourceUVPreview(m,uv.buildCharts(m,edges)));
  });
  check('UV units, mirrors, overlaps and out-of-tile coordinates are preserved',()=>{
    const m=structuredClone(cube);m.faces.forEach(f=>{f.uvs=f.uvs.map(([u,v])=>[-u*3+2,v*4-1]);});
    const {packed:p,geometry:d}=make(m,true);assert.ok(d.atlas.min[1]<=-1&&d.atlas.max[1]>1);
    for(const c of p)for(const [fi,q]of c.faceUVs)assert.deepEqual(q,m.faces[fi].uvs);
    assert.deepEqual(uv.writeUnfoldPositions(d,{...opts,selected:d.islands.map(i=>i.id),progress:1}),d.target);
  });
  check('Exported OBJ contains the SAME UVs as the animation endpoint',()=>{
    const exported=uv.meshWithPreviewUV(cube,packed),round=core.parseOBJ(core.meshToOBJ(exported));
    for(let fi=0;fi<cube.faces.length;fi++)for(let k=0;k<3;k++)for(let a=0;a<2;a++)near(round.faces[fi].uvs[k][a],exported.faces[fi].uvs[k][a],1e-5);
    assert.deepEqual(exported.positions,cube.positions);
  });
  for(const id of core.COMPLEX_EXAMPLES.map(x=>x.id)){
    check(`${id}: generated target covers complex mesh with finite animated positions`,()=>{
      // Use a bounded seam subset: important that one island can contain MANY faces.
      const m=core.makeComplexExample(id,'low'),e=seams.extractSeamEdgesFromUV(m),p=uv.planarPackPreview(m,uv.buildCharts(m,e));
      const d=uv.buildUnfoldGeometry(m,p,e),out=uv.writeUnfoldPositions(d,{...opts,selected:d.islands.map(i=>i.id),progress:.57});
      assert.equal(out.length,m.faces.length*9);assert.ok(out.every(Number.isFinite));
      assert.deepEqual(uv.writeUnfoldPositions(d,{...opts,selected:d.islands.map(i=>i.id),progress:1}),d.target);
    });
  }
  check('Palette is deterministic and valid for 2D and GPU',()=>{for(let id=0;id<100;id++){assert.deepEqual(uv.islandColor(id),uv.islandColor(id));assert.ok(uv.islandColor(id).every(x=>x>=0&&x<=1));}});
  report.passed=report.cases.length;
  const index=process.argv.indexOf('--report');if(index!==-1)await writeFile(process.argv[index+1],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await compiled.cleanup();}
