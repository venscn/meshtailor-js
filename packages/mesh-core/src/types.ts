export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export interface MeshFace {
  vertices: [number, number, number];
  /** Material/texture domain, NOT a UV island. Distinct domains may share [0,1]. */
  uvSpace?: string;
  uvSpaceName?: string;
  /** Source object/instance identity, retained for import diagnostics. */
  sourcePart?: string;
  /** Optional per-corner UVs. These deliberately stay on the face so OBJ UV seams are preserved. */
  uvs?: [Vec2 | null, Vec2 | null, Vec2 | null];
  /** Optional source UV indices (OBJ), allowing detection of overlapping-but-disconnected UV islands. */
  uvIndices?: [number | null, number | null, number | null];
}

export interface MeshData {
  name: string;
  positions: Vec3[];
  faces: MeshFace[];
  normals?: Vec3[];
}

export interface EdgeRecord {
  key: string;
  a: number;
  b: number;
  faces: number[];
}

export interface MeshTopology {
  edges: Map<string, EdgeRecord>;
  neighbors: number[][];
  faceNeighbors: number[][];
  boundaryEdges: Set<string>;
}

export function edgeKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
