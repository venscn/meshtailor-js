import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {compileCore} from './lib/compiled-core.mjs';
const c=await compileCore(),report={suite:'UV worker client lifecycle (fake transports)',cases:[]};
try{
 const {startUVJob}=await c.load('apps/studio/src/unfold/uv-job-client.js');
 const job={mesh:{positions:[],faces:[]},edges:[],target:'generated'};
 const fake=()=>({terminated:0,onmessage:null,onerror:null,onmessageerror:null,postMessage(){},terminate(){this.terminated++;},send(data){this.onmessage?.({data});}});
 const check=async(name,fn)=>{await fn();report.cases.push({name,passed:true});};
 await check('Progress does not settle the job; snapshot terminates once',async()=>{const w=fake(),p=[];const h=startUVJob(job,{createWorker:()=>w,onProgress:x=>p.push(x)});w.send({type:'progress',progress:{stage:'pack',detail:'packing',elapsedMs:2}});assert.equal(w.terminated,0);w.send({ok:true,snapshot:{token:7}});assert.deepEqual(await h.result,{token:7});assert.equal(p.length,1);h.cancel();assert.equal(w.terminated,1);});
 await check('Silent Worker startup expires',async()=>{const w=fake(),h=startUVJob(job,{createWorker:()=>w,timeoutMs:200,startupTimeoutMs:10});await assert.rejects(h.result,e=>e.code==='startup');assert.equal(w.terminated,1);});
 await check('Progress heartbeat cannot keep a runaway job alive forever',async()=>{const w=fake(),h=startUVJob(job,{createWorker:()=>w,timeoutMs:20});w.send({type:'progress',progress:{detail:'stuck phase',stage:'pack'}});await assert.rejects(h.result,e=>e.code==='timeout'&&e.message.includes('stuck phase'));assert.equal(w.terminated,1);});
 await check('Cancel rejects promise, terminates Worker, ignores late snapshot',async()=>{const w=fake(),h=startUVJob(job,{createWorker:()=>w});const late=w.onmessage;h.cancel();late({data:{ok:true,snapshot:{stale:true}}});await assert.rejects(h.result,e=>e.code==='cancelled');assert.equal(w.terminated,1);});
 for(const event of ['onerror','onmessageerror'])await check(event+' is terminal and releases transport',async()=>{const w=fake(),h=startUVJob(job,{createWorker:()=>w});w[event]({message:'failure'});await assert.rejects(h.result,e=>e.code==='worker');assert.equal(w.terminated,1);});
 await check('Construction error becomes a rejected job',async()=>{const h=startUVJob(job,{createWorker:()=>{throw Error('blocked');}});await assert.rejects(h.result,/blocked/);});
 await check('Structured-clone/postMessage error terminates the Worker',async()=>{const w=fake();w.postMessage=()=>{throw Error('clone failed');};const h=startUVJob(job,{createWorker:()=>w});await assert.rejects(h.result,/clone failed/);assert.equal(w.terminated,1);});
 await check('Protocol error fails instead of leaving a spinner',async()=>{const w=fake(),h=startUVJob(job,{createWorker:()=>w});w.send({unexpected:true});await assert.rejects(h.result,e=>e.code==='worker');assert.equal(w.terminated,1);});
 await check('Worker deadline error retains its timeout classification',async()=>{const w=fake(),h=startUVJob(job,{createWorker:()=>w});w.send({ok:false,error:'budget',code:'timeout'});await assert.rejects(h.result,e=>e.code==='timeout');});
 await check('New independent job completes after the previous one was cancelled',async()=>{const a=fake(),first=startUVJob(job,{createWorker:()=>a});first.cancel();await assert.rejects(first.result);const b=fake(),next=startUVJob(job,{createWorker:()=>b});b.send({ok:true,snapshot:{new:true}});assert.deepEqual(await next.result,{new:true});});
 report.passed=report.cases.length;const i=process.argv.indexOf('--report');if(i>=0)await writeFile(process.argv[i+1],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await c.cleanup();}
