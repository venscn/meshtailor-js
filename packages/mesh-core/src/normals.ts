import { add3, normalize3, triangleNormal } from './math.js';
import type { MeshData, Vec3 } from './types.js';

export function computeVertexNormals(mesh: MeshData): Vec3[] {
  const acc: Vec3[] = Array.from({ length: mesh.positions.length }, () => [0, 0, 0]);
  for (const face of mesh.faces) {
    const [ia, ib, ic] = face.vertices;
    const n = triangleNormal(mesh.positions[ia]!, mesh.positions[ib]!, mesh.positions[ic]!);
    acc[ia] = add3(acc[ia]!, n);
    acc[ib] = add3(acc[ib]!, n);
    acc[ic] = add3(acc[ic]!, n);
  }
  return acc.map(normalize3);
}
