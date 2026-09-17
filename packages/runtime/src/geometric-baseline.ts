import {unwrapMesh,geometryGenerationOptions,recommendUnwrap} from '@meshtailor/uv';
import { geometryOnlyMesh, type ChartGoal, type RegionOptions, buildTopology, dot3, normalize3, sub3, triangleNormal, type MeshData, type Vec3 } from '@meshtailor/mesh-core';
import { canonicalOrder, traceSeamChains, type SeamChain } from '@meshtailor/chaining-seams';

export interface GeometricBaselineOptions {
  strategy?:'adaptive'|'legacy';
  uvObjective?:'paint'|'compact';
  goal?:ChartGoal;
  regionOptions?:Partial<RegionOptions>;
  curvatureQuantile?: number;
  structuralRings?: number;
  maxEdges?: number;
}
export interface GeometricBaselineResult { seamEdges:Set<string>; chains:SeamChain[]; scores:Map<string,number>; regions?:number; mergedRegions?:number; regionOptions?:RegionOptions }

function quantile(values:number[],q:number):number{
  if(!values.length)return Infinity; const a=[...values].sort((x,y)=>x-y); const i=Math.max(0,Math.min(a.length-1,Math.floor(q*(a.length-1)))); return a[i]!;
}
function faceNormals(mesh:MeshData):Vec3[]{return mesh.faces.map((f)=>triangleNormal(mesh.positions[f.vertices[0]]!,mesh.positions[f.vertices[1]]!,mesh.positions[f.vertices[2]]!));}

/**
 * Functional fallback while official learned weights are unavailable.
 * The default is the same validated geometry-only generator as Studio.
 * The old edge-saliency heuristic remains explicitly opt-in for historical QA.
 * This is deliberately not presented as the paper's learned result.
 */
export function generateGeometricSeams(mesh:MeshData,opts:GeometricBaselineOptions={}):GeometricBaselineResult{
  mesh=geometryOnlyMesh(mesh);
  if(opts.strategy!=='legacy'){
    const recommended=recommendUnwrap(mesh,opts.goal??'large');
    const config=geometryGenerationOptions(mesh,{...recommended.options,uvObjective:opts.uvObjective??'paint'});
    const result=unwrapMesh(mesh,new Set(),config),seamEdges=new Set(result.seams);
    return {seamEdges,chains:canonicalOrder(mesh,traceSeamChains(mesh,seamEdges)),scores:new Map(),regions:result.peel?.groups.length,mergedRegions:0};
  }

  const curvatureQuantile=opts.curvatureQuantile ?? 0.82;
  const structuralRings=opts.structuralRings ?? 2;
  const topology=buildTopology(mesh); const normals=faceNormals(mesh); const scores=new Map<string,number>();
  for(const [key,e] of topology.edges){
    if(e.faces.length===2){const d=Math.max(-1,Math.min(1,dot3(normals[e.faces[0]!]!,normals[e.faces[1]!]!)));scores.set(key,1-d);}
    else scores.set(key,0.15);
  }
  const seamEdges=new Set<string>(); const threshold=quantile([...scores.values()].filter((v)=>v>1e-8),curvatureQuantile);
  for(const [key,score] of scores) if(score>=threshold && score>0.025) seamEdges.add(key);

  if(structuralRings>0){
    const mins:[number,number,number]=[Infinity,Infinity,Infinity],maxs:[number,number,number]=[-Infinity,-Infinity,-Infinity];
    for(const p of mesh.positions)for(let a=0;a<3;a++){mins[a]=Math.min(mins[a],p[a]!);maxs[a]=Math.max(maxs[a],p[a]!);}
    const spans=[maxs[0]-mins[0],maxs[1]-mins[1],maxs[2]-mins[2]]; const axis=spans.indexOf(Math.max(...spans)); const span=Math.max(1e-6,spans[axis]!);
    for(let r=0;r<structuralRings;r++){
      const fraction=(r+1)/(structuralRings+1); const target=mins[axis]!+span*fraction; const tol=span*0.035;
      for(const [key,e] of topology.edges){
        const pa=mesh.positions[e.a]!,pb=mesh.positions[e.b]!; const mid=(pa[axis]!+pb[axis]!)/2;
        const dir=normalize3(sub3(pb,pa));
        if(Math.abs(mid-target)<=tol && Math.abs(dir[axis]!)<0.22) seamEdges.add(key);
      }
    }
  }

  if(opts.maxEdges && seamEdges.size>opts.maxEdges){
    const keep=[...seamEdges].sort((a,b)=>(scores.get(b)??0)-(scores.get(a)??0)).slice(0,opts.maxEdges);
    seamEdges.clear();keep.forEach((e)=>seamEdges.add(e));
  }
  const chains=canonicalOrder(mesh,traceSeamChains(mesh,seamEdges));
  return {seamEdges,chains,scores};
}
