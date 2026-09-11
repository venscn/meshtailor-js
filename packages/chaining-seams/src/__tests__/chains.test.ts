import { describe, expect, it } from 'vitest';
import { makeCylinder, edgeKey } from '@meshtailor/mesh-core';
import { canonicalOrder, traceSeamChains } from '../index.js';

describe('ChainingSeams',()=>{
  it('traces a closed ring',()=>{
    const mesh=makeCylinder(8);
    const seam=new Set<string>();
    for(let i=0;i<8;i++) seam.add(edgeKey(i,(i+1)%8));
    const chains=traceSeamChains(mesh,seam);
    expect(chains).toHaveLength(1);
    expect(chains[0]!.closed).toBe(true);
    expect(chains[0]!.vertices[0]).toBe(chains[0]!.vertices.at(-1));
  });
  it('orders loops before opens',()=>{
    const mesh=makeCylinder(8);
    const loop={id:'loop',vertices:[0,1,2,3,4,5,6,7,0],closed:true};
    const open={id:'open',vertices:[0,8],closed:false};
    expect(canonicalOrder(mesh,[open,loop])[0]!.closed).toBe(true);
  });
});
