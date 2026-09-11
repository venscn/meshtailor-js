import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTopology, makeCube, makeCylinder, makeTorsoGrid, makeComplexExample, meshToOBJ,
  COMPLEX_EXAMPLES, REMOTE_MESH_ASSETS, downloadGeometryAsset,
  type ComplexExampleId, type MeshData, type MeshDetail, type MeshImportReport, type RemoteMeshAsset,
} from '@meshtailor/mesh-core';
import type { SeamChain } from '@meshtailor/chaining-seams';
import { buildGenerationFrames, type GenerationFrame } from '@meshtailor/runtime';
import { MESH_TAILOR_V2_SPEC } from '@meshtailor/model';
import { MeshViewport } from './MeshViewport';
import { UVCanvas } from './UVCanvas';
import { importMeshFiles, type SceneImportOptions } from './importers';
import type { SeamJob, SeamResult } from './workers/seam.worker';
import { prepareViewportMesh } from './viewport-math';
import './styles.css';

function describeMesh(mesh:MeshData){
  const t=buildTopology(mesh);
  return {vertices:mesh.positions.length,triangles:mesh.faces.length,edges:t.edges.size,boundary:t.boundaryEdges.size,manifold:[...t.edges.values()].every(e=>e.faces.length<=2)};
}
function saveFile(name:string,data:BlobPart,type:string){
  const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');
  a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export default function App(){
  const [mesh,setMesh]=useState<MeshData>(()=>makeTorsoGrid());
  const [loadError,setLoadError]=useState<string|null>(null),[importReport,setImportReport]=useState<MeshImportReport|null>(null);
  const [seamEdges,setSeamEdges]=useState<Set<string>>(new Set()),[chains,setChains]=useState<SeamChain[]>([]),[frames,setFrames]=useState<GenerationFrame[]>([]),[step,setStep]=useState(-1);
  const [wireframe,setWireframe]=useState(false),[xray,setXray]=useState(true),[showAllSeams,setShowAllSeams]=useState(false),[cameraResetKey,setCameraResetKey]=useState(0);
  const [curvature,setCurvature]=useState(.82),[rings,setRings]=useState(2),[maxEdges,setMaxEdges]=useState(1500),[playing,setPlaying]=useState(false);
  const [detail,setDetail]=useState<MeshDetail>('medium'),[exampleId,setExampleId]=useState<ComplexExampleId>('garment');
  const [weld,setWeld]=useState<SceneImportOptions['weld']>('exact'),[tolerance,setTolerance]=useState(1e-7);
  const [busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState('Ready. Choose an offline mesh or import OBJ / FBX / GLB / GLTF.');
  const [liveUV,setLiveUV]=useState(false),[chartCount,setChartCount]=useState<number|null>(null);
  const operation=useRef(0),seamWorker=useRef<Worker|null>(null),abortDownload=useRef<AbortController|null>(null);
  const frame=step>=0?frames[step]:undefined;
  const activeEdges=useMemo(()=>showAllSeams?seamEdges:frame?new Set(frame.revealedEdges):seamEdges,[frame,seamEdges,showAllSeams]);
  const stats=useMemo(()=>describeMesh(mesh),[mesh]);
  const uvEdges=mesh.faces.length>20_000&&!liveUV?seamEdges:activeEdges;
  const timelineStart=Math.max(0,Math.min(Math.max(0,frames.length-100),step-35));
  const timelineFrames=frames.slice(timelineStart,timelineStart+100);

  useEffect(()=>()=>{operation.current++;seamWorker.current?.terminate();abortDownload.current?.abort();},[]);
  useEffect(()=>{
    if(!playing||!frames.length)return;
    if(step>=frames.length-1){setPlaying(false);return;}
    const timer=setTimeout(()=>setStep(s=>Math.min(frames.length-1,s+1)),420);return()=>clearTimeout(timer);
  },[playing,step,frames.length]);
  const cancel=()=>{operation.current++;seamWorker.current?.terminate();seamWorker.current=null;abortDownload.current?.abort();abortDownload.current=null;setBusy(null);setPlaying(false);};
  const begin=(message:string)=>{cancel();setLoadError(null);setBusy(message);return operation.current;};
  const replaceMesh=(m:MeshData,report:MeshImportReport|null=null)=>{
    prepareViewportMesh(m); // Reject malformed input before React/topology/Three see it.
    setMesh(m);setImportReport(report);setSeamEdges(new Set());setChains([]);setFrames([]);setShowAllSeams(false);setStep(-1);setPlaying(false);setNotice(`Loaded ${m.name}: ${m.faces.length.toLocaleString()} triangles.`);
  };
  const resetForMesh=(m:MeshData)=>{cancel();setLoadError(null);try{replaceMesh(m);}catch(error){setLoadError(String(error));}};
  const loadFiles=async(files:File[])=>{
    const id=begin('Importing mesh…');
    try{const result=await importMeshFiles(files,{weld,relativeTolerance:tolerance});if(id!==operation.current)return;replaceMesh(result.mesh,result.report);}
    catch(error){if(id===operation.current)setLoadError(error instanceof Error?error.message:String(error));}
    finally{if(id===operation.current)setBusy(null);}
  };
  const loadRemote=async(asset:RemoteMeshAsset)=>{
    const id=begin(`Loading ${asset.name}…`),controller=new AbortController();abortDownload.current=controller;
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(120_000)]);
    try{
      let data:ArrayBuffer;
      // A successful assets:download creates geometry-only files in public/assets/remote.
      const local=await fetch(`${import.meta.env.BASE_URL}assets/remote/${asset.id}.glb`,{signal});
      if(local.ok&&!local.headers.get('content-type')?.includes('text/html'))data=await local.arrayBuffer();
      else data=(await downloadGeometryAsset(asset,{signal,onProgress:message=>{if(id===operation.current)setBusy(message);}})).data;
      if(id!==operation.current)return;
      const result=await importMeshFiles([new File([data],asset.id+'.glb')],{weld,relativeTolerance:tolerance});
      if(id!==operation.current)return;
      result.report.warnings.push(`${asset.name} — ${asset.license}; ${asset.credit}. Geometry-only import, not a textured asset viewer.`);
      replaceMesh(result.mesh,result.report);
    }catch(error){if(id===operation.current)setLoadError(`Example load failed: ${error instanceof Error?error.message:String(error)}. Offline procedural meshes remain available; the README documents assets:download.`);}
    finally{if(id===operation.current){setBusy(null);abortDownload.current=null;}}
  };
  const loadFBXExample=async(kind:'ascii'|'binary')=>{
    const id=begin('Loading bundled FBX example…');
    try{const fileName=`garment-${kind}.fbx`,response=await fetch(`${import.meta.env.BASE_URL}assets/fixtures/${fileName}`);if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.arrayBuffer();if(id!==operation.current)return;
      const result=await importMeshFiles([new File([data],fileName)],{weld,relativeTolerance:tolerance});if(id!==operation.current)return;replaceMesh(result.mesh,result.report);
    }catch(error){if(id===operation.current)setLoadError(error instanceof Error?error.message:String(error));}
    finally{if(id===operation.current)setBusy(null);}
  };
  const runSeams=(kind:SeamJob['kind'])=>{
    const id=begin(kind==='baseline'?'Generating baseline…':'Extracting UV seams…');
    try{
      const worker=new Worker(new URL('./workers/seam.worker.ts',import.meta.url),{type:'module'});seamWorker.current=worker;
      worker.onmessage=(event:MessageEvent<SeamResult>)=>{
        worker.terminate();if(id!==operation.current)return;seamWorker.current=null;setBusy(null);
        const result=event.data;if(!result.ok){setLoadError(result.error);return;}
        try{
          const edges=new Set(result.edges),fs=buildGenerationFrames(mesh,result.chains);
          setSeamEdges(edges);setChains(result.chains);setFrames(fs);setShowAllSeams(false);setStep(fs.length?0:-1);setPlaying(false);
          setNotice(`${kind==='baseline'?'Geometric baseline':'UV seams'}: ${edges.size} edges, ${result.chains.length} chains, ${fs.length} steps; worker ${result.elapsedMs.toFixed(0)} ms.${kind==='baseline'?` Budget: ${maxEdges} edges.`:''}`);
          if(!edges.size)setNotice('No seam edges found. Adjust baseline settings or use a mesh with existing UV discontinuities.');
        }catch(error){setLoadError(String(error));}
      };
      worker.onerror=event=>{worker.terminate();if(id===operation.current){setBusy(null);setLoadError('Seam worker failed: '+event.message);}};
      worker.postMessage({kind,mesh,options:{curvatureQuantile:curvature,structuralRings:rings,maxEdges}} satisfies SeamJob);
    }catch(error){setBusy(null);setLoadError(String(error));}
  };
  const seek=(next:number)=>{setPlaying(false);setStep(Math.max(0,Math.min(frames.length-1,next)));};
  const togglePlayback=()=>{if(!frames.length)return;if(!playing&&step>=frames.length-1)setStep(0);setPlaying(!playing);};

  return <div className="app-shell" onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files.length)void loadFiles(Array.from(e.dataTransfer.files));}}>
    <header className="topbar"><div><div className="brand">MeshTailor-JS <span>Studio · 0.2.0</span></div><div className="subtitle">复杂网格 · FBX import · mesh-native traversal debugger</div></div><div className="paper-pill">d={MESH_TAILOR_V2_SPEC.modelDimension} · {MESH_TAILOR_V2_SPEC.decoderLayers} decoder layers</div></header>
    <main className="workspace">
      <aside className="sidebar">
        <section><h3>Mesh · 网格</h3><div className="button-grid"><button onClick={()=>resetForMesh(makeCube())}>Cube</button><button onClick={()=>resetForMesh(makeCylinder(20))}>Cylinder</button><button onClick={()=>resetForMesh(makeTorsoGrid())}>Torso</button></div>
          <label className="file-label">Load OBJ / FBX / GLB / GLTF<input type="file" multiple accept=".obj,.fbx,.glb,.gltf,.bin" onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length)void loadFiles(files);e.target.value='';}}/></label>
          <small>可拖入文件。glTF 与配套 .bin 请一起选择。只导入网格，不显示材质贴图。</small>
          <details><summary>导入选项 / Import settings</summary>
            <label>位置焊接（FBX / glTF）<select aria-label="Weld mode" value={weld} onChange={e=>setWeld(e.target.value as SceneImportOptions['weld'])}><option value="exact">Exact · 精确同坐标（默认）</option><option value="tolerance">Tolerance · 容差</option><option value="off">Off · 保留渲染顶点索引</option></select></label>
            {weld==='tolerance'&&<label>相对包围盒容差<input aria-label="Weld tolerance" type="number" min="1e-12" max="0.001" step="0.0000001" value={tolerance} onChange={e=>{const v=+e.target.value;if(v>0&&v<=.001)setTolerance(v);}}/></label>}
            <small>不跨对象焊接；同一对象内重合但独立的表面可能被连接。UV 保存在面角，不随位置焊接丢失。设置在下次导入生效。</small>
          </details>
        </section>
        <section><h3>复杂样例 · Offline</h3>
          <label>模型<select aria-label="Complex mesh" value={exampleId} onChange={e=>setExampleId(e.target.value as ComplexExampleId)}>{COMPLEX_EXAMPLES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          <label>密度<select aria-label="Mesh detail" value={detail} onChange={e=>setDetail(e.target.value as MeshDetail)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <small>{COMPLEX_EXAMPLES.find(m=>m.id===exampleId)?.description}</small>
          <button onClick={()=>resetForMesh(makeComplexExample(exampleId,detail))}>Load complex mesh</button>
          <div className="button-grid two"><button disabled={!!busy} onClick={()=>void loadFBXExample('ascii')}>FBX ASCII</button><button disabled={!!busy} onClick={()=>void loadFBXExample('binary')}>FBX Binary</button></div>
          <button onClick={()=>saveFile('meshtailor-mesh.obj',meshToOBJ(mesh),'text/plain')}>Export current OBJ + UV</button>
        </section>
        <section><h3>公开模型 · Online</h3><small>CC0；优先使用已下载的本地副本，否则从原站获取几何和 UV，不下载贴图。</small>
          {REMOTE_MESH_ASSETS.map(asset=><div className="asset-card" key={asset.id}><button disabled={!!busy} onClick={()=>void loadRemote(asset)}>{asset.name}</button><small>{asset.description} <a href={asset.source} target="_blank" rel="noreferrer">来源 / 许可</a></small></div>)}
        </section>
        <section><h3>Seam source</h3><button className="primary" disabled={!!busy} onClick={()=>runSeams('baseline')}>Generate baseline</button><button disabled={!!busy} onClick={()=>runSeams('uv-seams')}>Extract existing UV seams</button>
          <label>Curvature quantile <b>{curvature.toFixed(2)}</b><input type="range" min="0.55" max="0.98" step="0.01" value={curvature} onChange={e=>setCurvature(+e.target.value)}/></label>
          <label>Structural cross-sections <b>{rings}</b><input type="range" min="0" max="5" step="1" value={rings} onChange={e=>setRings(+e.target.value)}/></label>
          <label>Baseline edge budget <input aria-label="Edge budget" type="number" min="50" max="20000" step="50" value={maxEdges} onChange={e=>{const n=Math.floor(+e.target.value);if(n>=50&&n<=20000)setMaxEdges(n);}}/></label><small>预算仅限制几何 baseline，不抽稀输入网格，不截断已有 UV 接缝。</small>
        </section>
        <section><h3>Display</h3><button onClick={()=>setCameraResetKey(n=>n+1)}>Reset camera</button>
          <label className="check"><input type="checkbox" checked={wireframe} onChange={e=>setWireframe(e.target.checked)}/> wireframe</label>
          <label className="check"><input type="checkbox" checked={xray} onChange={e=>setXray(e.target.checked)}/> X-ray traversal</label>
          <label className="check"><input type="checkbox" checked={showAllSeams} onChange={e=>setShowAllSeams(e.target.checked)}/> Show all seams</label>
          <label className="check"><input type="checkbox" checked={liveUV} onChange={e=>setLiveUV(e.target.checked)}/> 大网格也逐步更新 UV</label>
          <small>超过 2 万面默认按完整接缝计算 UV，避免播放时反复计算；勾选后按当前步骤更新。</small>
          <div className="legend"><span><i className="dot seam"/>seam</span><span><i className="dot candidate"/>candidates</span><span><i className="dot current"/>current</span><span><i className="dot previous"/>previous</span></div>
        </section>
        <section className="stats"><h3>Topology</h3><dl><dt>Vertices</dt><dd>{stats.vertices.toLocaleString()}</dd><dt>Triangles</dt><dd>{stats.triangles.toLocaleString()}</dd><dt>Edges</dt><dd>{stats.edges.toLocaleString()}</dd><dt>Boundary</dt><dd>{stats.boundary.toLocaleString()}</dd><dt>Manifold*</dt><dd>{stats.manifold?'yes':'no'}</dd><dt>UV charts</dt><dd>{chartCount??'…'}</dd></dl><small>* edge-manifold check, not a repair guarantee</small></section>
        {importReport&&<section className="import-report"><h3>Import report</h3><p>{importReport.parts} parts · {importReport.sourceVertices.toLocaleString()} source vertices → {importReport.vertices.toLocaleString()} topology vertices</p><p>{importReport.weldedVertices.toLocaleString()} welded · {importReport.uvFaces.toLocaleString()} faces with UV</p><details><summary>导入说明 / Warnings</summary>{importReport.warnings.map((w,i)=><p key={i}>{w}</p>)}</details></section>}
      </aside>
      <section className="center">
        <div className="panel scene-panel"><div className="panel-title"><span>3D traversal</span><span>{mesh.name} · {activeEdges.size}/{seamEdges.size} seams</span></div><MeshViewport mesh={mesh} seamEdges={activeEdges} frame={frame} wireframe={wireframe} xray={xray} cameraResetKey={cameraResetKey}/></div>
        <div className="debugbar"><button aria-label="First step" onClick={()=>seek(0)} disabled={!frames.length}>⏮</button><button aria-label="Previous step" onClick={()=>seek(step-1)} disabled={!frames.length}>◀</button><button className="primary" onClick={togglePlayback} disabled={!frames.length||!!busy}>{playing?'Pause':'Play'}</button><button aria-label="Next step" onClick={()=>seek(step+1)} disabled={!frames.length}>▶</button><button aria-label="Last step" onClick={()=>seek(frames.length-1)} disabled={!frames.length}>⏭</button><input aria-label="Traversal step" type="range" min="0" max={Math.max(0,frames.length-1)} value={Math.max(0,step)} onChange={e=>seek(+e.target.value)} disabled={!frames.length}/><span className="step-label">{frames.length?`${step+1}/${frames.length}`:'0/0'}</span></div>
        <div className="notice">{loadError?<span role="alert">{loadError}</span>:busy?<span role="status">{busy} <button onClick={()=>{cancel();setNotice('Operation cancelled.');}}>Cancel</button></span>:frame?<><b>{frame.tokenLabel}</b> · {frame.message} · candidates {frame.mask.vertices.length}{frame.mask.allowEOC?' + EOC':''}{frame.mask.allowEOS?' + EOS':''}</>:notice}</div>
        {frames.length>0&&<div className="operation-summary">{notice}</div>}
      </section>
      <aside className="rightbar">
        <div className="panel uv-panel"><div className="panel-title"><span>UV charts</span><span>{uvEdges===seamEdges&&mesh.faces.length>20_000&&!liveUV?'full seams':'current step'}</span></div><UVCanvas mesh={mesh} seamEdges={uvEdges} onChartCount={setChartCount}/></div>
        <div className="panel timeline"><div className="panel-title"><span>Decode timeline</span><span>{chains.length} chains</span></div>{frames.length>100&&<small className="timeline-window">Showing {timelineStart+1}–{timelineStart+timelineFrames.length} of {frames.length}. Use slider to seek.</small>}<div className="timeline-scroll">{frames.length?timelineFrames.map((f,j)=>{const i=j+timelineStart;return <button key={i} className={i===step?'active':''} onClick={()=>seek(i)}><span>{String(i+1).padStart(3,'0')}</span><b>{f.tokenLabel}</b><em>{f.message}</em></button>;}):<p className="empty">Generate seams to inspect mesh-native pointer traversal.</p>}</div></div>
      </aside>
    </main>
    <footer>Research reproduction scaffold. Complex meshes do not imply a trained MeshTailor model. Baseline is geometric; UV is a planar debug preview.</footer>
  </div>;
}
