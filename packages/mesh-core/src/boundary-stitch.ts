import {edgeKey, type MeshFace, type Vec3} from './types.js';

export interface BoundaryStitchResult {
  faces:MeshFace[]; stitchedEdges:number; stitchedVertices:number;
  ambiguousEdges:number; rejected:boolean;
}
/** Conservative repair of numerically split render boundaries, within ONE object.
 * Only mutually unique, oppositely oriented FULL boundary edges can be paired.
 * Interior vertices and nearby unrelated points are never proximity-welded.
 * No faces are removed; invalid unions are rolled back for this object.
 */
export function stitchBoundaryPairs(positions:Vec3[],faces:MeshFace[],epsilon:number):BoundaryStitchResult {
  if(!(Number.isFinite(epsilon)&&epsilon>0))throw new Error('Invalid boundary stitch tolerance.');
  type Edge={a:number;b:number;face:number};
  const incident=new Map<string,Edge[]>();
  faces.forEach((f,fi)=>f.vertices.forEach((a,k)=>{const b=f.vertices[(k+1)%3]!,key=edgeKey(a,b),list=incident.get(key)??[];list.push({a,b,face:fi});incident.set(key,list);}));
  const boundary=[...incident.values()].filter(v=>v.length===1).map(v=>v[0]!);
  const base:BoundaryStitchResult={faces,stitchedEdges:0,stitchedVertices:0,ambiguousEdges:0,rejected:false};
  const cell=(p:Vec3)=>p.map(v=>Math.floor(v/epsilon));
  const buckets=new Map<string,number[]>();
  boundary.forEach((e,i)=>{const key=cell(positions[e.a]!).join(','),list=buckets.get(key)??[];list.push(i);buckets.set(key,list);});
  const distance=(a:number,b:number)=>Math.hypot(...positions[a]!.map((v,k)=>v-positions[b]![k]!));
  const matches:number[][]=boundary.map(()=>[]);
  boundary.forEach((e,i)=>{
    if(distance(e.a,e.b)<epsilon*10)return;
    const p=cell(positions[e.b]!);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      for(const j of buckets.get(`${p[0]!+x},${p[1]!+y},${p[2]!+z}`)??[]){
        const f=boundary[j]!;
        if(i===j||e.face===f.face||distance(e.a,f.b)>epsilon||distance(e.b,f.a)>epsilon)continue;
        // Already identical edges are not repairs. Very short features are protected.
        if(e.a===f.b&&e.b===f.a||distance(f.a,f.b)<epsilon*10)continue;
        matches[i]!.push(j);
      }
    }
  });
  base.ambiguousEdges=matches.filter(m=>m.length>1).length;
  const parent=new Map<number,number>();
  const find=(i:number):number=>{let p=parent.get(i);if(p===undefined)return i;while(parent.has(p)){p=parent.get(p)!;}let q=i;while(parent.has(q)){const next=parent.get(q)!;parent.set(q,p);q=next;}return p;};
  const join=(a:number,b:number)=>{a=find(a);b=find(b);if(a===b)return;parent.set(Math.max(a,b),Math.min(a,b));};
  boundary.forEach((e,i)=>{
    const list=matches[i]!;if(list.length!==1)return;const j=list[0]!;
    if(j<=i||matches[j]!.length!==1||matches[j]![0]!==i)return;
    const f=boundary[j]!;join(e.a,f.b);join(e.b,f.a);base.stitchedEdges++;
  });
  if(!base.stitchedEdges)return base;
  const output=faces.map(f=>({...f,vertices:f.vertices.map(find) as MeshFace['vertices']}));
  const counts=new Map<string,number>(),triangles=new Set<string>();let invalid=false;
  output.forEach((f,fi)=>{
    if(new Set(f.vertices).size!==3){invalid=true;return;}
    const tri=[...f.vertices].sort((a,b)=>a-b).join(',');
    if(triangles.has(tri))invalid=true;triangles.add(tri);
    f.vertices.forEach((a,k)=>{const b=f.vertices[(k+1)%3]!,key=edgeKey(a,b),count=(counts.get(key)??0)+1;counts.set(key,count);
      if(count>2&&(incident.get(key)?.length??0)<count)invalid=true;
    });
    // UV corners retain their original identities and positions.
    if(f.uvs!==faces[fi]!.uvs)throw new Error('Stitch changed corner UV storage.');
  });
  if(invalid)return {...base,stitchedEdges:0,stitchedVertices:0,rejected:true};
  return {...base,faces:output,stitchedVertices:parent.size};
}
