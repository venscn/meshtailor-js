import { useEffect, useMemo, useState } from 'react';
import { buildTopology, makeCube, makeCylinder, makeTorsoGrid, parseOBJ, validateManifold, type MeshData } from '@meshtailor/mesh-core';
import { canonicalOrder, extractSeamEdgesFromUV, traceSeamChains, type SeamChain } from '@meshtailor/chaining-seams';
import { buildGenerationFrames, generateGeometricSeams, type GenerationFrame } from '@meshtailor/runtime';
import { buildCharts } from '@meshtailor/uv';
import { MESH_TAILOR_V2_SPEC } from '@meshtailor/model';
import { MeshViewport } from './MeshViewport';
import { UVCanvas } from './UVCanvas';
import { loadGLTFFile } from './gltf';
import { prepareViewportMesh } from './viewport-math';
import './styles.css';

function describeMesh(mesh:MeshData){const t=buildTopology(mesh),m=validateManifold(mesh);return{vertices:mesh.positions.length,triangles:mesh.faces.length,edges:t.edges.size,boundary:t.boundaryEdges.size,manifold:m.manifold};}

export default function App(){
  const [mesh,setMesh]=useState<MeshData>(()=>makeTorsoGrid());
  const [loadError,setLoadError]=useState<string|null>(null);
  const [seamEdges,setSeamEdges]=useState<Set<string>>(new Set()); const [chains,setChains]=useState<SeamChain[]>([]); const [frames,setFrames]=useState<GenerationFrame[]>([]); const [step,setStep]=useState(-1);
  const [wireframe,setWireframe]=useState(false);const [xray,setXray]=useState(true);const [showAllSeams,setShowAllSeams]=useState(false);const [cameraResetKey,setCameraResetKey]=useState(0);const [curvature,setCurvature]=useState(.82);const [rings,setRings]=useState(2);const [playing,setPlaying]=useState(false);const [notice,setNotice]=useState('Ready. Generate a geometric baseline or load UV seams from OBJ.');
  const frame=step>=0?frames[step]:undefined;
  const activeEdges=useMemo(()=>showAllSeams?seamEdges:frame?new Set(frame.revealedEdges):seamEdges,[frame,seamEdges,showAllSeams]);
  const stats=useMemo(()=>describeMesh(mesh),[mesh]); const chartCount=useMemo(()=>buildCharts(mesh,activeEdges).length,[mesh,activeEdges]);

  useEffect(()=>{
    if(!playing || !frames.length)return;
    if(step>=frames.length-1){setPlaying(false);return;}
    const id=setTimeout(()=>setStep((s)=>Math.min(frames.length-1,s+1)),420);
    return()=>clearTimeout(id);
  },[playing,step,frames.length]);
  const seek=(next:number)=>{setPlaying(false);setStep(Math.max(0,Math.min(frames.length-1,next)));};
  const togglePlayback=()=>{
    if(!frames.length)return;
    if(!playing && step>=frames.length-1)setStep(0);
    setPlaying(!playing);
  };
  const apply=(edges:Set<string>,cs:SeamChain[],why:string)=>{const ordered=canonicalOrder(mesh,cs);setSeamEdges(new Set(edges));setChains(ordered);const fs=buildGenerationFrames(mesh,ordered);setFrames(fs);setShowAllSeams(false);setStep(fs.length?0:-1);setPlaying(false);setNotice(`${why}: ${edges.size} seam edges, ${ordered.length} chains, ${fs.length} decode steps.`);};
  const generate=()=>{const r=generateGeometricSeams(mesh,{curvatureQuantile:curvature,structuralRings:rings});apply(r.seamEdges,r.chains,'Geometric baseline');};
  const extract=()=>{const edges=extractSeamEdgesFromUV(mesh);if(!edges.size){setNotice('No UV discontinuity seams found. OBJ is the most reliable format because it preserves per-corner UV indices.');return;}apply(edges,traceSeamChains(mesh,edges),'Extracted from UV');};
  const resetForMesh=(m:MeshData)=>{setLoadError(null);setMesh(m);setSeamEdges(new Set());setChains([]);setFrames([]);setShowAllSeams(false);setStep(-1);setPlaying(false);setNotice(`Loaded ${m.name}.`);};
  const loadFile=async(file:File)=>{setLoadError(null);try{const ext=file.name.split('.').pop()?.toLowerCase();const m=ext==='obj'?parseOBJ(await file.text(),file.name):ext==='glb'||ext==='gltf'?await loadGLTFFile(file):null;if(!m)throw new Error('Supported formats: .obj, .glb, .gltf');prepareViewportMesh(m);resetForMesh(m);}catch(e){setLoadError(e instanceof Error?e.message:String(e));}};

  return <div className="app-shell">
    <header className="topbar"><div><div className="brand">MeshTailor-JS <span>Studio</span></div><div className="subtitle">paper-level TypeScript reproduction scaffold · functional geometric fallback</div></div><div className="paper-pill">MeshTailor v2 · d={MESH_TAILOR_V2_SPEC.modelDimension} · {MESH_TAILOR_V2_SPEC.decoderLayers} decoder layers</div></header>
    <main className="workspace">
      <aside className="sidebar">
        <section><h3>Mesh</h3><div className="button-grid"><button onClick={()=>resetForMesh(makeCube())}>Cube</button><button onClick={()=>resetForMesh(makeCylinder(20))}>Cylinder</button><button onClick={()=>resetForMesh(makeTorsoGrid())}>Torso</button></div><label className="file-label">Load OBJ / GLB / GLTF<input type="file" accept=".obj,.glb,.gltf" onChange={(e)=>{const file=e.target.files?.[0];if(file)void loadFile(file);e.target.value='';}}/></label></section>
        <section><h3>Seam source</h3><button className="primary" onClick={generate}>Generate baseline</button><button onClick={extract}>Extract existing UV seams</button><label>Curvature quantile <b>{curvature.toFixed(2)}</b><input type="range" min="0.55" max="0.98" step="0.01" value={curvature} onChange={(e)=>setCurvature(+e.target.value)}/></label><label>Structural cross-sections <b>{rings}</b><input type="range" min="0" max="5" step="1" value={rings} onChange={(e)=>setRings(+e.target.value)}/></label></section>
        <section><h3>Display</h3><button onClick={()=>setCameraResetKey((n)=>n+1)}>Reset camera</button><label className="check"><input type="checkbox" checked={wireframe} onChange={(e)=>setWireframe(e.target.checked)}/> wireframe</label><label className="check"><input type="checkbox" checked={xray} onChange={(e)=>setXray(e.target.checked)}/> X-ray traversal</label><label className="check"><input type="checkbox" checked={showAllSeams} onChange={(e)=>setShowAllSeams(e.target.checked)}/> Show all seams</label><div className="legend"><span><i className="dot seam"/>seam</span><span><i className="dot candidate"/>decision candidates</span><span><i className="dot current"/>current</span><span><i className="dot previous"/>previous</span></div></section>
        <section className="stats"><h3>Topology</h3><dl><dt>Vertices</dt><dd>{stats.vertices}</dd><dt>Triangles</dt><dd>{stats.triangles}</dd><dt>Edges</dt><dd>{stats.edges}</dd><dt>Boundary</dt><dd>{stats.boundary}</dd><dt>Manifold*</dt><dd>{stats.manifold?'yes':'no'}</dd><dt>Charts now</dt><dd>{chartCount}</dd></dl><small>* edge-manifold check</small></section>
      </aside>
      <section className="center">
        <div className="panel scene-panel"><div className="panel-title"><span>3D traversal</span><span>{mesh.name} · {activeEdges.size}/{seamEdges.size} seams</span></div><MeshViewport mesh={mesh} seamEdges={activeEdges} frame={frame} wireframe={wireframe} xray={xray} cameraResetKey={cameraResetKey}/></div>
        <div className="debugbar"><button aria-label="First step" onClick={()=>seek(0)} disabled={!frames.length}>⏮</button><button aria-label="Previous step" onClick={()=>seek(step-1)} disabled={!frames.length}>◀</button><button className="primary" onClick={togglePlayback} disabled={!frames.length}>{playing?'Pause':'Play'}</button><button aria-label="Next step" onClick={()=>seek(step+1)} disabled={!frames.length}>▶</button><button aria-label="Last step" onClick={()=>seek(frames.length-1)} disabled={!frames.length}>⏭</button><input aria-label="Traversal step" type="range" min="0" max={Math.max(0,frames.length-1)} value={Math.max(0,step)} onChange={(e)=>seek(+e.target.value)} disabled={!frames.length}/><span className="step-label">{frames.length?`${step+1}/${frames.length}`:'0/0'}</span></div>
        <div className="notice">{loadError?<span role="alert">{loadError}</span>:frame?<><b>{frame.tokenLabel}</b> · {frame.message} · decision candidates {frame.mask.vertices.length}{frame.mask.allowEOC?' + EOC':''}{frame.mask.allowEOS?' + EOS':''}</>:notice}</div>
      </section>
      <aside className="rightbar">
        <div className="panel uv-panel"><div className="panel-title"><span>UV charts</span><span>preview</span></div><UVCanvas mesh={mesh} seamEdges={activeEdges}/></div>
        <div className="panel timeline"><div className="panel-title"><span>Decode timeline</span><span>{chains.length} chains</span></div><div className="timeline-scroll">{frames.length?frames.map((f,i)=><button key={i} className={i===step?'active':''} onClick={()=>seek(i)}><span>{String(i+1).padStart(3,'0')}</span><b>{f.tokenLabel}</b><em>{f.message}</em></button>):<p className="empty">Generate seams to inspect mesh-native pointer traversal.</p>}</div></div>
      </aside>
    </main>
    <footer>Research reproduction scaffold. Learned MeshTailor output requires author checkpoints or independently trained compatible weights; the built-in baseline is geometric and explicitly separate.</footer>
  </div>
}
