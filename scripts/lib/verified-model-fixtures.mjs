/** Exact user-corrected fixtures, not a general glTF loader or a Three mock.
 * Parses only the uncompressed, static indexed triangle format present in the
 * four pinned files. Production topology assembly/welding is used unchanged.
 * Other glTF layouts must go through the application's real GLTFLoader.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export const CORRECT_ARCHIVE_SHA256='284decae81fda986f3c291bf4bebee473221b4eabe7078c65ed44adaf9ffb563';
export const FIXTURES={
 Corset:{json:'1aaa7fa54731ca833c3a0f919ba82c1af2a69cc7f8de36ba76bfb5038de8bd38',bin:'de7730fb4201466603410dc1a7128bc1339e945a945dbb852f6dc39f3c53ec22',bytes:662184},
 FlightHelmet:{json:'c94a08a28305fb49a612cf273330a04e3dfc084306257d52dc00b4447eeb1091',bin:'9e623a27f837e1cc995d1380da5fd3becf4d29586fefba882fc0ba76b49f94bf',bytes:3227148}
};
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function loadVerifiedFixture(core,folder,name,options={}){
 const expected=FIXTURES[name];if(!expected)throw new Error('Unknown verified fixture');
 const json=await readFile(join(folder,name,`${name}.gltf`)),bin=await readFile(join(folder,name,`${name}.bin`));
 if(hash(json)!==expected.json||hash(bin)!==expected.bin||bin.length!==expected.bytes)throw new Error(`${name}: file identity mismatch. Only the corrected user archive is accepted; no fallback to older files.`);
 const doc=JSON.parse(json),view=new DataView(bin.buffer,bin.byteOffset,bin.length);
 if(doc.asset.version!=='2.0'||doc.buffers.length!==1||doc.buffers[0].byteLength!==bin.length||doc.extensionsRequired?.length||doc.skins?.length||doc.animations?.length)throw new Error('Unsupported verified fixture layout');
 const accessor=(id,type)=>{
  const a=doc.accessors[id],v=doc.bufferViews[a.bufferView];
  if(!a||!v||a.type!==type||a.sparse||a.normalized||v.buffer!==0||v.extensions)throw new Error('Unexpected accessor');
  const width={SCALAR:1,VEC2:2,VEC3:3}[type],size={5123:2,5125:4,5126:4}[a.componentType];
  if(!width||!size)throw new Error('Unsupported accessor scalar');
  const start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??width*size;
  if(start+(a.count-1)*stride+width*size>(v.byteOffset??0)+v.byteLength)throw new Error('Accessor bounds');
  const get=a.componentType===5126?'getFloat32':a.componentType===5123?'getUint16':'getUint32';
  return Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,k)=>view[get](start+i*stride+k*size,true)));
 };
 const parts=[];
 for(const ni of doc.scenes[doc.scene??0].nodes){
  const n=doc.nodes[ni];if(n.children?.length||n.skin!==undefined||n.weights||n.matrix)throw new Error('Unsupported fixture node');
  const q=n.rotation??[0,0,0,1],s=n.scale??[1,1,1],t=n.translation??[0,0,0];
  const transform=p=>{const [x,y,z]=p.map((x,i)=>x*s[i]),[a,b,c,w]=q;const tx=2*(b*z-c*y),ty=2*(c*x-a*z),tz=2*(a*y-b*x);return [x+w*tx+b*tz-c*ty+t[0],y+w*ty+c*tx-a*tz+t[1],z+w*tz+a*ty-b*tx+t[2]];};
  for(const primitive of doc.meshes[n.mesh].primitives){
   if((primitive.mode??4)!==4||primitive.targets||primitive.extensions||primitive.indices===undefined)throw new Error('Unsupported primitive');
   const positions=accessor(primitive.attributes.POSITION,'VEC3').map(transform),uv=options.geometryOnly?undefined:accessor(primitive.attributes.TEXCOORD_0,'VEC2'),ids=accessor(primitive.indices,'SCALAR').flat(),faces=[];
   if(ids.length%3||uv&&uv.length!==positions.length)throw new Error('Bad primitive counts');
   const mid=primitive.material,mat=doc.materials[mid],pid=parts.length;
   for(let i=0;i<ids.length;i+=3){const tri=ids.slice(i,i+3);if(s[0]*s[1]*s[2]<0)[tri[1],tri[2]]=[tri[2],tri[1]];if(tri.some(v=>v>=positions.length))throw new Error('Index bounds');faces.push({vertices:tri,...(uv?{uvs:tri.map(v=>uv[v].slice())}:{}),uvSpace:`material:${mid}`,uvSpaceName:mat.name||`Material ${mid+1}`,sourcePart:`object:${pid}`});}
   parts.push({name:n.name,positions,faces});
  }
 }
 const result=core.assembleMeshParts(parts,name,{weld:'boundary',relativeTolerance:5e-7});
 return {...result,identity:{archiveSHA256:CORRECT_ARCHIVE_SHA256,jsonSHA256:hash(json),binarySHA256:hash(bin),binaryBytes:bin.length,decoder:'exact static fixture decoder + production assembleMeshParts; not GLTFLoader E2E'}};
}
