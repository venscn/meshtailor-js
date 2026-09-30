"""Independent QA of actual exported triangles; not a runtime dependency."""
import argparse, gzip, hashlib, json, pathlib, time
import numpy as np
import shapely
from shapely import STRtree
p=argparse.ArgumentParser();p.add_argument('--root',type=pathlib.Path,required=True);p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--generated-only',action='store_true');a=p.parse_args()
def obj(path):
    text=(gzip.decompress(path.read_bytes()).decode() if path.suffix=='.gz' else path.read_text())
    v=[];f=[];uv=[];ts=[]
    for l in text.splitlines():
        z=l.split()
        if not z:continue
        if z[0]=='v':v.append([float(x) for x in z[1:4]])
        elif z[0]=='vt':uv.append([float(x) for x in z[1:3]])
        elif z[0]=='f':
            r=[x.split('/') for x in z[1:]];assert len(r)==3
            f.append([int(x[0])-1 for x in r]);ts.append([uv[int(x[1])-1] for x in r])
    return np.array(v),np.array(f),np.array(ts)
report={'engine':'Shapely '+shapely.__version__,'areaTolerance':1e-14,'scope':'Independent verification of exported OBJ; geometry compared against previous generated geometry, not source UV used to generate.','files':[]}
for name in ['Corset','FlightHelmet']:
    old=pathlib.Path('examples/generated-0.4.25')/(name+'-generated.obj.gz');v0,f0,_=obj(old)
    for path in ([a.root/(name+'-generated.obj')] if a.generated_only else [a.root/'real'/name/(name+'-generated.obj'),a.root/'postprocess'/(name+'-postprocessed.obj')]):
        start=time.monotonic();v,f,t=obj(path);assert np.array_equal(v,v0) and np.array_equal(f,f0),'Geometry changed'
        ab=t[:,1]-t[:,0];ac=t[:,2]-t[:,0];signed=ab[:,0]*ac[:,1]-ab[:,1]*ac[:,0];assert np.all(signed>0)
        ps=shapely.polygons(t);pairs=STRtree(ps).query(ps);pairs=pairs[:,pairs[0]<pairs[1]];count=0;largest=0.
        for k in range(0,pairs.shape[1],4096):
            i,j=pairs[:,k:k+4096];area=shapely.area(shapely.intersection(ps[i],ps[j]));count+=int((area>1e-14).sum());largest=max(largest,float(area.max(initial=0)))
        assert count==0,(path,count,largest);assert np.isfinite(t).all() and t.min()>=.003-1e-8 and t.max()<=.997+1e-8
        row={'file':str(path.relative_to(a.root)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'faces':len(f),'positiveOverlaps':count,'largestIntersectionArea':largest,'candidatePairs':pairs.shape[1],'occupancy':float(signed.sum()/2),'geometryUnchanged':True,'seconds':time.monotonic()-start};print(row,flush=True);report['files'].append(row)
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(report,indent=2))
