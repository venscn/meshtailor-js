import assert from 'node:assert/strict';import{writeFile}from'node:fs/promises';import{compileCore}from'./lib/compiled-core.mjs';
const c=await compileCore();try{const {RasterBoard,rasterShape}=await c.load('packages/uv/src/shape-raster.js');let seed=31822;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);let cases=0;
for(let k=0;k<400;k++){
 const size=[31,32,33,63,64,65,127][k%7],b=new RasterBoard(size,k%3);
 const mask=()=>{const w=1+Math.floor(rand()*Math.min(size-2,32)),h=1+Math.floor(rand()*Math.min(size-2,25));return rasterShape([[[0,0],[w/128,0],[w/128,h/128]],[[0,0],[w/128,h/128],[rand()*w/128,h/128]]],w/128,h/128,1,0,128,0)};
 for(let i=0;i<10;i++){const m=mask();if(m)b.put(m,Math.floor(rand()*(size-m.width)),Math.floor(rand()*(size-m.height)));}
 const m=mask(),x0=Math.floor(rand()*4),y0=Math.floor(rand()*4);if(!m)continue;
 let expected=null;outer:for(let y=y0;y<=size-m.height;y++)for(let x=x0;x<=size-m.width;x++)if(b.fits(m,x,y)){expected={x,y};break outer;}
 assert.deepEqual(b.findWindow(m,x0,y0,size-m.width,size-m.height),expected,`case ${k}`);cases++;
}
console.log('PASS',cases,'exact window searches match brute force including holes, gutters and word boundaries');
const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify({passed:cases,description:'Bitset run skipping compared with original fits() at every integer placement; no sampling.'},null,2));
}finally{await c.cleanup()}
