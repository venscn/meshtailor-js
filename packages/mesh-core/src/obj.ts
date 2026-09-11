import type { MeshData, MeshFace, Vec2, Vec3 } from './types.js';

/** Small deterministic OBJ parser that keeps UV indices per face corner. */
export function parseOBJ(text: string, name = 'uploaded.obj'): MeshData {
  const positions: Vec3[] = [];
  const texcoords: Vec2[] = [];
  const faces: MeshFace[] = [];

  const resolveIndex = (raw: string, length: number): number => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n === 0) throw new Error(`Invalid OBJ index: ${raw}`);
    return n > 0 ? n - 1 : length + n;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'v' && parts.length >= 4) {
      positions.push([Number(parts[1]), Number(parts[2]), Number(parts[3])]);
    } else if (parts[0] === 'vt' && parts.length >= 3) {
      texcoords.push([Number(parts[1]), Number(parts[2])]);
    } else if (parts[0] === 'f' && parts.length >= 4) {
      const corners = parts.slice(1).map((token) => {
        const [vRaw, vtRaw] = token.split('/');
        return {
          v: resolveIndex(vRaw!, positions.length),
          uvIndex: vtRaw ? resolveIndex(vtRaw, texcoords.length) : null,
          uv: vtRaw ? texcoords[resolveIndex(vtRaw, texcoords.length)] ?? null : null
        };
      });
      // Fan triangulation for polygons.
      for (let i = 1; i < corners.length - 1; i++) {
        const tri = [corners[0]!, corners[i]!, corners[i + 1]!] as const;
        faces.push({
          vertices: [tri[0].v, tri[1].v, tri[2].v],
          uvs: [tri[0].uv, tri[1].uv, tri[2].uv],
          uvIndices: [tri[0].uvIndex, tri[1].uvIndex, tri[2].uvIndex]
        });
      }
    }
  }

  if (!positions.length || !faces.length) throw new Error('OBJ contains no triangle geometry.');
  return { name, positions, faces };
}

/** Export corner UVs without inventing seams on every triangle.
 * Original OBJ UV identities remain distinct even when coordinates overlap.
 */
export function meshToOBJ(mesh: MeshData): string {
  const out: string[] = [`# ${mesh.name}`], uvLines:string[]=[], faceLines:string[]=[];
  for (const p of mesh.positions) out.push(`v ${p[0]} ${p[1]} ${p[2]}`);
  const uvMap=new Map<string,number>();
  for(const f of mesh.faces){
    const corners=f.vertices.map((vertex,corner)=>{
      const uv=f.uvs?.[corner];if(!uv)return String(vertex+1);
      const source=f.uvIndices?.[corner];
      const key=source!==null&&source!==undefined?`source:${source}:${uv[0]},${uv[1]}`:`value:${uv[0]},${uv[1]}`;
      let index=uvMap.get(key);
      if(index===undefined){index=uvMap.size+1;uvMap.set(key,index);uvLines.push(`vt ${uv[0]} ${uv[1]}`);}
      return `${vertex+1}/${index}`;
    });
    faceLines.push('f '+corners.join(' '));
  }
  return [...out,...uvLines,...faceLines].join('\n')+'\n';
}
