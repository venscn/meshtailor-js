/** Unequal left/right tessellation, shared geometric centre edge. */
export function unequalSheet(curved=true){const positions=[],faces=[],center=[];for(let j=0;j<=10;j++){center.push(positions.length);positions.push([0,j/5-1,0]);}
 for(const[sign,N]of[[-1,5],[1,13]]){const grid=center.map(v=>[v]);for(let j=0;j<=10;j++)for(let i=1;i<=N;i++){const x=sign*i/N,y=j/5-1;grid[j].push(positions.length);positions.push([x,y,curved?.25*x*x*(1+.7*y)+.12*y*y*y:0]);} // center must agree in z
 for(let j=0;j<=10;j++)positions[center[j]][2]=curved?.12*(j/5-1)**3:0;
 for(let j=0;j<10;j++)for(let i=0;i<N;i++){const a=grid[j][i],b=grid[j][i+1],d=grid[j+1][i],e=grid[j+1][i+1];const ts=(i+j)%2?[[a,b,d],[b,e,d]]:[[a,b,e],[a,e,d]];for(const t of ts)faces.push({vertices:sign>0?t:[t[0],t[2],t[1]]});}}
 return{name:'unequal tessellation',positions,faces};}
/** Closed pillow: no side-wall template/name, unequal tessellation on both halves.
 * The two depth sheets meet at a common physical rim; all source faces survive. */
export function unequalClosedPillow(){
 const top=unequalSheet(false),positions=top.positions.map(([x,y])=>[x,y,(1-x*x)*(1-y*y)*(.22+.05*y)]),faces=[],bottom=[];
 for(let i=0;i<top.faces.length;i+=2){let a=[...top.faces[i].vertices],b=[...top.faces[i+1].vertices];
  if([a,b].some(t=>t.every(v=>Math.abs(positions[v][2])<1e-12))){const shared=a.filter(v=>b.includes(v)),x=a.find(v=>!b.includes(v)),y=b.find(v=>!a.includes(v));a=[x,y,shared[0]];b=[y,x,shared[1]];}
  for(const t of[a,b]){const[p,q,r]=t.map(v=>positions[v]);if((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])<0)[t[1],t[2]]=[t[2],t[1]];faces.push({vertices:t});}
 }
 for(let i=0,n=positions.length;i<n;i++){const[x,y,z]=positions[i];if(Math.abs(x)>=1-1e-10||Math.abs(y)>=1-1e-10)bottom[i]=i;else{bottom[i]=positions.length;positions.push([x,y,-z*.7]);}}
 for(const f of faces.slice())faces.push({vertices:[bottom[f.vertices[0]],bottom[f.vertices[2]],bottom[f.vertices[1]]]});
 return{name:'arbitrary closed surface',positions,faces};
}
