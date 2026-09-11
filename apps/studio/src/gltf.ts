import { importMeshFiles } from './importers';
import type { MeshData } from '@meshtailor/mesh-core';
/** Compatibility wrapper. New code should use importMeshFiles to receive diagnostics. */
export async function loadGLTFFile(file:File):Promise<MeshData>{return (await importMeshFiles([file])).mesh;}
