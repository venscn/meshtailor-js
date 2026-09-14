import { buildHingeRig, writeHingePositions, type HingeRig } from './hinge.js';
import { buildTopology, edgeKey, type MeshData, type Vec2, type Vec3 } from '@meshtailor/mesh-core';
import type { UVChart } from './charts.js';
import type { PackedChart } from './preview.js';

export type UnfoldOrder = 'together' | 'sequential';
export type UnfoldPath = 'hinge' | 'staged' | 'direct';
export interface AtlasFrame { min: Vec2; max: Vec2; center: Vec2; scale: number }
export interface UnfoldIsland {
  id: number;
  faces: number[];
  sourceCenter: Vec3;
  targetCenter: Vec3;
  direction: Vec3;
}
/** One vertex per FACE CORNER. A source vertex shared across a seam must be free to split. */
export interface UnfoldGeometry {
  source: Float32Array;
  target: Float32Array;
  uv: Float32Array;
  faceChart: Int32Array;
  boundaries: Uint32Array;
  islands: UnfoldIsland[];
  atlas: AtlasFrame;
  radius: number;
  hinge?: HingeRig;
}
export interface UnfoldOptions {
  progress: number;
  selected: readonly number[];
  order: UnfoldOrder;
  path: UnfoldPath;
  /** Display-only separation distance in normalized mesh coordinates. */
  separation: number;
  hingeWave?: boolean;
}
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };

/** Display frame only: NEVER changes, re-packs, or normalizes stored/exported UVs. */
export function atlasFrame(packed: readonly PackedChart[]): AtlasFrame {
  const min: Vec2 = [0, 0], max: Vec2 = [1, 1];
  for (const chart of packed) for (const uvs of chart.faceUVs.values()) for (const p of uvs) {
    if (!p.every(Number.isFinite)) throw new Error('UV coordinates must be finite.');
    for (let a = 0; a < 2; a++) { min[a] = Math.min(min[a]!, p[a]!); max[a] = Math.max(max[a]!, p[a]!); }
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1]);
  if (!Number.isFinite(span)) throw new Error('Unsupported UV extent.');
  return { min, max, center: [min[0] / 2 + max[0] / 2, min[1] / 2 + max[1] / 2], scale: 2.6 / span };
}
export function uvToWorld(uv: Vec2, atlas: AtlasFrame): Vec3 {
  return [(uv[0] - atlas.center[0]) * atlas.scale, (uv[1] - atlas.center[1]) * atlas.scale, 0];
}

/** Preserve an imported atlas exactly, including mirrored, overlapping and out-of-tile UVs. */
export function sourceUVPreview(mesh: MeshData, charts: UVChart[]): PackedChart[] {
  return charts.map(chart => {
    const faceUVs = new Map<number, [Vec2, Vec2, Vec2]>();
    const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const fi of chart.faces) {
      const uvs = mesh.faces[fi]?.uvs;
      if (!uvs || uvs.length !== 3 || uvs.some(p => !p || !p.every(Number.isFinite))) {
        throw new Error(`Face ${fi} has no complete finite UVs. Use the generated preview target or import a fully UV-mapped mesh.`);
      }
      const copy = uvs.map(p => [...p!] as Vec2) as [Vec2, Vec2, Vec2];
      faceUVs.set(fi, copy);
      for (const [u, v] of copy) { bounds[0] = Math.min(bounds[0], u); bounds[1] = Math.min(bounds[1], v); bounds[2] = Math.max(bounds[2], u); bounds[3] = Math.max(bounds[3], v); }
    }
    return { id: chart.id, faceUVs, bounds, polygon: [[bounds[0], bounds[1]], [bounds[2], bounds[1]], [bounds[2], bounds[3]], [bounds[0], bounds[3]]] };
  });
}

