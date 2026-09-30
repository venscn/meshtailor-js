/** Unnamed generated fixtures for geometry-only tests. Row indices never enter
 * the production recogniser; variants permute them and reverse diagonals. */
export function lathedFixture(profile,segments=48,{alternating=false,phase=0,ellipse=1}={}){
 const positions=[],faces=[];
 for(const[r,y]of profile)for(let i=0;i<segments;i++){const a=phase+2*Math.PI*i/segments;positions.push([r*Math.cos(a)*ellipse,y,r*Math.sin(a)]);}
 for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
  const a=j*segments+i,b=(j+1)*segments+i,c=(j+1)*segments+(i+1)%segments,d=j*segments+(i+1)%segments;
  faces.push(...(alternating&&(i+j)%2?[{vertices:[a,b,d]},{vertices:[b,c,d]}]:[{vertices:[a,b,c]},{vertices:[a,c,d]}]));
 }
 return{name:'anonymous',positions,faces};
}
export function permuteGeometry(mesh){
 const ids=mesh.positions.map((_,i)=>i).sort((a,b)=>((a*2654435761)>>>0)-((b*2654435761)>>>0)),reverse=new Map(ids.map((v,i)=>[v,i]));
 return{name:'renumbered',positions:ids.map(i=>[...mesh.positions[i]]),faces:[...mesh.faces].reverse().map(f=>({vertices:f.vertices.map(v=>reverse.get(v))}))};
}
export function rigidVariant(mesh,s=1){
 const a=.71,b=.38;
 return{name:'not-an-assembly',faces:mesh.faces.map(f=>({vertices:[...f.vertices]})),positions:mesh.positions.map(([x,y,z])=>{const X=x*Math.cos(a)-y*Math.sin(a),Y=x*Math.sin(a)+y*Math.cos(a);return[s*(X*Math.cos(b)+z*Math.sin(b))+2,s*Y-3,s*(-X*Math.sin(b)+z*Math.cos(b))+.5];})};
}
export const bevelProfile=[[.5,-.16],[.475,-.13],[.45,-.1],[.45,0],[.45,.1],[.475,.13],[.5,.16]];
export const flangeProfile=[[.3,.12],[.42,.12],[.45,.06],[.44,.01],[.7,0],[.9,-.04],[.9,-.12]];
