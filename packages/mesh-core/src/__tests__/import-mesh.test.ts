import { describe, it, expect } from 'vitest';
import { assembleMeshParts, buildTopology, type RawMeshPart } from '../index.js';
const square = (): RawMeshPart => ({ name: 'square', positions: [[0,0,0],[1,0,0],[0,1,0],[1,0,0],[1,1,0],[0,1,0]], faces: [{vertices:[0,1,2],uvs:[[0,0],[1,0],[0,1]]},{vertices:[3,4,5],uvs:[[0,0],[1,0],[1,1]]}] });
describe('renderer topology reconstruction', () => {
  it('welds position splits but keeps per-corner UVs', () => { const {mesh,report}=assembleMeshParts([square()],'test'); expect(mesh.positions).toHaveLength(4); expect(buildTopology(mesh).boundaryEdges.size).toBe(4); expect(report.weldedVertices).toBe(2); expect(mesh.faces[1]!.uvs![0]).toEqual([0,0]); });
  it('never merges different source objects',()=>expect(assembleMeshParts([square(),square()],'parts').mesh.positions).toHaveLength(8));
  it('has an explicit no-weld mode',()=>expect(assembleMeshParts([square()],'off',{weld:'off'}).mesh.positions).toHaveLength(6));
  it('rejects non-finite and out-of-range input',()=>{ const p=square(); p.positions[0]![0]=NaN; expect(()=>assembleMeshParts([p],'bad')).toThrow(/non-finite/); });
  it('rejects oversized geometry before processing it',()=>expect(()=>assembleMeshParts([square()],'big',{maxTriangles:1})).toThrow(/limit/));
});
