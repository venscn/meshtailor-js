import { describe, expect, it } from 'vitest';
import { makeCube } from '@meshtailor/mesh-core';
import { fitDistance, prepareViewportMesh, viewportSize } from '../viewport-math';

describe('viewport display math', () => {
  it('normalizes only a display copy and preserves vertex IDs', () => {
    const mesh = makeCube(), before = JSON.stringify(mesh);
    const display = prepareViewportMesh(mesh);
    expect(display.positions.length).toBe(mesh.positions.length);
    expect(display.triangles.length).toBe(mesh.faces.length * 9);
    expect(JSON.stringify(mesh)).toBe(before);
  });
  it('subtracts large offsets before float32 conversion', () => {
    const mesh = makeCube();
    mesh.positions = mesh.positions.map(([x, y, z]) => [1e8 + x, 2e8 + y, 3e8 + z]);
    const display = prepareViewportMesh(mesh);
    expect([...display.triangles].every((v) => Math.abs(v) <= 1)).toBe(true);
  });
  it('uses the narrower field of view when fitting the camera', () => {
    expect(fitDistance(1, 42, .5)).toBeGreaterThan(fitDistance(1, 42, 1));
    expect(fitDistance(1, 42, 2)).toBe(fitDistance(1, 42, 1));
  });
  it('rejects nonfinite vertices and broken indices', () => {
    const mesh = makeCube(); mesh.positions[0]![0] = NaN;
    expect(() => prepareViewportMesh(mesh)).toThrow('invalid coordinates');
    const bad = makeCube(); bad.faces[0]!.vertices[0] = 999;
    expect(() => prepareViewportMesh(bad)).toThrow('missing vertex');
  });
  it('keeps CSS dimensions independent of capped device pixels', () => {
    expect(viewportSize(800, 600, 3)).toEqual({ width: 800, height: 600, dpr: 2, visible: true });
    expect(viewportSize(0, 600, 2).visible).toBe(false);
  });
});
