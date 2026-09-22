"""Independent QA only. Python/Shapely are not application dependencies."""
import argparse, pathlib, hashlib, json, time
import numpy as np
import shapely
from shapely import STRtree
p=argparse.ArgumentParser();p.add_argument('--root',required=True,type=pathlib.Path);p.add_argument('--out',required=True,type=pathlib.Path);a=p.parse_args()
report={'engine':'GEOS/Shapely '+shapely.__version__,'area_tolerance':1e-14,'assets':[]}
for name in ('Corset','FlightHelmet'):
 start=time.monotonic();root=a.root/name;path=root/(name+'-generated.obj');snap=json.loads((root/(name+'-snapshot.json')).read_text());v=[];f=[];vt=[];tri=[]
 for line in path.read_text().splitlines():
  q=line.split()
  if not q:continue
  if q[0]=='v':v.append(list(map(float,q[1:4])))
  elif q[0]=='vt':vt.append(list(map(float,q[1:3])))
  elif q[0]=='f':
   corners=[s.split('/') for s in q[1:]];assert len(corners)==3
   f.append([int(c[0])-1 for c in corners]);tri.append([vt[int(c[1])-1] for c in corners])
 assert v==snap['mesh']['positions'];assert f==[t['vertices'] for t in snap['mesh']['faces']]
 t=np.asarray(tri);assert np.isfinite(t).all();signed=(t[:,1,0]-t[:,0,0])*(t[:,2,1]-t[:,0,1])-(t[:,1,1]-t[:,0,1])*(t[:,2,0]-t[:,0,0]);assert (signed>0).all()
 polys=shapely.polygons(t);pairs=STRtree(polys).query(polys);pairs=pairs[:,pairs[0]<pairs[1]];count=0;max_area=0
 for k in range(0,pairs.shape[1],8192):
  i,j=pairs[:,k:k+8192];area=shapely.area(shapely.intersection(polys[i],polys[j]));count+=int(np.count_nonzero(area>1e-14));max_area=max(max_area,float(np.max(area,initial=0)))
 assert count==0,(name,count,max_area);assert t.min()>=.003-1e-8 and t.max()<=.997+1e-8
 r={'name':name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'faces':len(f),'positive_overlap':count,'maximum_intersection_area':max_area,'candidate_pairs':int(pairs.shape[1]),'occupancy':float(shapely.area(polys).sum()),'geometry_and_face_order_unchanged':True,'positive_winding':True,'seconds':time.monotonic()-start};report['assets'].append(r);print(r,flush=True)
 a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2))
