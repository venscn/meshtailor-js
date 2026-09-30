"""Independent geometric QA of exported tube OBJ; not a JS runtime dependency."""
import argparse, hashlib, json, pathlib
import numpy as np
import shapely
from shapely import STRtree
p=argparse.ArgumentParser();p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--result',type=pathlib.Path,action='append',required=True);p.add_argument('--report',type=pathlib.Path,required=True);a=p.parse_args()
def read(path):
    v=[];t=[];f=[];u=[]
    for line in path.read_text().splitlines():
        if line.startswith('v '):v.append([float(x) for x in line.split()[1:4]])
        elif line.startswith('vt '):t.append([float(x) for x in line.split()[1:3]])
        elif line.startswith('f '):
            corners=[x.split('/') for x in line.split()[1:]];assert len(corners)==3
            f.append([int(c[0])-1 for c in corners]);u.append([t[int(c[1])-1] for c in corners])
    return np.array(v),np.array(f),np.array(u)
v0,f0,_=read(a.source);reports=[]
for path in a.result:
    v,f,t=read(path);assert np.array_equal(v,v0) and np.array_equal(f,f0)
    polys=shapely.polygons(t);pairs=STRtree(polys).query(polys);pairs=pairs[:,pairs[0]<pairs[1]];overlap=0;largest=0.
    for k in range(0,pairs.shape[1],8192):
        x,y=pairs[:,k:k+8192];areas=shapely.area(shapely.intersection(polys[x],polys[y]));overlap+=int(np.count_nonzero(areas>1e-14));largest=max(largest,float(areas.max(initial=0.)))
    signed=(t[:,1,0]-t[:,0,0])*(t[:,2,1]-t[:,0,1])-(t[:,1,1]-t[:,0,1])*(t[:,2,0]-t[:,0,0]);assert np.all(signed>0) and overlap==0
    assert np.isfinite(t).all() and t.min()>=.003-1e-8 and t.max()<=.997+1e-8
    r={'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'faces':len(f),'sourcePositionsAndFaceOrderUnchanged':True,'positiveOrientation':True,'positiveOverlapPairs':overlap,'maximumIntersectionArea':largest,'candidatePairs':int(pairs.shape[1]),'occupancy':float(shapely.area(polys).sum())};reports.append(r);print(r,flush=True)
a.report.parent.mkdir(parents=True,exist_ok=True);a.report.write_text(json.dumps({'engine':'Shapely '+shapely.__version__,'areaTolerance':1e-14,'results':reports},indent=2))
