import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildTopology, makeCube, makeCylinder, makeTorsoGrid, makeComplexExample, meshToOBJ,
  COMPLEX_EXAMPLES, REMOTE_MESH_ASSETS, downloadGeometryAsset,
  type ComplexExampleId, type MeshData, type MeshDetail, type MeshImportReport, type RemoteMeshAsset,
} from '@meshtailor/mesh-core';
import type { SeamChain } from '@meshtailor/chaining-seams';
import { buildGenerationFrames, type GenerationFrame } from '@meshtailor/runtime';
import { MeshViewport } from './MeshViewport';
import { UVCanvas } from './UVCanvas';
import { importMeshFiles, type SceneImportOptions } from './importers';
import type { SeamJob, SeamResult } from './workers/seam.worker';
import { prepareViewportMesh } from './viewport-math';
import { meshWithPreviewUV, recommendUnwrap, DEFAULT_UNWRAP, type UnwrapOptions, type PackedChart } from '@meshtailor/uv';
import { makeUnfoldDemo, makeHingeDemo, makeFragmentationDemo } from './unfold/demo';
import { useUVSnapshot } from './unfold/useUVSnapshot';
import { useUnfoldPlayer } from './unfold/useUnfoldPlayer';
import { UVSolverControls } from './unfold/UVSolverControls';
import { UVJobStatus } from './unfold/UVJobStatus';
import { describeUVProgress } from './unfold/uv-job-client';
import { UnfoldControls, UnfoldTransport } from './unfold/UnfoldControls';
import { UnfoldViewport } from './unfold/UnfoldViewport';
import { CorrespondenceInspector } from './unfold/CorrespondenceInspector';
import type { UVTarget } from './workers/uv.worker';
import './styles.css';
import { previewEdges, seamTarget } from './unfold/preview-policy';

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
  const [weld,setWeld]=useState<SceneImportOptions['weld']>('boundary'),[tolerance,setTolerance]=useState(5e-7);
  const [busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState('Ready. Choose an offline mesh or import OBJ / FBX / GLB / GLTF.');
  const [liveUV,setLiveUV]=useState(false);
  const [toolTab,setToolTab]=useState<'mesh'|'uv'|'animation'>('mesh');
  const importInput=useRef<HTMLInputElement>(null);
  const [viewMode,setViewMode]=useState<'traversal'|'unfold'>('traversal'),[uvTarget,setUVTarget]=useState<UVTarget>('generated');
  const operation=useRef(0),seamWorker=useRef<Worker|null>(null),abortDownload=useRef<AbortController|null>(null);
  const frame=step>=0?frames[step]:undefined;
  const activeEdges=useMemo(()=>showAllSeams?seamEdges:frame?new Set(frame.revealedEdges):seamEdges,[frame,seamEdges,showAllSeams]);
  const stats=useMemo(()=>describeMesh(mesh),[mesh]);
  const uvEdges=liveUV?activeEdges:seamEdges;
  // Unfolding always freezes the COMPLETE seam set. Traversal progress must not repack its target mid-animation.
  const snapshotTarget = uvTarget;
  const snapshotEdges = previewEdges(snapshotTarget,seamEdges,activeEdges,viewMode==='traversal'&&liveUV);
  const [uvSeed,setUVSeed]=useState<PackedChart[]|undefined>();
  const [uvConfig,setUVConfig]=useState<UnwrapOptions>(()=>recommendUnwrap(mesh).options);
  const uvState = useUVSnapshot(mesh,snapshotEdges,snapshotTarget,uvConfig,uvSeed);
  const snapshot = uvState.snapshot;
  const displaySeams=useMemo(()=>new Set((snapshotTarget!=='generated'||!!snapshot?.merge)?(snapshot?.seams??[]):[...activeEdges,...(snapshot?.addedSeams??[])]),[activeEdges,snapshot,snapshotTarget]);
  const player = useUnfoldPlayer(snapshot);
  const chartCount = snapshot?.packed.length??null;
  const uvStatus=uvState.loading?describeUVProgress(uvState.progress,uvState.elapsedMs):uvState.error;
  const hasSourceUV=useMemo(()=>mesh.faces.every(f=>f.uvs?.length===3&&f.uvs.every(p=>p?.length===2&&p.every(Number.isFinite))),[mesh]);
  const uvAll = useMemo(()=>snapshot?.geometry.islands.map(c=>c.id)??[],[snapshot]);
  useEffect(()=>{if(viewMode==='unfold')setPlaying(false);else player.pause();},[viewMode]);
  const exportTargetUV=()=>{if(!snapshot)return;try{saveFile('meshtailor-target-uv.obj',meshToOBJ(meshWithPreviewUV(mesh,snapshot.packed)),'text/plain');}catch(error){setLoadError(String(error));}};
  const timelineStart=Math.max(0,Math.min(Math.max(0,frames.length-100),step-35));
  const timelineFrames=frames.slice(timelineStart,timelineStart+100);

  useEffect(()=>()=>{operation.current++;seamWorker.current?.terminate();abortDownload.current?.abort();},[]);
  useEffect(()=>{
    if(!playing||!frames.length)return;
    if(step>=frames.length-1){setPlaying(false);return;}
    const timer=setTimeout(()=>setStep(s=>Math.min(frames.length-1,s+1)),420);return()=>clearTimeout(timer);
  },[playing,step,frames.length]);
  const cancel=()=>{uvState.cancel();operation.current++;seamWorker.current?.terminate();seamWorker.current=null;abortDownload.current?.abort();abortDownload.current=null;setBusy(null);setPlaying(false);};
  const begin=(message:string)=>{cancel();setLoadError(null);setBusy(message);return operation.current;};
  const replaceMesh=(m:MeshData,report:MeshImportReport|null=null)=>{
    prepareViewportMesh(m); // Reject malformed input before React/topology/Three see it.
    setUVSeed(undefined);setMesh(m);setImportReport(report);setUVConfig(recommendUnwrap(m).options);setUVTarget('generated');setSeamEdges(new Set());setChains([]);setFrames([]);setShowAllSeams(false);setStep(-1);setPlaying(false);setNotice(`Loaded ${m.name}: ${m.faces.length.toLocaleString()} triangles.`);
  };
  const loadUnfoldDemo=()=>{cancel();setLoadError(null);try{const demo=makeUnfoldDemo();replaceMesh(demo.mesh);setSeamEdges(demo.edges);setChains(demo.chains);setFrames(demo.frames);setStep(demo.frames.length-1);setShowAllSeams(true);setUVTarget('generated');setViewMode('unfold');setToolTab('animation');setNotice('六岛立方体：拖动 0–100% 进度，观察同色编号的面片移入对应 UV 岛。');}catch(error){setLoadError(String(error));}};
  const loadHingeDemo=()=>{cancel();setLoadError(null);try{const demo=makeHingeDemo();replaceMesh(demo.mesh);setSeamEdges(demo.edges);setChains(demo.chains);setFrames(demo.frames);setStep(demo.frames.length-1);setShowAllSeams(true);setUVTarget('generated');setViewMode('unfold');player.setPath('hinge');setToolTab('animation');setNotice('三块折角带：点“分块陈列”，再缓慢拖动 28–70%，看各铰链真实转动。');}catch(error){setLoadError(String(error));}};
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
      const local=await fetch(`${import.meta.env.BASE_URL}assets/remote/${asset.id}-domains-v2.glb`,{signal});
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
    const id=begin(kind==='uv-seams'?'读取原始 UV（不再补切）…':'分析网格并生成连通分区…');
    try{
      const worker=new Worker(new URL('./workers/seam.worker.ts',import.meta.url),{type:'module'});seamWorker.current=worker;
      worker.onmessage=(event:MessageEvent<SeamResult>)=>{
        worker.terminate();if(id!==operation.current)return;seamWorker.current=null;setBusy(null);
        const result=event.data;if(!result.ok){setLoadError(result.error);return;}
        try{
          const edges=new Set(result.edges),fs=buildGenerationFrames(mesh,result.chains);
          setUVSeed(undefined);setUVTarget(seamTarget(kind));
          if(kind.startsWith('auto-')&&result.parameters)setUVConfig({...result.parameters,timeBudgetMs:uvConfig.timeBudgetMs,padding:uvConfig.padding});
          setSeamEdges(edges);setChains(result.chains);setFrames(fs);setShowAllSeams(false);setStep(fs.length?0:-1);setPlaying(false);
          setNotice(kind==='uv-seams'?`已读取原始 UV 接缝：${edges.size} 条边。显示和动画直接使用原 UV，不重新分割。`:`输入 ${result.analysis?.components??'?'} 个独立连通部件（不跨部件焊接）；${result.regionCount??'传统'} 个候选分区，合并 ${result.mergedCount??0} 个小区域；${edges.size} 条接缝。最终岛数由 UV 有效性检查决定。`);
          if(kind.startsWith('auto-'))setShowAllSeams(true);
          if(!edges.size&&kind!=='uv-seams')setNotice('候选区域无需分隔边；UV 求解按需开缝，仍保留所有面。');
        }catch(error){setLoadError(String(error));}
      };
      worker.onerror=event=>{worker.terminate();if(id===operation.current){setBusy(null);setLoadError('Seam worker failed: '+event.message);}};
      worker.postMessage({kind,mesh,options:{strategy:uvConfig.chartPolicy==='legacy'?'legacy':'adaptive',goal:uvConfig.chartPolicy==='balanced'?'balanced':'large',regionOptions:{...uvConfig.regionOptions,maxChartFaces:uvConfig.maxChartFaces},curvatureQuantile:curvature,structuralRings:rings,maxEdges}} satisfies SeamJob);
    }catch(error){setBusy(null);setLoadError(String(error));}
  };
  const processUV=(operation:'connected'|'stitch'|'repack',config:UnwrapOptions)=>{
    if(operation!=='connected'&&!snapshot)return;
    cancel();setLoadError(null);setViewMode('unfold');setShowAllSeams(true);setPlaying(false);
    if(operation==='connected'){
      setUVSeed(undefined);setUVConfig({...config,initialSegmentation:'connected',postMerge:true});setSeamEdges(new Set());setChains([]);setFrames([]);setStep(-1);setUVTarget('generated');
      setNotice('前处理：从连通块开始，仅在必要时补切，再执行验证式邻岛缝合。原 UV 保留在模型中；新 UV 需要重烘焙。');
    }else{
      setUVSeed(snapshot!.packed);setSeamEdges(new Set(snapshot!.seams));setUVConfig({...config});setUVTarget(operation);
      setNotice(operation==='stitch'?'后处理：基于当前岛和共享接缝尝试缝合，不重新运行 baseline。':'只重排当前岛；不改变岛数，不把同页摆放冒充缝合。');
    }
  };
  const seek=(next:number)=>{setPlaying(false);setStep(Math.max(0,Math.min(frames.length-1,next)));};
  const togglePlayback=()=>{if(!frames.length)return;if(!playing&&step>=frames.length-1)setStep(0);setPlaying(!playing);};

  return <div className="app-shell" onDragOver={e=>{e.preventDefault();}} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files.length)void loadFiles(Array.from(e.dataTransfer.files));}}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark" aria-hidden="true">M</span>MeshTailor <span className="version">0.4.8</span></div>
      <div className="document-name" title={mesh.name}>{mesh.name}<span>{stats.triangles.toLocaleString()} 面</span></div>
      <div className="header-actions"><button onClick={()=>importInput.current?.click()}>导入网格</button><button disabled={!snapshot} onClick={exportTargetUV}>导出 OBJ + UV</button></div>
    </header>
    <main className="workspace">
      <aside className="sidebar" aria-label="工具与属性">
        <nav className="tool-tabs" role="tablist" aria-label="工具分类">
          {([['mesh','模型'],['uv','UV'],['animation','动画']] as const).map(([id,label])=><button key={id} id={`tool-${id}`} role="tab" aria-selected={toolTab===id} aria-controls={`tools-${id}`} onClick={()=>{setToolTab(id);if(id==='animation')setViewMode('unfold');}}>{label}</button>)}
        </nav>
        <div className="sidebar-scroll">
          <div id="tools-mesh" role="tabpanel" aria-labelledby="tool-mesh" hidden={toolTab!=='mesh'}>
        <section><h3>本地模型</h3><div className="button-grid"><button onClick={()=>resetForMesh(makeCube())}>Cube</button><button onClick={()=>resetForMesh(makeCylinder(20))}>Cylinder</button><button onClick={()=>resetForMesh(makeTorsoGrid())}>Torso</button></div>
          <label className="file-label">选择 OBJ / FBX / GLB / GLTF<input ref={importInput} type="file" multiple accept=".obj,.fbx,.glb,.gltf,.bin" onChange={e=>{const files=Array.from(e.target.files??[]);if(files.length)void loadFiles(files);e.target.value='';}}/></label>
          <small>可拖入文件。glTF 与配套 .bin 请一起选择。只导入网格，不显示材质贴图。</small>
          <details><summary>导入设置</summary>
            <label>位置焊接（FBX / glTF）<select aria-label="Weld mode" value={weld} onChange={e=>setWeld(e.target.value as SceneImportOptions['weld'])}><option value="boundary">Boundary · 微小断边配对（默认）</option><option value="exact">Exact · 仅精确同坐标</option><option value="tolerance">Tolerance · 容差</option><option value="off">Off · 保留渲染顶点索引</option></select></label>
            {(weld==='tolerance'||weld==='boundary')&&<label>相对包围盒容差<input aria-label="Weld tolerance" type="number" min="1e-12" max="0.001" step="0.0000001" value={tolerance} onChange={e=>{const v=+e.target.value;if(v>0&&v<=.001)setTolerance(v);}}/></label>}
            <small>不跨对象焊接；同一对象内重合但独立的表面可能被连接。UV 保存在面角，不随位置焊接丢失。设置在下次导入生效。</small>
          </details>
        </section>
        <section><h3>内置样例</h3>
          <label>模型<select aria-label="Complex mesh" value={exampleId} onChange={e=>setExampleId(e.target.value as ComplexExampleId)}>{COMPLEX_EXAMPLES.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          <label>密度<select aria-label="Mesh detail" value={detail} onChange={e=>setDetail(e.target.value as MeshDetail)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <small>{COMPLEX_EXAMPLES.find(m=>m.id===exampleId)?.description}</small>
          <button onClick={()=>resetForMesh(makeComplexExample(exampleId,detail))}>载入样例</button>
          <div className="button-grid two"><button disabled={!!busy} onClick={()=>void loadFBXExample('ascii')}>FBX ASCII</button><button disabled={!!busy} onClick={()=>void loadFBXExample('binary')}>FBX Binary</button></div>
          <button onClick={()=>{resetForMesh(makeFragmentationDemo(2).mesh);setUVTarget('source');setViewMode('unfold');setToolTab('uv');}}>重叠碎岛测试片（非真实资产）</button>
          <button onClick={()=>saveFile('meshtailor-mesh.obj',meshToOBJ(mesh),'text/plain')}>导出当前网格</button>
        </section>
        <section><h3>在线模型</h3><small>CC0；优先使用已下载的本地副本，否则从原站获取几何和 UV，不下载贴图。</small>
          {REMOTE_MESH_ASSETS.map(asset=><div className="asset-card" key={asset.id}><button disabled={!!busy} onClick={()=>void loadRemote(asset)}>{asset.name}</button><small>{asset.description} <a href={asset.source} target="_blank" rel="noreferrer">来源与许可</a></small></div>)}
        </section>
            <section><h3>展开示例</h3><div className="button-grid two"><button onClick={loadHingeDemo}>三块折角带</button><button onClick={loadUnfoldDemo}>六岛立方体</button></div></section>
        <section className="stats"><h3>Topology</h3><dl><dt>Vertices</dt><dd>{stats.vertices.toLocaleString()}</dd><dt>Triangles</dt><dd>{stats.triangles.toLocaleString()}</dd><dt>Edges</dt><dd>{stats.edges.toLocaleString()}</dd><dt>Boundary</dt><dd>{stats.boundary.toLocaleString()}</dd><dt>Manifold*</dt><dd>{stats.manifold?'yes':'no'}</dd><dt>UV charts</dt><dd>{chartCount??'…'}</dd></dl><small>* edge-manifold check, not a repair guarantee</small></section>
        {importReport&&<section className="import-report"><h3>Import report</h3><p>{importReport.parts} parts · {importReport.sourceVertices.toLocaleString()} source vertices → {importReport.vertices.toLocaleString()} topology vertices</p><p>{importReport.weldedVertices.toLocaleString()} welded · {importReport.uvFaces.toLocaleString()} faces with UV</p><details><summary>导入说明 / Warnings</summary>{importReport.warnings.map((w,i)=><p key={i}>{w}</p>)}</details></section>}
          </div>
          <div id="tools-uv" role="tabpanel" aria-labelledby="tool-uv" hidden={toolTab!=='uv'}>
        <section><h3>裁切方案</h3><small>重新生成裁切，或读取模型原有 UV。</small><button className="primary" disabled={!!busy} onClick={()=>runSeams('baseline')}>Generate baseline</button><button disabled={!!busy} onClick={()=>runSeams('uv-seams')}>Extract existing UV seams</button>
          <details><summary>传统 baseline 参数（仅 legacy 策略生效）</summary><label>Curvature quantile <b>{curvature.toFixed(2)}</b><input type="range" min="0.55" max="0.98" step="0.01" value={curvature} onChange={e=>setCurvature(+e.target.value)}/></label>
          <label>Structural cross-sections <b>{rings}</b><input type="range" min="0" max="5" step="1" value={rings} onChange={e=>setRings(+e.target.value)}/></label>
          <label>Baseline edge budget <input aria-label="Edge budget" type="number" min="50" max="20000" step="50" value={maxEdges} onChange={e=>{const n=Math.floor(+e.target.value);if(n>=50&&n<=20000)setMaxEdges(n);}}/></label><small>仅限制传统 baseline；自动大块模式不截断区域边界，不抽稀网格。</small></details>
        </section>
            <UVSolverControls value={uvConfig} onChange={setUVConfig} snapshot={snapshot} onProcess={processUV} onAuto={goal=>runSeams(goal==='large'?'auto-large':'auto-balanced')}/>
            <UVJobStatus state={uvState} hasSource={hasSourceUV} onUseSource={()=>{setUVTarget('source');setViewMode('unfold');if(snapshotTarget==='source')uvState.retry();}}/>
            <section><h3>诊断</h3><button onClick={()=>saveFile('meshtailor-diagnostic.json',JSON.stringify({version:'0.4.8',mesh:{name:mesh.name,vertices:mesh.positions.length,faces:mesh.faces.length},importReport,settings:uvConfig,target:uvTarget,uvSpaces:snapshot?.geometry.atlas.spaces,fragmentation:snapshot?.fragmentation,sourceAudit:snapshot?.sourceAudit,merge:snapshot?.merge,pageReport:snapshot?.pageReport,charts:snapshot?.diagnostics,warnings:snapshot?.warnings,timing:snapshot?.timing},null,2),'application/json')}>导出分割诊断</button><small>只包含参数与统计，不包含模型几何。</small></section>
          </div>
          <div id="tools-animation" role="tabpanel" aria-labelledby="tool-animation" hidden={toolTab!=='animation'}>
            <UnfoldControls player={player} snapshot={snapshot} target={uvTarget} onTarget={setUVTarget} onExport={exportTargetUV} onDemo={loadUnfoldDemo} onHingeDemo={loadHingeDemo}/>
        <section><h3>视图选项</h3><button onClick={()=>{setCameraResetKey(n=>n+1);if(viewMode==='unfold')player.fit('orbit');}}>Reset camera</button>
          <label className="check"><input type="checkbox" checked={wireframe} onChange={e=>setWireframe(e.target.checked)}/> wireframe</label>
          <label className="check"><input type="checkbox" checked={xray} onChange={e=>setXray(e.target.checked)}/> X-ray traversal</label>
          <label className="check"><input type="checkbox" checked={showAllSeams} onChange={e=>setShowAllSeams(e.target.checked)}/> Show all seams</label>
          <label className="check"><input type="checkbox" checked={liveUV} onChange={e=>setLiveUV(e.target.checked)}/> 按遍历步骤重新求解 UV（诊断）</label>
          <small>默认所有网格都按完整接缝求解；播放只改变高亮。勾选后才会随步骤重新切分。</small>
          <div className="legend"><span><i className="dot seam"/>seam</span><span><i className="dot candidate"/>candidates</span><span><i className="dot current"/>current</span><span><i className="dot previous"/>previous</span></div>
        </section>
          </div>
        </div>
        <div className="sidebar-foot"><span className={`status-dot ${uvState.loading?'working':''}`}/>{uvState.loading?'UV 计算中':chartCount===null?'暂无 UV':`${chartCount} 个 UV 岛`}<button onClick={()=>setToolTab('uv')}>查看任务</button></div>
      </aside>
      <section className="center">
        <div className="view-tabs" role="tablist" aria-label="3D preview mode"><button role="tab" aria-selected={viewMode==='traversal'} onClick={()=>setViewMode('traversal')}>裁切线遍历</button><button role="tab" aria-selected={viewMode==='unfold'} onClick={()=>{setViewMode('unfold');setToolTab('animation');}}>3D ↔ UV 展开动画</button><span className="view-tools"><button aria-label="Toggle wireframe" aria-pressed={wireframe} onClick={()=>setWireframe(!wireframe)}>线框</button><button onClick={()=>{setCameraResetKey(n=>n+1);if(viewMode==='unfold')player.fit('current');}}>适配视图</button></span></div>
        <div className="panel scene-panel"><div className="panel-title"><span>{viewMode==='unfold'?'展开视图':'3D traversal'}</span><span>{mesh.name} · {viewMode==='unfold'?`${chartCount??'…'} UV islands`:`${activeEdges.size}/${seamEdges.size} seams + ${snapshot?.addedSeams?.length??0} UV cuts`}</span></div>{viewMode==='unfold'?<UnfoldViewport geometry={snapshot?.geometry??null} options={{timeline:player.timeline,progress:player.progress,selected:player.active,order:player.order,handoff:player.handoff,holdNet:player.holdNet,path:player.path,separation:player.separation,context:player.context,wireframe,checker:player.checker,labels:player.labels,xray,focusFace:player.focusFace,hingeWave:player.hingeWave,showHinges:player.showHinges,showTemporaryCuts:player.showTemporaryCuts,autoFrame:player.autoFrame}} cameraCommand={player.cameraCommand} sceneKey={mesh} onCameraManual={()=>player.setAutoFrame(false)} onPick={player.pick} status={uvStatus}/>:<MeshViewport mesh={mesh} seamEdges={displaySeams} frame={frame} wireframe={wireframe} xray={xray} cameraResetKey={cameraResetKey}/>}</div>
        {viewMode==='unfold'?<UnfoldTransport player={player} disabled={!snapshot}/>:<div className="debugbar"><button aria-label="First step" onClick={()=>seek(0)} disabled={!frames.length}>⏮</button><button aria-label="Previous step" onClick={()=>seek(step-1)} disabled={!frames.length}>◀</button><button className="primary" onClick={togglePlayback} disabled={!frames.length||!!busy}>{playing?'Pause':'Play'}</button><button aria-label="Next step" onClick={()=>seek(step+1)} disabled={!frames.length}>▶</button><button aria-label="Last step" onClick={()=>seek(frames.length-1)} disabled={!frames.length}>⏭</button><input aria-label="Traversal step" type="range" min="0" max={Math.max(0,frames.length-1)} value={Math.max(0,step)} onChange={e=>seek(+e.target.value)} disabled={!frames.length}/><span className="step-label">{frames.length?`${step+1}/${frames.length}`:'0/0'}</span></div>}
        <div className="notice">{loadError?<span role="alert">{loadError}</span>:busy?<span role="status">{busy} <button onClick={()=>{cancel();setNotice('Operation cancelled.');}}>Cancel</button></span>:viewMode==='unfold'?<>{uvState.error?<><span role="alert">{uvState.error}</span> <button onClick={uvState.retry}>重试 UV</button></>:snapshot?`动画终点 = 右侧 UV = 导出 UV。${snapshot.addedSeams?.length??0} 条 UV 补切已显式叠加；紫色临时断边仅用于铰链演示。`:uvStatus}</>:frame?<><b>{frame.tokenLabel}</b> · {frame.message} · candidates {frame.mask.vertices.length}{frame.mask.allowEOC?' + EOC':''}{frame.mask.allowEOS?' + EOS':''}</>:notice}</div>
        {viewMode==='traversal'&&frames.length>0&&<div className="operation-summary">{notice}</div>}
      </section>
      <aside className="rightbar">
        <div className="panel uv-panel"><div className="panel-title"><span>{viewMode==='unfold'?'UV 编辑器':'UV 预览'}</span><span>{snapshotTarget==='source'?'原始 UV':liveUV&&viewMode==='traversal'?'current step':'生成 UV'}</span></div><UVCanvas snapshot={snapshot} status={uvStatus} selected={viewMode==='unfold'?player.active:uvAll} focusFace={viewMode==='unfold'?player.focusFace:null} checker={viewMode==='unfold'&&player.checker} wireframe={wireframe} onPick={viewMode==='unfold'?player.pick:undefined}/></div>
        {viewMode==='unfold'?<CorrespondenceInspector mesh={mesh} snapshot={snapshot} player={player}/>:<div className="panel timeline"><div className="panel-title"><span>Decode timeline</span><span>{chains.length} chains</span></div>{frames.length>100&&<small className="timeline-window">Showing {timelineStart+1}–{timelineStart+timelineFrames.length} of {frames.length}. Use slider to seek.</small>}<div className="timeline-scroll">{frames.length?timelineFrames.map((f,j)=>{const i=j+timelineStart;return <button key={i} className={i===step?'active':''} onClick={()=>seek(i)}><span>{String(i+1).padStart(3,'0')}</span><b>{f.tokenLabel}</b><em>{f.message}</em></button>;}):<p className="empty">Generate seams to inspect mesh-native pointer traversal.</p>}</div></div>}
      </aside>
    </main>
    <footer><span>MeshTailor-JS · 几何研究工作台</span><span>左键旋转 · 右键平移 · 滚轮缩放</span><span>先选 UV 岛，再选三角形 · Esc 取消</span></footer>
  </div>;
}
