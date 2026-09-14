import { stitchBoundaryPairs } from './boundary-stitch.js';
import type { MeshData, MeshFace, Vec3 } from './types.js';

/** Renderer vertices are often duplicated at hard normals and UV seams.
 * Rebuild position adjacency within each source object, never across objects.
 * Exact welding is the default; it cannot distinguish coincident disconnected
 * surfaces inside ONE object. Select 'off' for such assets.
 */
export interface MeshImportOptions {
  weld?: 'off' | 'exact' | 'tolerance' | 'boundary';
  relativeTolerance?: number;
  maxTriangles?: number;
}
export interface RawMeshPart { name: string; positions: Vec3[]; faces: MeshFace[] }
export interface MeshImportReport {
  parts: number; sourceVertices: number; vertices: number; triangles: number;
  weldedVertices: number; stitchedEdges?: number; stitchedVertices?: number; ambiguousBoundaryEdges?:number; droppedDegenerate: number; uvFaces: number;
  weld: NonNullable<MeshImportOptions['weld']>; warnings: string[];
}
export interface ImportedMesh { mesh: MeshData; report: MeshImportReport }

export function assembleMeshParts(parts: RawMeshPart[], name: string, options: MeshImportOptions = {}): ImportedMesh {
  const weld = options.weld ?? 'exact';
  const relativeTolerance = options.relativeTolerance ?? (weld==='boundary'?5e-7:1e-7);
  const maxTriangles = options.maxTriangles ?? 300_000;
  if (!['off', 'exact', 'tolerance', 'boundary'].includes(weld)) throw new Error('Unknown weld mode.');
  if (!(relativeTolerance > 0 && relativeTolerance <= .001 && Number.isFinite(relativeTolerance))) throw new Error('Relative weld tolerance must be > 0 and <= 0.001.');
  if (!Number.isInteger(maxTriangles) || maxTriangles < 1) throw new Error('Triangle limit must be a positive integer.');
  const inputFaces = parts.reduce((n, p) => n + p.faces.length, 0);
  if (inputFaces > maxTriangles) throw new Error(`Mesh has ${inputFaces.toLocaleString()} triangles; current import limit is ${maxTriangles.toLocaleString()}. Split or decimate it first.`);
  const positions: Vec3[] = [], faces: MeshFace[] = [];
  const report: MeshImportReport = { parts: parts.length, sourceVertices: 0, vertices: 0, triangles: 0, weldedVertices: 0, droppedDegenerate: 0, uvFaces: 0, weld, warnings: [] };
  for (const part of parts) {
    const firstFace=faces.length;
    report.sourceVertices += part.positions.length;
    const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of part.positions) {
      if (p.length !== 3 || !p.every(Number.isFinite)) throw new Error(`${part.name}: non-finite position.`);
      for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a]!, p[a]!); max[a] = Math.max(max[a]!, p[a]!); }
    }
    const extent = Math.max(...max.map((v, a) => v - min[a]!));
    const tolerance = Math.max(extent * relativeTolerance, Number.MIN_VALUE);
    const exact = new Map<string, number>(), buckets = new Map<string, number[]>();
    const remap: number[] = [];
    for (const p of part.positions) {
      let existing: number | undefined;
      const key = p.join(',');
      if ((weld === 'exact' || weld === 'boundary')) existing = exact.get(key);
      const cell = weld === 'tolerance' ? p.map((v, a) => Math.floor((v - min[a]!) / tolerance)) : [];
      if (weld === 'tolerance') {
        // Search neighboring cells as well, including points on bucket boundaries.
        search: for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
          for (const index of buckets.get(`${cell[0]! + x},${cell[1]! + y},${cell[2]! + z}`) ?? []) {
            const q = positions[index]!;
            if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= tolerance) { existing = index; break search; }
          }
        }
      }
      if (existing !== undefined) { remap.push(existing); report.weldedVertices++; continue; }
      const index = positions.length;
      positions.push([...p]); remap.push(index);
      if ((weld === 'exact' || weld === 'boundary')) exact.set(key, index);
      if (weld === 'tolerance') { const k = cell.join(','); const bucket = buckets.get(k) ?? []; bucket.push(index); buckets.set(k, bucket); }
    }
    for (const f of part.faces) {
      if (f.vertices.some(v => !Number.isInteger(v) || v < 0 || v >= remap.length)) throw new Error(`${part.name}: face references missing vertex.`);
      const ids = f.vertices.map(v => remap[v]!) as [number, number, number];
      const [a, b, c] = ids.map(i => positions[i]!) as [Vec3, Vec3, Vec3];
      const ab = b.map((v, i) => v - a[i]!), ac = c.map((v, i) => v - a[i]!);
      const area2 = Math.hypot(ab[1]! * ac[2]! - ab[2]! * ac[1]!, ab[2]! * ac[0]! - ab[0]! * ac[2]!, ab[0]! * ac[1]! - ab[1]! * ac[0]!);
      if (new Set(ids).size < 3 || area2 === 0) { report.droppedDegenerate++; continue; }
      if (f.uvs?.some(uv => uv !== null && !uv.every(Number.isFinite))) throw new Error(`${part.name}: non-finite UV coordinate.`);
      faces.push({ ...f, sourcePart:f.sourcePart??`object:${parts.indexOf(part)}`, vertices: ids });
      if (f.uvs?.every(uv => uv !== null)) report.uvFaces++;
    }
    if(weld==='boundary'){
      const repaired=stitchBoundaryPairs(positions,faces.slice(firstFace),tolerance);
      for(let i=0;i<repaired.faces.length;i++)faces[firstFace+i]=repaired.faces[i]!;
      report.stitchedEdges=(report.stitchedEdges??0)+repaired.stitchedEdges;
      report.stitchedVertices=(report.stitchedVertices??0)+repaired.stitchedVertices;
      report.ambiguousBoundaryEdges=(report.ambiguousBoundaryEdges??0)+repaired.ambiguousEdges;
      if(repaired.rejected)report.warnings.push(`${part.name}: boundary repairs were rolled back to avoid degeneracy/non-manifold joins.`);
    }
  }
  if (!faces.length) throw new Error('No usable triangle geometry found. Curves, lights, cameras and animation-only files are not meshes.');
  // Drop orphan vertices left by degenerate triangles without changing face-corner UVs.
  const used = new Map<number, number>(), compact: Vec3[] = [];
  for (const f of faces) f.vertices = f.vertices.map(i => { if (!used.has(i)) { used.set(i, compact.length); compact.push(positions[i]!); } return used.get(i)!; }) as MeshFace['vertices'];
  report.vertices = compact.length; report.triangles = faces.length;
  if (report.droppedDegenerate) report.warnings.push(`Skipped ${report.droppedDegenerate} degenerate triangles.`);
  if(weld==='boundary')report.warnings.push(`Boundary repair paired ${report.stitchedEdges??0} mutually unique edge pairs within ${relativeTolerance} × each source object's extent; ${report.ambiguousBoundaryEdges??0} ambiguous edges were not joined. No cross-object repair or UV-coordinate merge.`);
  if (weld !== 'off') report.warnings.push('Welding is per object. Coincident disconnected surfaces within one object may join; choose Off to preserve renderer indices.');
  return { mesh: { name, positions: compact, faces }, report };
}
