/** Unequal left/right tessellation, shared geometric centre edge. */
export function unequalSheet(curved=true){const positions=[],faces=[],center=[];for(let j=0;j<=10;j++){center.push(positions.length);positions.push([0,j/5-1,0]);}
 for(const[sign,N]of[[-1,5],[1,13]]){const grid=center.map(v=>[v]);for(let j=0;j<=10;j++)for(let i=1;i<=N;i++){const x=sign*i/N,y=j/5-1;grid[j].push(positions.length);positions.push([x,y,curved?.25*x*x*(1+.7*y)+.12*y*y*y:0]);} // center must agree in z
 for(let j=0;j<=10;j++)positions[center[j]][2]=curved?.12*(j/5-1)**3:0;
 for(let j=0;j<10;j++)for(let i=0;i<N;i++){const a=grid[j][i],b=grid[j][i+1],d=grid[j+1][i],e=grid[j+1][i+1];const ts=(i+j)%2?[[a,b,d],[b,e,d]]:[[a,b,e],[a,e,d]];for(const t of ts)faces.push({vertices:sign>0?t:[t[0],t[2],t[1]]});}}
 return{name:'unequal tessellation',positions,faces};}
