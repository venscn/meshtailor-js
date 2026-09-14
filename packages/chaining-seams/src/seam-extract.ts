import { buildTopology, edgeKey, type MeshData, type Vec2 } from '@meshtailor/mesh-core';

export type SeamEdgeSet = Set<string>;

function uvAtVertex(mesh: MeshData, faceIndex: number, vertex: number): { uv: Vec2 | null; uvIndex: number | null } {
  const face = mesh.faces[faceIndex]!;
  const corner = face.vertices.indexOf(vertex);
  return corner >= 0 ? { uv: face.uvs?.[corner] ?? null, uvIndex: face.uvIndices?.[corner] ?? null } : { uv: null, uvIndex: null };
}

function uvDifferent(a: Vec2, b: Vec2, eps: number): boolean {
  return Math.abs(a[0] - b[0]) > eps || Math.abs(a[1] - b[1]) > eps;
}

/** Paper Appendix A.1: shared edge is a seam if endpoint UVs are not glued across incident faces. */
export function extractSeamEdgesFromUV(mesh: MeshData, epsilon = 1e-6): SeamEdgeSet {
  const topology = buildTopology(mesh);
  const seams = new Set<string>();
  for (const edge of topology.edges.values()) {
    if (edge.faces.length !== 2) continue;
    const [f0, f1] = edge.faces;
    if ((mesh.faces[f0!]!.uvSpace ?? 'default') !== (mesh.faces[f1!]!.uvSpace ?? 'default')) {
      seams.add(edgeKey(edge.a, edge.b)); continue;
    }
    const a0 = uvAtVertex(mesh, f0!, edge.a), a1 = uvAtVertex(mesh, f1!, edge.a);
    const b0 = uvAtVertex(mesh, f0!, edge.b), b1 = uvAtVertex(mesh, f1!, edge.b);
    if (!a0.uv || !a1.uv || !b0.uv || !b1.uv) continue;
    const indexSplit = (a0.uvIndex !== null && a1.uvIndex !== null && a0.uvIndex !== a1.uvIndex) ||
      (b0.uvIndex !== null && b1.uvIndex !== null && b0.uvIndex !== b1.uvIndex);
    if (indexSplit || uvDifferent(a0.uv, a1.uv, epsilon) || uvDifferent(b0.uv, b1.uv, epsilon)) seams.add(edgeKey(edge.a, edge.b));
  }
  return seams;
}
