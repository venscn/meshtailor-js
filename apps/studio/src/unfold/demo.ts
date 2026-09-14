import { makeCube, type MeshData } from '@meshtailor/mesh-core';
import { generateGeometricSeams, buildGenerationFrames } from '@meshtailor/runtime';
import { buildCharts, planarPackPreview, meshWithPreviewUV } from '@meshtailor/uv';
/** Small deterministic, genuinely six-island demo. No external asset or model. */
export function makeUnfoldDemo(){
  const original=makeCube();
  const result=generateGeometricSeams(original,{structuralRings:0});
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
