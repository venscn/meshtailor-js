"""Optional independent exported-OBJ QA. Python/Shapely are NOT app dependencies."""
import argparse,hashlib,json,pathlib,time
import numpy as np
import shapely
from shapely import STRtree
p=argparse.ArgumentParser();p.add_argument('--root',type=pathlib.Path,required=True);p.add_argument('--original-root',type=pathlib.Path,required=True);p.add_argument('--suffix',default='organized');p.add_argument('--assets',default='Corset,FlightHelmet');p.add_argument('--out',type=pathlib.Path,required=True);args=p.parse_args()
def read_obj(path):
    vs=[];uv=[];faces=[];uvs=[]
    for line in path.read_text().splitlines():
        if line.startswith('v '):vs.append(tuple(map(float,line.split()[1:4])))
        elif line.startswith('vt '):uv.append(tuple(map(float,line.split()[1:3])))
        elif line.startswith('f '):
            t=[s.split('/') for s in line.split()[1:]];assert len(t)==3
            faces.append(tuple(int(s[0])-1 for s in t));uvs.append([uv[int(s[1])-1] for s in t])
    return np.array(vs),np.array(faces),np.array(uvs)
report={'engine':'GEOS/Shapely '+shapely.__version__,'toleranceUVArea':1e-14,'assets':{}}
for name in args.assets.split(','):
    start=time.monotonic();path=args.root/(name+'-'+args.suffix+'.obj');v,f,t=read_obj(path);v0,f0,_=read_obj(args.original_root/(name+'-original.obj'))
    assert np.array_equal(v,v0) and np.array_equal(f,f0),'Source geometry changed'
    polys=shapely.polygons(t);pairs=STRtree(polys).query(polys);pairs=pairs[:,pairs[0]<pairs[1]];count=0;maximum=0.
    for k in range(0,pairs.shape[1],8192):
        a,b=pairs[:,k:k+8192];areas=shapely.area(shapely.intersection(polys[a],polys[b]));count+=int(np.count_nonzero(areas>1e-14));maximum=max(maximum,float(np.max(areas,initial=0)))
    signed=(t[:,1,0]-t[:,0,0])*(t[:,2,1]-t[:,0,1])-(t[:,1,1]-t[:,0,1])*(t[:,2,0]-t[:,0,0]);assert np.all(signed>0);assert count==0,(name,count,maximum)
    assert np.isfinite(t).all() and t.min()>=.003-1e-8 and t.max()<=.997+1e-8
    result={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'faces':len(f),'candidatePairs':pairs.shape[1],'positiveOverlapPairs':count,'maximumIntersectionArea':maximum,'occupancy':float(shapely.area(polys).sum()),'positiveOrientation':True,'unchanged3D':True,'seconds':time.monotonic()-start};report['assets'][name]=result;print(name,result,flush=True)
args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(report,indent=2))