export function buildUnfoldGeometry(mesh: MeshData, packed: PackedChart[], seams: ReadonlySet<string> = new Set()): UnfoldGeometry {
  if (!mesh.positions.length || !mesh.faces.length) throw new Error('Cannot unfold an empty mesh.');
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.positions) {
    if (p.length !== 3 || !p.every(Number.isFinite)) throw new Error('Invalid mesh coordinates.');
    for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a]!, p[a]!); max[a] = Math.max(max[a]!, p[a]!); }
  }
  const span = Math.max(...min.map((v, i) => max[i]! - v));
  if (!(span > 0) || !Number.isFinite(span)) throw new Error('Unsupported mesh extent.');
  const center = min.map((v, i) => v / 2 + max[i]! / 2);
  const source = new Float32Array(mesh.faces.length * 9), target = new Float32Array(source.length), uv = new Float32Array(mesh.faces.length * 6);
  const faceChart = new Int32Array(mesh.faces.length).fill(-1);
  const atlas = atlasFrame(packed), ids = new Set<number>();
  const islands: UnfoldIsland[] = [];
  let radius = 0;
  for (const chart of packed) {
    if (!Number.isInteger(chart.id) || chart.id < 0 || chart.id > 0x7fffffff || ids.has(chart.id) || !chart.faceUVs.size) throw new Error('Invalid, duplicate, or empty UV island.');
    ids.add(chart.id);
    const cs: Vec3 = [0, 0, 0], ct: Vec3 = [0, 0, 0];
    const faces = [...chart.faceUVs.keys()];
    for (const [fi, uvs] of chart.faceUVs) {
      if (!Number.isInteger(fi) || !mesh.faces[fi] || faceChart[fi] !== -1) throw new Error(`Invalid or duplicate face ${fi} in the UV atlas.`);
      const face = mesh.faces[fi]!;
      if (face.vertices.length !== 3 || uvs.length !== 3) throw new Error('Expected triangular faces and three UV corners.');
      faceChart[fi] = chart.id;
      for (let k = 0; k < 3; k++) {
        const vi = face.vertices[k]!, p = mesh.positions[vi], q = uvs[k]!;
        if (!Number.isInteger(vi) || !p || q.length !== 2 || !q.every(Number.isFinite)) throw new Error(`Invalid corner on face ${fi}.`);
        const dst = uvToWorld(q, atlas);
        for (let a = 0; a < 3; a++) {
          const s = (p[a]! - center[a]!) / span * 2;
          source[fi * 9 + k * 3 + a] = s; target[fi * 9 + k * 3 + a] = dst[a]!;
          cs[a] += s; ct[a] += dst[a]!;
        }
        uv.set(q, fi * 6 + k * 2);
      }
    }
    for (let a = 0; a < 3; a++) { cs[a] /= faces.length * 3; ct[a] /= faces.length * 3; }
    const length = Math.hypot(...cs);
    const direction: Vec3 = length > 1e-7 ? cs.map(x => x / length) as Vec3 : [Math.cos(chart.id * 2.399963), .5, Math.sin(chart.id * 2.399963)];
    const dl = Math.hypot(...direction);
    for (let a = 0; a < 3; a++) direction[a] /= dl;
    islands.push({ id: chart.id, faces, sourceCenter: cs, targetCenter: ct, direction });
  }
  if (faceChart.some(id => id < 0)) throw new Error('The UV atlas does not cover every mesh face.');
  for (let i = 0; i < source.length; i += 3) radius = Math.max(radius, Math.hypot(source[i]!, source[i + 1]!, source[i + 2]!), Math.hypot(target[i]!, target[i + 1]!, target[i + 2]!));
  const topology = buildTopology(mesh), boundaries: number[] = [];
  mesh.faces.forEach((face, fi) => {
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(face.vertices[k]!, face.vertices[(k + 1) % 3]!);
      const neighbors = topology.edges.get(key)!.faces;
      // Each side has its OWN corner indices, so cut lines follow both separated pieces.
      if (seams.has(key) || neighbors.length !== 2 || neighbors.some(n => faceChart[n] !== faceChart[fi])) boundaries.push(fi * 3 + k, fi * 3 + (k + 1) % 3);
    }
  });
  const result:UnfoldGeometry={ source, target, uv, faceChart, boundaries: new Uint32Array(boundaries), islands, atlas, radius };
  result.hinge=buildHingeRig(mesh,result,seams);
  return result;
}

