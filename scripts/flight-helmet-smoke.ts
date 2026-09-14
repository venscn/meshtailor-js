/** Real asset regression. Requires npm install and a cached/local GLB.
 * No synthetic stand-in and no automatic asset download. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {resolve,join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {importMeshFiles} from '../apps/studio/src/importers/index.js';
import type {UVJob,UVMessage,UVResult} from '../apps/studio/src/workers/uv.worker.js';
// @ts-ignore Dependency-light compiler helper is an existing JS module.
import {compileCore} from './lib/compiled-core.mjs';
const arg=(name:string)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const asset=arg('--asset')??'flight-helmet';
if(!['flight-helmet','corset'].includes(asset))throw new Error('--asset must be flight-helmet or corset.');
const file=resolve(arg('--file')??`apps/studio/public/assets/remote/${asset}-domains-v2.glb`);
const only=arg('--target');if(only&&!['generated','source'].includes(only))throw new Error('--target must be generated or source.');
const seconds=Number(arg('--budget-seconds')??120);if(!(seconds>=1&&seconds<=900))throw new Error('--budget-seconds must be 1..900.');
// Three's fetch progress events are a browser API missing from Node, not a loader substitute.
if(typeof globalThis.ProgressEvent==='undefined')Object.defineProperty(globalThis,'ProgressEvent',{value:class extends Event{lengthComputable=false;loaded=0;total=0;constructor(type:string,init:ProgressEventInit={}){super(type);Object.assign(this,init);}}});
const bytes=await readFile(file).catch(()=>{throw new Error(`Missing model: ${file}. First run npm run assets:download -- --only ${asset}, or pass --file <local.glb>.`);});
const {mesh,report:importReport}=await importMeshFiles([new File([new Uint8Array(bytes)],basename(file))],{weld:'boundary',relativeTolerance:5e-7});
const c=await compileCore();
const report:{asset:string;sha256:string;faces:number;vertices:number;importReport:unknown;results:unknown[]}={asset:file,sha256:createHash('sha256').update(bytes).digest('hex'),faces:mesh.faces.length,vertices:mesh.positions.length,importReport,results:[]};
try{
 for(const target of (only?[only]:['generated','source']) as ('generated'|'source')[]){
   const events:unknown[]=[],url=pathToFileURL(join(c.output,'apps/studio/src/workers/uv.worker.js')).href;
   const result=await new Promise<UVResult>((yes,no)=>{
     const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self=globalThis;self.postMessage=(d,o)=>parentPort.postMessage(d,o?.transfer);import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`,{eval:true});
     const timer=setTimeout(()=>{void worker.terminate();no(Error(`Hard test timeout (${seconds+10}s)`));},(seconds+10)*1000);
     worker.on('error',e=>{clearTimeout(timer);void worker.terminate();no(e);});
     worker.on('message',(d:UVMessage|{ready:true})=>{
       if('ready'in d){worker.postMessage({mesh,edges:[],target,config:{timeBudgetMs:seconds*1000}} satisfies UVJob);return;}
       if('type'in d){events.push(d.progress);console.error(`[${target}] ${d.progress.stage}: ${d.progress.detail} (${Math.round(d.progress.elapsedMs)} ms)`);return;}
       clearTimeout(timer);void worker.terminate();yes(d);
     });
   });
   if(!result.ok){report.results.push({target,...result,progress:events});process.exitCode=1;continue;}
   const s=result.snapshot,covered=new Set<number>();for(const chart of s.packed)for(const fi of chart.faceUVs.keys()){if(covered.has(fi))throw new Error('Duplicate source face in atlas');covered.add(fi);}
   if(covered.size!==mesh.faces.length||s.geometry.target.length!==mesh.faces.length*9||!s.geometry.target.every(Number.isFinite))throw new Error('Invalid or incomplete correspondence.');
   report.results.push({target,ok:true,islands:s.packed.length,timing:s.timing,metrics:s.metrics,fragmentation:s.fragmentation,uvSpaces:s.geometry.atlas.spaces,warnings:s.warnings,progressMessages:events.length});
 }
 console.log(JSON.stringify(report,null,2));const destination=arg('--report');if(destination)await writeFile(destination,JSON.stringify(report,null,2)+'\n');
}finally{await c.cleanup();}
