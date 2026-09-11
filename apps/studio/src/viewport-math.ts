import type { MeshData, Vec3 } from '@meshtailor/mesh-core';

export interface ViewportMesh {
  /** Display-only, centered coordinates. Source mesh indices and coordinates are untouched. */
  positions: Vec3[];
  triangles: Float32Array;
  radius: number;
}

export function prepareViewportMesh(mesh: MeshData): ViewportMesh {
  if (!mesh.positions.length || !mesh.faces.length) throw new Error('The mesh has no vertices or triangles.');
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((p, i) => {
    if (p.length !== 3 || !p.every(Number.isFinite)) throw new Error(`Vertex ${i} has invalid coordinates.`);
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a]!, p[a]!); max[a] = Math.max(max[a]!, p[a]!); }
  });
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  if (!(span > 0) || !Number.isFinite(span)) throw new Error('The mesh has a zero or unsupported coordinate extent.');
  // Subtract in JS double precision BEFORE creating GPU float32 attributes.
  const center = min.map((v, i) => v / 2 + max[i]! / 2) as Vec3;
  const positions = mesh.positions.map((p) => p.map((v, i) => ((v - center[i]!) / span) * 2) as Vec3);
  let radius = 0;
  for (const p of positions) radius = Math.max(radius, Math.hypot(...p));
  const triangles = new Float32Array(mesh.faces.length * 9);
  let cursor = 0;
  mesh.faces.forEach((face, fi) => {
    if (face.vertices.length !== 3) throw new Error(`Face ${fi} is not a triangle.`);
    for (const vi of face.vertices) {
      if (!Number.isInteger(vi) || !positions[vi]) throw new Error(`Face ${fi} references missing vertex ${vi}.`);
      triangles.set(positions[vi]!, cursor); cursor += 3;
    }
  });
  return { positions, triangles, radius: Math.max(radius, 1e-6) };
}

/** Fit a bounding sphere in BOTH horizontal and vertical fields of view. */
export function fitDistance(radius: number, verticalFovDegrees: number, aspect: number): number {
  if (!(radius > 0) || !(aspect > 0) || !Number.isFinite(radius) || !Number.isFinite(aspect) ||
      !(verticalFovDegrees > 0 && verticalFovDegrees < 180)) throw new Error('Invalid camera fit parameters.');
  const vertical = verticalFovDegrees * Math.PI / 360;
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return 1.18 * radius / Math.sin(Math.min(vertical, horizontal));
}

export function viewportSize(width: number, height: number, pixelRatio: number) {
  const w = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
  const h = Number.isFinite(height) ? Math.max(0, Math.floor(height)) : 0;
  const dpr = Number.isFinite(pixelRatio) && pixelRatio > 0 ? Math.min(pixelRatio, 2) : 1;
  return { width: w, height: h, dpr, visible: w > 0 && h > 0 };
}
