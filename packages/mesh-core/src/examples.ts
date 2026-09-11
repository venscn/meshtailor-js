import type { MeshData, Vec3 } from './types.js';

export function makeCube(): MeshData {
  const p: Vec3[] = [
    [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
    [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]
  ];
  const quads = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[4,0,3,7]] as const;
  const faces = quads.flatMap((q) => [
    { vertices: [q[0],q[1],q[2]] as [number,number,number] },
    { vertices: [q[0],q[2],q[3]] as [number,number,number] }
  ]);
  return { name: 'Cube', positions: p, faces };
}

export function makeCylinder(segments = 16): MeshData {
  const positions: Vec3[] = [];
  for (let y of [-1,1]) for (let i=0;i<segments;i++) {
    const a = 2*Math.PI*i/segments;
    positions.push([Math.cos(a), y, Math.sin(a)]);
  }
  positions.push([0,-1,0],[0,1,0]);
  const bottomCenter = segments*2, topCenter = bottomCenter+1;
  const faces: MeshData['faces'] = [];
  for (let i=0;i<segments;i++) {
    const j=(i+1)%segments;
    const b0=i,b1=j,t0=segments+i,t1=segments+j;
    faces.push({vertices:[b0,b1,t1]},{vertices:[b0,t1,t0]});
    faces.push({vertices:[bottomCenter,b1,b0]},{vertices:[topCenter,t0,t1]});
  }
  return { name: 'Cylinder', positions, faces };
}

export function makeTorsoGrid(rows=10, cols=12): MeshData {
  const positions: Vec3[]=[];
  for(let r=0;r<=rows;r++){
    const y=-1.25+2.5*r/rows;
    const width=0.68+0.22*Math.cos(y*1.7);
    for(let c=0;c<cols;c++){
      const a=2*Math.PI*c/cols;
      const x=width*Math.cos(a);
      const z=(0.42+0.08*Math.cos(y))*Math.sin(a);
      positions.push([x,y,z]);
    }
  }
  const faces: MeshData['faces']=[];
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const n=(c+1)%cols;
    const a=r*cols+c,b=r*cols+n,d=(r+1)*cols+c,e=(r+1)*cols+n;
    faces.push({vertices:[a,b,e]},{vertices:[a,e,d]});
  }
  return {name:'Torso-like tube',positions,faces};
}
