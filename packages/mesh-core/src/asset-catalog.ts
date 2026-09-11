/** No third-party model binaries are embedded here. Licenses verified 2026-09-11.
 * Both entries use uncompressed glTF so no Draco/Meshopt installation is needed.
 */
export interface RemoteMeshAsset { id:string; name:string; source:string; url:string; license:string; licenseUrl:string; credit:string; description:string }
const repository='https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/';
const raw='https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/';
export const REMOTE_MESH_ASSETS:RemoteMeshAsset[]=[
  {id:'corset',name:'Corset · 服装人台',source:repository+'Corset',url:raw+'Corset/glTF/Corset.gltf',license:'CC0-1.0',licenseUrl:raw+'Corset/LICENSE.md',credit:'Microsoft / UX3D; distributed by KhronosGroup',description:'公开服装样例；首次使用需要联网。仅获取几何和 UV。'},
  {id:'flight-helmet',name:'Flight Helmet · 飞行头盔',source:repository+'FlightHelmet',url:raw+'FlightHelmet/glTF/FlightHelmet.gltf',license:'CC0-1.0',licenseUrl:raw+'FlightHelmet/LICENSE.md',credit:'Public / Gary Hsu (Maya conversion); distributed by KhronosGroup',description:'多部件高密度模型；约 9.5 万三角面。仅获取几何和 UV。'},
];
