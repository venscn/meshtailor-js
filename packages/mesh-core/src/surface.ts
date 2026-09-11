import { add3, scale3, triangleArea, triangleNormal } from './math.js';
import type { MeshData, Vec3 } from './types.js';

export interface SurfacePoint { position: Vec3; normal: Vec3; face: number }

/** Area-weighted sampling; pass a seeded RNG for reproducible datasets. */
export function sampleSurface(mesh: MeshData, count: number, rng: () => number = Math.random): SurfacePoint[] {
  const cumulative: number[] = [];
  let total = 0;
  for (const f of mesh.faces) {
    const [a,b,c] = f.vertices.map((i) => mesh.positions[i]!) as [Vec3,Vec3,Vec3];
    total += triangleArea(a,b,c);
    cumulative.push(total);
  }
  const result: SurfacePoint[] = [];
  for (let k = 0; k < count; k++) {
    const t = rng() * total;
    let fi = cumulative.findIndex((x) => x >= t);
    if (fi < 0) fi = cumulative.length - 1;
    const f = mesh.faces[fi]!;
    const [a,b,c] = f.vertices.map((i) => mesh.positions[i]!) as [Vec3,Vec3,Vec3];
    let u = rng(), v = rng();
    if (u + v > 1) { u = 1-u; v = 1-v; }
    const p = add3(a, add3(scale3([b[0]-a[0],b[1]-a[1],b[2]-a[2]],u), scale3([c[0]-a[0],c[1]-a[1],c[2]-a[2]],v)));
    result.push({ position: p, normal: triangleNormal(a,b,c), face: fi });
  }
  return result;
}
