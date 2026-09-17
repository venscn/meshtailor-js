import type {MeshData, MeshFace, Vec3} from './types.js';

/** Hard boundary for automatic UV generation.
 * Explicitly copy geometry, not {...mesh}/{...face}: source UV properties can be
 * getters, and merely reading them would already violate the generation contract.
 * Material and object identities are geometry grouping metadata, not UV islands.
 * Input vertex/triangle order is kept, allowing exact source-face correspondence.
 */
export function geometryOnlyMesh(input: MeshData): MeshData {
  const positions = input.positions.map(p => [p[0], p[1], p[2]] as Vec3);
  const faces = input.faces.map(f => {
    const face: MeshFace = {vertices: [f.vertices[0], f.vertices[1], f.vertices[2]]};
    if (typeof f.sourcePart === 'string') face.sourcePart = f.sourcePart;
    if (typeof f.uvSpace === 'string') face.uvSpace = f.uvSpace;
    if (typeof f.uvSpaceName === 'string') face.uvSpaceName = f.uvSpaceName;
    return face;
  });
  // Normals are recomputed from positions when needed. Do not preserve tangents,
  // UV-dependent attributes, source island labels or unrecognized metadata.
  return {name: input.name, positions, faces};
}

export const GEOMETRY_INPUT_POLICY = 'geometry-only-v1' as const;
export type GeometryInputPolicy = typeof GEOMETRY_INPUT_POLICY;
