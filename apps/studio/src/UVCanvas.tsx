import { useEffect, useMemo, useRef } from 'react';
import type { MeshData } from '@meshtailor/mesh-core';
import { buildCharts, planarPackPreview } from '@meshtailor/uv';

export function UVCanvas({ mesh, seamEdges }: { mesh: MeshData; seamEdges: Set<string> }) {
  const host = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const packed = useMemo(() => planarPackPreview(mesh, buildCharts(mesh, seamEdges)), [mesh, seamEdges]);

  useEffect(() => {
    const el = host.current;
    const canvas = ref.current;
    if (!el || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w <= 0 || h <= 0) return; // A hidden panel will be drawn when observed again.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(w * dpr));
      const height = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.setTransform(width / w, 0, 0, height / h, 0, 0);
      ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, w, h);
      const s = Math.max(1, Math.min(w, h) * .9), ox = (w - s) / 2, oy = (h - s) / 2;
      ctx.strokeStyle = '#2b3140'; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, s, s);
      for (const chart of packed) {
        const hue = (chart.id * 67) % 360;
        for (const uvs of chart.faceUVs.values()) {
          ctx.beginPath();
          uvs.forEach((uv, i) => {
            const x = ox + uv[0] * s, y = oy + (1 - uv[1]) * s;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = `hsla(${hue},55%,55%,.25)`; ctx.fill();
          ctx.strokeStyle = `hsla(${hue},70%,72%,.72)`; ctx.lineWidth = .7; ctx.stroke();
        }
      }
      ctx.fillStyle = '#a8b0c2'; ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(`${packed.length} chart${packed.length === 1 ? '' : 's'} · planar debug preview`, 12, 20);
    };
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    window.addEventListener('resize', draw); // Includes browser zoom / most DPI changes.
    draw();
    return () => { observer.disconnect(); window.removeEventListener('resize', draw); };
  }, [packed]);

  return <div ref={host} className="uv-viewport"><canvas ref={ref} className="uv-canvas" aria-label="UV chart preview" /></div>;
}
