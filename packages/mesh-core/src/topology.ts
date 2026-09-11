import { edgeKey, type EdgeRecord, type MeshData, type MeshTopology } from './types.js';

export function buildTopology(mesh: MeshData): MeshTopology {
  const edges = new Map<string, EdgeRecord>();
  const neighbors = Array.from({ length: mesh.positions.length }, () => new Set<number>());
  const faceNeighbors = Array.from({ length: mesh.faces.length }, () => new Set<number>());

  mesh.faces.forEach((face, fi) => {
    const [a, b, c] = face.vertices;
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const key = edgeKey(u, v);
      let rec = edges.get(key);
      if (!rec) {
        rec = { key, a: Math.min(u, v), b: Math.max(u, v), faces: [] };
        edges.set(key, rec);
      }
      rec.faces.push(fi);
      neighbors[u]!.add(v);
      neighbors[v]!.add(u);
    }
  });

  for (const edge of edges.values()) {
    if (edge.faces.length === 2) {
      const [f0, f1] = edge.faces;
      faceNeighbors[f0]!.add(f1!);
      faceNeighbors[f1!]!.add(f0!);
    }
  }

  const boundaryEdges = new Set<string>();
  for (const [key, edge] of edges) if (edge.faces.length === 1) boundaryEdges.add(key);

  return {
    edges,
    neighbors: neighbors.map((s) => [...s].sort((a, b) => a - b)),
    faceNeighbors: faceNeighbors.map((s) => [...s].sort((a, b) => a - b)),
    boundaryEdges
  };
}

export function validateManifold(mesh: MeshData): { manifold: boolean; nonManifoldEdges: string[] } {
  const topology = buildTopology(mesh);
  const nonManifoldEdges = [...topology.edges.values()].filter((e) => e.faces.length > 2).map((e) => e.key);
  return { manifold: nonManifoldEdges.length === 0, nonManifoldEdges };
}
