/** Deterministic FBX 7.4 regression fixture writer. NOT a production FBX exporter.
 * Supports only this test's static triangle geometry, per-corner UV0 and transforms.
 * Binary node/array layout follows the public Blender FBX format description.
 */
import {deflateSync} from 'node:zlib';
const p=(type,value)=>({type,value});
const n=(name,props=[],children=[])=>({name,props,children});
const P=(name,type,values)=>n('P',[p('S',name),p('S',type),p('S',''),p('S','A'),...values.map(v=>p(type==='int'?'I':'D',v))]);
export function fixtureTree(mesh){
  const vertices=mesh.positions.flat(),indices=mesh.faces.flatMap(f=>[f.vertices[0],f.vertices[1],-f.vertices[2]-1]);
  const uv=mesh.faces.flatMap(f=>(f.uvs??[[0,0],[0,0],[0,0]]).flatMap(x=>x??[0,0]));
  return [
    n('FBXHeaderExtension',[],[n('FBXHeaderVersion',[p('I',1003)]),n('FBXVersion',[p('I',7400)]),n('Creator',[p('S','MeshTailor-JS synthetic regression fixture')])]),
    n('GlobalSettings',[],[n('Version',[p('I',1000)]),n('Properties70',[],[P('UpAxis','int',[1]),P('UpAxisSign','int',[1]),P('FrontAxis','int',[2]),P('FrontAxisSign','int',[-1]),P('CoordAxis','int',[0]),P('CoordAxisSign','int',[1]),P('UnitScaleFactor','double',[1])])]),
    n('Definitions',[],[n('Version',[p('I',100)]),n('Count',[p('I',2)]),n('ObjectType',[p('S','Geometry')],[n('Count',[p('I',1)])]),n('ObjectType',[p('S','Model')],[n('Count',[p('I',1)])])]),
    n('Objects',[],[
      n('Geometry',[p('L',1000),p('S','Geometry::Garment'),p('S','Mesh')],[
        n('GeometryVersion',[p('I',124)]),n('Vertices',[p('d',vertices)]),n('PolygonVertexIndex',[p('i',indices)]),
        n('LayerElementUV',[p('I',0)],[n('Version',[p('I',101)]),n('Name',[p('S','UVMap')]),n('MappingInformationType',[p('S','ByPolygonVertex')]),n('ReferenceInformationType',[p('S','Direct')]),n('UV',[p('d',uv)])]),
        n('Layer',[p('I',0)],[n('Version',[p('I',100)]),n('LayerElement',[],[n('Type',[p('S','LayerElementUV')]),n('TypedIndex',[p('I',0)])])]),
      ]),
      n('Model',[p('L',2000),p('S','Model::Garment'),p('S','Mesh')],[n('Version',[p('I',232)]),n('Properties70',[],[P('Lcl Translation','Lcl Translation',[0,0,0]),P('Lcl Rotation','Lcl Rotation',[0,0,0]),P('Lcl Scaling','Lcl Scaling',[1,1,1])]),n('Shading',[p('C',1)]),n('Culling',[p('S','CullingOff')])]),
    ]),
    n('Connections',[],[n('C',[p('S','OO'),p('L',1000),p('L',2000)]),n('C',[p('S','OO'),p('L',2000),p('L',0)])]),
  ];
}
export function writeASCII(mesh){
  const prop=x=>x.type==='S'?JSON.stringify(x.value):String(x.value);
  function node(x,depth=0){const pad='\t'.repeat(depth);if(x.props.length===1&&['d','i'].includes(x.props[0].type)){const values=x.props[0].value;return `${pad}${x.name}: *${values.length} {\n${pad}\ta: ${values.join(',')}\n${pad}}\n`;}
    if(x.children.length)return `${pad}${x.name}: ${x.props.map(prop).join(', ')} {\n${x.children.map(c=>node(c,depth+1)).join('')}${pad}}\n`;
    // Three's ASCII Properties70 parser normalizes the first whitespace in a
    // value. Keep numeric tuples compact so it cannot turn a component into NaN.
    return `${pad}${x.name}: ${x.props.map(prop).join(x.name==='P'?',':', ')}\n`;
  }
  return '; FBX 7.4.0 project file\n; Generated synthetic MeshTailor-JS fixture (MIT), not downloaded model data.\n'+fixtureTree(mesh).map(x=>node(x)).join('');
}
function binaryProperty(x){
  const type=Buffer.from(x.type);
  if(x.type==='S'){const text=Buffer.from(x.value,'utf8'),size=Buffer.alloc(4);size.writeUInt32LE(text.length);return Buffer.concat([type,size,text]);}
  if(x.type==='d'||x.type==='i'){
    const stride=x.type==='d'?8:4,data=Buffer.alloc(x.value.length*stride);
    x.value.forEach((v,i)=>x.type==='d'?data.writeDoubleLE(v,i*8):data.writeInt32LE(v,i*4));
    const compressed=deflateSync(data),header=Buffer.alloc(12);header.writeUInt32LE(x.value.length,0);header.writeUInt32LE(1,4);header.writeUInt32LE(compressed.length,8);
    return Buffer.concat([type,header,compressed]);
  }
  const data=Buffer.alloc(x.type==='L'||x.type==='D'?8:x.type==='C'?1:4);
  if(x.type==='L')data.writeBigInt64LE(BigInt(x.value));else if(x.type==='D')data.writeDoubleLE(x.value);else if(x.type==='C')data.writeUInt8(x.value);else data.writeInt32LE(x.value);
  return Buffer.concat([type,data]);
}
export function writeBinary(mesh){
  function node(x,start){
    const name=Buffer.from(x.name),props=Buffer.concat(x.props.map(binaryProperty)),children=[];
    let offset=start+13+name.length+props.length;
    for(const child of x.children){const data=node(child,offset);children.push(data);offset+=data.length;}
    if(x.children.length){children.push(Buffer.alloc(13));offset+=13;}
    const header=Buffer.alloc(13);header.writeUInt32LE(offset,0);header.writeUInt32LE(x.props.length,4);header.writeUInt32LE(props.length,8);header.writeUInt8(name.length,12);
    return Buffer.concat([header,name,props,...children]);
  }
  const header=Buffer.alloc(27);Buffer.from('Kaydara FBX Binary  \0\x1a\0','binary').copy(header);header.writeUInt32LE(7400,23);
  const chunks=[header];let offset=27;
  for(const x of fixtureTree(mesh)){const data=node(x,offset);chunks.push(data);offset+=data.length;}
  chunks.push(Buffer.alloc(13));offset+=13;
  const magic=Buffer.from('fabcab09d0c8d466b176fb831cf7267e','hex');chunks.push(magic);offset+=16;
  const pad=(16-offset%16)%16;chunks.push(Buffer.alloc(pad));const version=Buffer.alloc(4);version.writeUInt32LE(7400);chunks.push(version,Buffer.alloc(120),magic);
  return Buffer.concat(chunks);
}
