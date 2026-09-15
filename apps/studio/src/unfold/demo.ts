import { makeCube, type MeshData } from '@meshtailor/mesh-core';
import { generateGeometricSeams, buildGenerationFrames } from '@meshtailor/runtime';
import { buildCharts, planarPackPreview, meshWithPreviewUV } from '@meshtailor/uv';
/** Small deterministic, genuinely six-island demo. No external asset or model. */
export function makeUnfoldDemo(){
  const original=makeCube();
  // A teaching fixture with a promised six-panel layout must not inherit the
  // production auto-segmentation policy; cube dihedrals define its six sides.
  const result=generateGeometricSeams(original,{strategy:'legacy',structuralRings:0});
  const packed=planarPackPreview(original,buildCharts(original,result.seamEdges));
  const mesh=meshWithPreviewUV(original,packed);mesh.name='Six-island correspondence cube';
  return {mesh,edges:result.seamEdges,chains:result.chains,frames:buildGenerationFrames(mesh,result.chains)};
}

/** Three genuinely bent, developable ribbons. Unlike the cube's already-flat
 * faces, these visibly articulate around interior edges before atlas packing. */
export function makeHingeDemo(): ReturnType<typeof makeUnfoldDemo> {
  const positions: [number,number,number][]=[],faces:MeshData['faces']=[];
  for(let part=0;part<3;part++){
    const start=positions.length,angles=[0,Math.PI*.43,-Math.PI*.25,Math.PI*.3];let x=-1.3,z=0;
    for(let i=0;i<=angles.length;i++){
      positions.push([x,part*1.4-.5,z],[x,part*1.4+.5,z]);
      if(i<angles.length){x+=Math.cos(angles[i]!)*.9;z+=Math.sin(angles[i]!)*.9;}
    }
    for(let i=0;i<angles.length;i++){
      const a=start+i*2,b=a+2;faces.push({vertices:[a,b,b+1],uvs:[[i/4,0],[(i+1)/4,0],[(i+1)/4,1]]},{vertices:[a,b+1,a+1],uvs:[[i/4,0],[(i+1)/4,1],[i/4,1]]});
    }
  }
  const mesh:MeshData={name:'Hinge ribbons · 折角铰链示例',positions,faces};
  return {mesh,edges:new Set(),chains:[],frames:[]};
}

/** Deliberately fragmented/overlapped source UVs, NOT Corset or FlightHelmet.
 * The underlying sheets are connected; UV identities split every triangle. */
export function makeFragmentationDemo(parts=1):ReturnType<typeof makeUnfoldDemo> {
  const positions:MeshData['positions']=[],faces:MeshData['faces']=[];
  for(let part=0;part<parts;part++){
    const base=positions.length;for(let y=0;y<=1;y++)for(let x=0;x<=3;x++)positions.push([x,part*2+y,Math.sin(x*.5)*.3]);
    for(let x=0;x<3;x++)for(const [indices,uvs]of [ [[x,x+1,x+5],[[0,0],[1,0],[1,1]]], [[x,x+5,x+4],[[0,0],[1,1],[0,1]]] ] as const){
      const fi=faces.length;faces.push({vertices:indices.map(v=>v+base) as [number,number,number],uvs:uvs.map(v=>[...v]) as [[number,number],[number,number],[number,number]],uvIndices:[fi*3,fi*3+1,fi*3+2],uvSpace:'intentional-stack',uvSpaceName:'故意重叠的测试 UV',sourcePart:`sheet-${part}`});
    }
  }
  return {mesh:{name:'Overlapped fragmented sheets · 合成测试片',positions,faces},edges:new Set(),chains:[],frames:[]};
}

/** A four-triangle saddle has angle excess at its center: the rigid hinge net
 * overlaps while its supplied diamond UV is valid. A teaching fixture, not a real asset. */
export function makeOverlapDemo(): ReturnType<typeof makeUnfoldDemo> {
  const positions:MeshData['positions']=[[0,0,0],[1,0,1],[0,1,-1],[-1,0,1],[0,-1,-1]];
  const points:[number,number][]=[[.5,.5],[1,.5],[.5,1],[0,.5],[.5,0]];
  const indices:[number,number,number][]=[[0,1,2],[0,2,3],[0,3,4],[0,4,1]];
  const mesh:MeshData={name:'Saddle hinge overlap · 马鞍铰链重叠示例',positions,faces:indices.map(vertices=>({vertices,uvs:vertices.map(i=>[...points[i]!]) as [[number,number],[number,number],[number,number]]}))};
  return {mesh,edges:new Set(),chains:[],frames:[]};
}