/** The selection order is meaningful. Unknown and repeated IDs are ignored. */
export function selectedIslands(geometry: UnfoldGeometry, ids: readonly number[]): number[] {
  const valid = new Set(geometry.islands.map(c => c.id));
  return [...new Set(ids)].filter(id => valid.has(id));
}
export function islandProgress(progress: number, index: number, count: number, order: UnfoldOrder): number {
  if (!Number.isFinite(progress)) throw new Error('Progress must be finite.');
  if (index < 0 || count < 1 || index >= count) return 0;
  const t = clamp(progress);
  return order === 'sequential' ? clamp(t * count - index) : t;
}
/** Reversible presentation morph, NOT a physical cloth simulation or a UV-solver iteration. */
export function writeUnfoldPositions(geometry: UnfoldGeometry, options: UnfoldOptions, out = new Float32Array(geometry.source.length)): Float32Array {
  if (out.length !== geometry.source.length || out.buffer === geometry.source.buffer || out.buffer === geometry.target.buffer) throw new Error('Output must be a separate, correctly sized position buffer.');
  if (!Number.isFinite(options.separation) || options.separation < 0) throw new Error('Separation must be finite and nonnegative.');
  if (!Number.isFinite(options.progress)) throw new Error('Progress must be finite.');
  const ids = selectedIslands(geometry, options.selected), ranks = new Map(ids.map((id, i) => [id, i]));
  if(options.path==='hinge')return writeHingePositions(geometry,options,ids,out);
  out.set(geometry.source);
  for (const island of geometry.islands) {
    const t = islandProgress(options.progress, ranks.get(island.id) ?? -1, ids.length, options.order);
    if (t === 0) continue;
    for (const fi of island.faces) for (let k = 0; k < 9; k++) {
      const i = fi * 9 + k, a = k % 3, s = geometry.source[i]!, d = geometry.target[i]!;
      if (t === 1) { out[i] = d; continue; }
      if (options.path === 'direct') { out[i] = s + (d - s) * smooth(t); continue; }
      const shift = island.direction[a]! * options.separation;
      const separated = s + shift;
      const flattened = d - island.targetCenter[a]! + island.sourceCenter[a]! + shift;
      out[i] = t < .2 ? s + shift * smooth(t / .2) : t < .8 ? separated + (flattened - separated) * smooth((t - .2) / .6) : flattened + (d - flattened) * smooth((t - .8) / .2);
    }
  }
  return out;
}

/** Same deterministic sRGB palette in the 2D and 3D views. */
export function islandColor(id: number): [number, number, number] {
  const h = ((id * .618033988749895 + .55) % 1 + 1) % 1, s = .63, l = .62;
  const f = (n: number) => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}

/** Export the SAME per-corner UVs used for the animation endpoint; keep source positions. */
export function meshWithPreviewUV(mesh: MeshData, packed: PackedChart[]): MeshData {
  const all = new Map<number, [Vec2, Vec2, Vec2]>(), charts=new Map<number,number>();
  for (const chart of packed) for (const [fi, uvs] of chart.faceUVs) {
    if (all.has(fi) || !mesh.faces[fi]) throw new Error('Invalid or duplicate atlas face.');
    all.set(fi, uvs);charts.set(fi,chart.id);
  }
  if (all.size !== mesh.faces.length) throw new Error('Incomplete atlas.');
  const identities=new Map<string,number>();
  const original=mesh.faces.every((f,i)=>f.uvs?.every((p,k)=>p?.every((v,a)=>v===all.get(i)![k]![a])));
  return { ...mesh, faces: mesh.faces.map((f, i) => {
    const values = all.get(i)!;
    if (values.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw new Error('Invalid UVs for export.');
    const uvIndices=values.map((p,k)=>{
      // Distinct UV islands remain distinct even when imported coordinates overlap.
      // Inside an island, do not invent a seam along every triangulation edge.
      const key=`${charts.get(i)}:${f.vertices[k]}:${p.join(',')}:${original?f.uvIndices?.[k]??'':''}`;
      let id=identities.get(key);if(id===undefined){id=identities.size;identities.set(key,id);}return id;
    }) as [number,number,number];
    return { vertices: [...f.vertices] as [number, number, number], uvs: values.map(p => [...p] as Vec2) as [Vec2, Vec2, Vec2],uvIndices };
  }) };
}
