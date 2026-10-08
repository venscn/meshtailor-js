/** Dev-only harness: real React StrictMode + production hook, no mocked hooks.
 * Not part of the Studio's index.html or production build entry.
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { geometryOnlyMesh, GEOMETRY_INPUT_POLICY } from '@meshtailor/mesh-core';
import { unwrapMesh, geometryGenerationOptions, buildUnfoldGeometry } from '@meshtailor/uv';
import { makeUnfoldDemo } from '../src/unfold/demo';
import { useUnfoldPlayer, type UnfoldPlayer } from '../src/unfold/useUnfoldPlayer';
import type { UVSnapshot } from '../src/workers/uv.worker';

function snapshot(): UVSnapshot {
  const demo=makeUnfoldDemo();
  const mesh=geometryOnlyMesh(demo.mesh);
  const {packed,seams}=unwrapMesh(mesh,new Set(),geometryGenerationOptions(mesh));
  return {inputPolicy:GEOMETRY_INPUT_POLICY,packed,geometry:buildUnfoldGeometry(mesh,packed,new Set(seams)),seams:[...seams],target:'generated',warnings:[]};
}
declare global {
  interface Window {selectionHarness?:{player:UnfoldPlayer;snapshot:UVSnapshot;reload:()=>void}}
}
function Harness(){
  const [data,setData]=useState(snapshot);
  const player=useUnfoldPlayer(data);
  useEffect(()=>{window.selectionHarness={player,snapshot:data,reload:()=>setData(snapshot())};});
  return <main><h1>Real React selection hook harness</h1><pre>{JSON.stringify({islands:player.selection,face:player.focusFace,progress:player.progress,playing:player.playing})}</pre></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Harness/></StrictMode>);
