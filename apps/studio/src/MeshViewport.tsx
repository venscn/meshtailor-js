import { useEffect, useRef, useState } from 'react';
import type { MeshData } from '@meshtailor/mesh-core';
import type { GenerationFrame } from '@meshtailor/runtime';
import { ViewportScene } from './viewport-scene';

interface Props {
  mesh: MeshData;
  seamEdges: Set<string>;
  frame?: GenerationFrame;
  wireframe: boolean;
  xray?: boolean;
  cameraResetKey?: number;
}

export function MeshViewport({ mesh, seamEdges, frame, wireframe, xray = true, cameraResetKey = 0 }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ViewportScene | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [meshError, setMeshError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  // Do not add mesh/frame/seamEdges here: playback must reuse the WebGL context.
  useEffect(() => {
    if (!host.current) return;
    let controller: ViewportScene | null = null;
    try {
      controller = new ViewportScene(host.current, setRendererError);
      scene.current = controller;
    } catch (error) {
      setRendererError(`Cannot start WebGL 2: ${error instanceof Error ? error.message : String(error)}`);
    }
    return () => { scene.current = null; controller?.dispose(); };
  }, [retry]);

  useEffect(() => {
    try { scene.current?.setMesh(mesh); setMeshError(null); }
    catch (error) { setMeshError(error instanceof Error ? error.message : String(error)); }
  }, [mesh, retry]);

  useEffect(() => { scene.current?.updateTraversal(seamEdges, frame, xray); }, [mesh, seamEdges, frame, xray, retry]);
  useEffect(() => { scene.current?.setWireframe(wireframe); }, [mesh, wireframe, retry]);
  useEffect(() => { scene.current?.fitCamera(); }, [cameraResetKey, retry]);

  const error = meshError || rendererError;
  return <div ref={host} className="viewport" data-testid="mesh-viewport">
    {error && <div className="viewport-error" role="alert">
      <strong>3D view unavailable</strong><p>{error}</p>
      <p>Check browser hardware acceleration and WebGL 2 support. The rest of Studio remains available.</p>
      <button onClick={() => setRetry((n) => n + 1)}>Retry 3D</button>
    </div>}
    {!error && <div className="viewport-hint">
      {frame && frame.token >= 0 && frame.revealedEdges.length === 0
        ? 'Chain start: use Next / Play to reveal the first edge.'
        : 'Drag: orbit · Wheel: zoom · Right drag: pan'}
    </div>}
  </div>;
}
