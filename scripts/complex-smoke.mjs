/** Actual dependency-light core tests. This does NOT load Three.js or render Studio. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {compileCore} from './lib/compiled-core.mjs';
const compiled=await compileCore();
const report={suite:'Complex mesh, import normalization, asset download and FBX fixture STRUCTURE regression',node:process.version,cases:[],meshes:[]};
const check=async(name,fn)=>{const start=performance.now();await fn();report.cases.push({name,passed:true,elapsedMs:Math.round((performance.now()-start)*100)/100});};
try{
  const core=await compiled.load('packages/mesh-core/src/index.js'),runtime=await compiled.load('packages/runtime/src/index.js'),chaining=await compiled.load('packages/chaining-seams/src/index.js'),uv=await compiled.load('packages/uv/src/index.js');
  const part=()=>({name:'split quad',positions:[[0,0,0],[1,0,0],[0,1,0],[1,0,0],[1,1,0],[0,1,0]],faces:[{vertices:[0,1,2],uvs:[[0,0],[1,0],[0,1]]},{vertices:[3,4,5],uvs:[[0,0],[1,0],[1,1]]}]});
  await check('Exact welding restores quad adjacency while retaining a UV seam',()=>{const {mesh,report}=core.assembleMeshParts([part()],'quad');assert.equal(mesh.positions.length,4);assert.equal(report.weldedVertices,2);assert.equal(core.buildTopology(mesh).boundaryEdges.size,4);assert.equal(chaining.extractSeamEdgesFromUV(mesh).size,1);});
  await check('Object welding scopes are isolated',()=>{const {mesh}=core.assembleMeshParts([part(),part()],'two parts');assert.equal(mesh.positions.length,8);assert.equal(core.buildTopology(mesh).boundaryEdges.size,8);});
  await check('No-weld option keeps intentional coincident geometry separate',()=>assert.equal(core.assembleMeshParts([part()],'off',{weld:'off'}).mesh.positions.length,6));
  await check('Tolerance mode checks adjacent spatial cells',()=>{const p=part();p.positions[3][0]=1-1e-8;const result=core.assembleMeshParts([p],'tol',{weld:'tolerance',relativeTolerance:1e-6});assert.equal(result.mesh.positions.length,4);});
  await check('Invalid positions, indices, UVs and limits are rejected',()=>{
    for(const bad of [NaN,Infinity]){const p=part();p.positions[0][0]=bad;assert.throws(()=>core.assembleMeshParts([p],'bad'),/non-finite/);}
    const p=part();p.faces[0].vertices[0]=99;assert.throws(()=>core.assembleMeshParts([p],'bad'),/missing vertex/);
    const q=part();q.faces[0].uvs[0][0]=NaN;assert.throws(()=>core.assembleMeshParts([q],'bad'),/UV/);
    assert.throws(()=>core.assembleMeshParts([part()],'large',{maxTriangles:1}),/limit/);
  });
  await check('Collapsed faces are dropped with an explicit report',()=>{const p=part();p.faces.push({vertices:[0,0,1]});const result=core.assembleMeshParts([p],'degenerate');assert.equal(result.report.droppedDegenerate,1);assert.equal(result.mesh.faces.length,2);});
  for(const item of core.COMPLEX_EXAMPLES){
    for(const detail of ['low','medium','high']){
      const mesh=core.makeComplexExample(item.id,detail),topology=core.buildTopology(mesh);
      await check(`${item.id}/${detail}: finite, nondegenerate, edge-manifold geometry and valid UVs`,()=>{
        assert.ok(mesh.faces.length>=1000);assert.ok(mesh.positions.every(p=>p.every(Number.isFinite)));
        for(const f of mesh.faces){assert.equal(new Set(f.vertices).size,3);assert.ok(f.vertices.every(v=>v>=0&&v<mesh.positions.length));assert.ok(core.triangleArea(...f.vertices.map(v=>mesh.positions[v]))>0);assert.ok(f.uvs.every(uv=>uv.every(Number.isFinite)));}
        assert.ok([...topology.edges.values()].every(e=>e.faces.length<=2));
        assert.equal(topology.boundaryEdges.size,item.id==='garment'?2*(detail==='low'?48:detail==='medium'?96:192):0);
      });
      if(detail==='medium'){
        await check(`${item.id}: full real-edge baseline/traversal/UV pipeline`,()=>{
          const start=performance.now(),generated=runtime.generateGeometricSeams(mesh,{strategy:'legacy',maxEdges:750}),fs=runtime.buildGenerationFrames(mesh,generated.chains);
          assert.equal(fs.at(-1).token,chaining.EOS);assert.ok(generated.seamEdges.size<=750);
          for(const frame of fs)if(frame.token>=0)assert.ok(frame.mask.vertices.includes(frame.token));
          assert.deepEqual(new Set(fs.at(-1).revealedEdges),generated.seamEdges);
          for(const frame of fs.filter((_,i)=>i%100===0))for(const edge of frame.revealedEdges)assert.ok(topology.edges.has(edge));
          // Lazy accessors must not retain an array copy of every prefix.
          assert.ok(fs.every(frame=>typeof Object.getOwnPropertyDescriptor(frame,'revealedEdges').get==='function'));
          const charts=uv.buildCharts(mesh,generated.seamEdges);assert.equal(charts.reduce((n,c)=>n+c.faces.length,0),mesh.faces.length);
          const preview=uv.planarPackPreview(mesh,charts);assert.equal(preview.reduce((n,p)=>n+p.faceUVs.size,0),mesh.faces.length);
          report.meshes.push({id:item.id,vertices:mesh.positions.length,triangles:mesh.faces.length,seamEdges:generated.seamEdges.size,steps:fs.length,charts:charts.length,pipelineMs:Math.round(performance.now()-start)});
        });
        await check(`${item.id}: OBJ export/import preserves actual UV seams`,()=>{
          const recovered=core.parseOBJ(core.meshToOBJ(mesh));assert.equal(recovered.faces.length,mesh.faces.length);assert.deepEqual(chaining.extractSeamEdgesFromUV(recovered),chaining.extractSeamEdgesFromUV(mesh));
        });
      }
    }
  }
  await check('Lazy frame snapshots do not change after other frames are read or mutated',()=>{const mesh=core.makeCube(),g=runtime.generateGeometricSeams(mesh),frames=runtime.buildGenerationFrames(mesh,g.chains),before=frames[1].revealedEdges;frames.at(-1).revealedEdges.push('bad');assert.deepEqual(frames[1].revealedEdges,before);assert.ok(!frames.at(-1).revealedEdges.includes('bad'));});
  const cube=core.parseOBJ(await readFile(join(compiled.root,'examples/cube_uv.obj'),'utf8'));
  await check('OBJ roundtrip keeps explicitly overlapping but disconnected UV indices',()=>assert.deepEqual(chaining.extractSeamEdgesFromUV(core.parseOBJ(core.meshToOBJ(cube))),chaining.extractSeamEdgesFromUV(cube)));
  const document={asset:{version:'2.0'},buffers:[{uri:'mesh.bin',byteLength:12}],meshes:[{primitives:[{attributes:{POSITION:0},material:0}]}],materials:[{normalTexture:{index:0}}],textures:[{source:0}],images:[{uri:'missing.png'}],extensionsUsed:['KHR_materials_transmission'],nodes:[{translation:[1,2,3]}]};
  await check('Geometry-only glTF strips texture dependencies without changing geometry or transforms',()=>{const stripped=core.geometryOnlyGLTF(document);assert.ok(!stripped.images);assert.ok(!stripped.meshes[0].primitives[0].material);assert.deepEqual(stripped.nodes,document.nodes);assert.ok(document.images);});
  await check('GLB encode/decode roundtrip and damaged header rejection',()=>{const doc=core.geometryOnlyGLTF(document);delete doc.buffers[0].uri;const data=core.writeGLB(doc,new Uint8Array(12)),parsed=core.readGLB(data);assert.deepEqual(parsed.document,doc);assert.equal(parsed.binary.length,12);const corrupt=data.slice(0);new DataView(corrupt).setUint32(8,0,true);assert.throws(()=>core.readGLB(corrupt),/length/);});
  const asset={id:'test',name:'Test',url:'https://example.test/models/mesh.gltf',source:'https://example.test/',license:'CC0-1.0',credit:'test'};
  await check('Downloader uses ONLY metadata and geometry; zero texture fetches (mock transport)',async()=>{
    const calls=[];const result=await core.downloadGeometryAsset(asset,{fetcher:async(url)=>{calls.push(url);return new Response(url.endsWith('.gltf')?JSON.stringify(document):new Uint8Array(12));}});
    assert.deepEqual(calls,['https://example.test/models/mesh.gltf','https://example.test/models/mesh.bin']);assert.equal(core.readGLB(result.data).binary.length,12);
  });
  await check('Downloader rejects HTTP errors, external resource redirects in metadata and truncated bins',async()=>{
    await assert.rejects(()=>core.downloadGeometryAsset(asset,{fetcher:async()=>new Response('',{status:404})}),/404/);
    const external=structuredClone(document);external.buffers[0].uri='https://other.test/x.bin';await assert.rejects(()=>core.downloadGeometryAsset(asset,{fetcher:async()=>new Response(JSON.stringify(external))}),/Unexpected external/);
    await assert.rejects(()=>core.downloadGeometryAsset(asset,{fetcher:async(url)=>new Response(url.endsWith('.gltf')?JSON.stringify(document):new Uint8Array(3))}),/length mismatch/);
  });
  const manifest=JSON.parse(await readFile(join(compiled.root,'examples/manifest.json'),'utf8'));
  for(const entry of [...manifest.meshes,...manifest.fbxFixtures])await check(`${entry.file}: distributed bytes match SHA256`,async()=>assert.equal(createHash('sha256').update(await readFile(join(compiled.root,entry.file))).digest('hex'),entry.sha256));
  await check('ASCII FBX fixture contains real geometry and ByPolygonVertex UV0',async()=>{const text=await readFile(join(compiled.root,'apps/studio/public/assets/fixtures/garment-ascii.fbx'),'utf8');assert.match(text,/FBXVersion: 7400/);assert.match(text,/ByPolygonVertex/);assert.match(text,/PolygonVertexIndex: \*9216/);});
  await check('Binary FBX fixture: valid 7.4 node offsets and compressed geometry arrays (not a loader integration)',async()=>{
    const data=await readFile(join(compiled.root,'apps/studio/public/assets/fixtures/garment-binary.fbx'));assert.equal(data.subarray(0,23).toString('binary'),'Kaydara FBX Binary  \0\x1a\0');assert.equal(data.readUInt32LE(23),7400);
    let arrays=0;const nodes=[];
    function node(start){const end=data.readUInt32LE(start);if(!end)return start+13;assert.ok(end>start&&end<=data.length);const props=data.readUInt32LE(start+4),propBytes=data.readUInt32LE(start+8),nameLen=data[start+12],name=data.subarray(start+13,start+13+nameLen).toString();nodes.push(name);let offset=start+13+nameLen;const propEnd=offset+propBytes;
      for(let i=0;i<props;i++){const type=String.fromCharCode(data[offset++]);if(type==='S'){const n=data.readUInt32LE(offset);offset+=4+n;}else if(type==='d'||type==='i'){const count=data.readUInt32LE(offset),encoding=data.readUInt32LE(offset+4),bytes=data.readUInt32LE(offset+8);offset+=12;assert.equal(encoding,1);const raw=inflateSync(data.subarray(offset,offset+bytes));assert.equal(raw.length,count*(type==='d'?8:4));arrays++;offset+=bytes;}else offset+=type==='D'||type==='L'?8:type==='C'?1:4;}
      assert.equal(offset,propEnd);while(offset<end){const next=node(offset);assert.ok(next>offset&&next<=end);offset=next;}assert.equal(offset,end);return end;}
    let offset=27;while(data.readUInt32LE(offset)!==0)offset=node(offset);assert.equal(arrays,3);assert.ok(nodes.includes('Geometry')&&nodes.includes('Model')&&nodes.includes('Connections'));
  });
  report.passed=report.cases.length;
  report.limitations=['No Three.js/FBXLoader execution in this suite','No live network requests in mocked downloader cases','No React/Vite or GPU rendering in this suite'];
  const at=process.argv.indexOf('--report');if(at>=0)await writeFile(process.argv[at+1],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await compiled.cleanup();}
