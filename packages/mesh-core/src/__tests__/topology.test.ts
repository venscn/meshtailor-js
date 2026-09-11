import { describe, expect, it } from 'vitest';
import { buildTopology, makeCube } from '../index.js';

describe('mesh topology', () => {
  it('builds cube adjacency', () => {
    const t = buildTopology(makeCube());
    expect(t.edges.size).toBe(18);
    expect(t.boundaryEdges.size).toBe(0);
    expect(t.neighbors[0]!.length).toBeGreaterThanOrEqual(3);
  });
});
