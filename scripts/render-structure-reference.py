"""Offline geometry QA visualization only. No generated UV is modified by it."""
import json,argparse,pathlib
import numpy as np
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser();p.add_argument('root',type=pathlib.Path);args=p.parse_args()
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
f=ImageFont.truetype(font,23);small=ImageFont.truetype(font,16)
colors=[(96,185,193),(237,180,73),(169,139,194),(117,181,141)]
for name in ['Corset','FlightHelmet']:
 data=json.loads((args.root/(name+'-comparison.json')).read_text());a=sorted(data['original'],key=lambda p:-p['faces']);b=sorted(data['generated'],key=lambda p:-p['faces']);cols=max(len(a),len(b));w=cols*400;h=910
 image=Image.new('RGB',(w,h),(29,32,34));d=ImageDraw.Draw(image)
 for row,charts in enumerate([a,b]):
  y0=row*430;d.text((20,y0+16),'AUTHOR UV: reference only' if row==0 else 'GEOMETRY-ONLY: current exported result',font=f,fill=(242,245,246))
  for i,pch in enumerate(charts):
   t=np.array(pch['uv']);ps=t.reshape(-1,2);center=ps.mean(0);_,axes=np.linalg.eigh((ps-center).T@(ps-center));major=axes[:,-1];minor=np.array([-major[1],major[0]]);frame=np.column_stack((minor,major)) if name=='Corset' else np.column_stack((major,minor));
   height=np.array(pch['height']).reshape(-1); vertical=(ps-center).T@(height-height.mean());vertical/=max(np.linalg.norm(vertical),1e-30);frame=np.column_stack(([vertical[1],-vertical[0]],vertical));ts=(t-center)@frame
   # Only display placement is normalized. UV triangle shape is not deformed.
   low=ts.min((0,1));high=ts.max((0,1));scale=min(350/max(1e-30,high[0]-low[0]),320/max(1e-30,high[1]-low[1]));ts=(ts-(low+high)/2)*scale
   pts=ts*np.array([1,-1])+np.array([i*400+200,y0+222]);color=colors[i%len(colors)]
   for tr in pts:d.polygon([tuple(p) for p in tr],fill=color,outline=(50,66,70),width=1)
   d.text((i*400+20,y0+388),str(pch['faces'])+' source triangles',font=small,fill=(230,235,238))
 d.text((20,865),f"Same {data['componentFaces']:,} faces, all included. Original UV never enters generation.",font=small,fill=(230,235,238))
 d.text((20,887),'Patches independently rotated/fitted for shape comparison; not an area-density comparison.',font=small,fill=(196,206,210))
 image.save(args.root/(name+'-comparison.png'))
