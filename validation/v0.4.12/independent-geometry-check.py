import json, hashlib, pathlib, time
import numpy as np
import shapely
from shapely import STRtree
import argparse
parser=argparse.ArgumentParser(description='Optional independent QA; not a JS runtime dependency.')
parser.add_argument('--root',type=pathlib.Path,required=True,help='Directory produced by test:fill:real --export with original and organized OBJ files')
root=parser.parse_args().root
report={'engine':'Independent GEOS / Shapely '+shapely.__version__,'toleranceUVArea':1e-14,'assets':{}}
def read_obj(p):
    vs=[];uv=[];faces=[];uvs=[]
    for line in p.read_text().splitlines():
        if line.startswith('v '): vs.append(tuple(map(float,line.split()[1:4])))
        elif line.startswith('vt '): uv.append(tuple(map(float,line.split()[1:3])))
        elif line.startswith('f '):
            parts=[x.split('/') for x in line.split()[1:]]
            faces.append(tuple(int(x[0])-1 for x in parts));uvs.append([uv[int(x[1])-1] for x in parts])
    return np.array(vs),np.array(faces),np.array(uvs)
for name in ['Corset','FlightHelmet']:
    start=time.monotonic();p=root/(name+'-organized.obj');v,f,t=read_obj(p);v0,f0,_=read_obj(root/(name+'-original.obj'))
    assert np.array_equal(v,v0) and np.array_equal(f,f0)
    polys=shapely.polygons(t);tree=STRtree(polys);pairs=tree.query(polys);pairs=pairs[:,pairs[0]<pairs[1]]
    count=0;ma=0.;tested=pairs.shape[1]
    for k in range(0,tested,8192):
        a,b=pairs[:,k:k+8192];areas=shapely.area(shapely.intersection(polys[a],polys[b]));count+=int(np.count_nonzero(areas>1e-14));ma=max(ma,float(np.max(areas,initial=0)))
    assert count==0,(name,count,ma)
    signed=(t[:,1,0]-t[:,0,0])*(t[:,2,1]-t[:,0,1])-(t[:,1,1]-t[:,0,1])*(t[:,2,0]-t[:,0,0]);assert np.all(signed>0)
    assert t.min()>=.003-1e-8 and t.max()<=.997+1e-8
    rep={'fileSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'triangles':len(f),'candidatePairs':tested,'positiveOverlapPairs':count,'maximumIntersectionArea':ma,'positiveOrientation':True,'geometryAndFacesUnchanged':True,'geometricOccupancy':float(shapely.area(polys).sum()),'uvMinimum':float(t.min()),'uvMaximum':float(t.max()),'seconds':time.monotonic()-start}
    report['assets'][name]=rep;print(name,rep,flush=True)
(root.parent/'independent-geometry.json').write_text(json.dumps(report,indent=2))
