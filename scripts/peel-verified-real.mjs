/** Runs only the repository's corrected SHA-pinned fixtures. No network. */
import{spawnSync}from'node:child_process';import{fileURLToPath}from'node:url';
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i<0?d:process.argv[i+1];};
const noSource=process.argv.includes('--geometry-only');
const result=spawnSync(process.execPath,[fileURLToPath(new URL('./verified-models-smoke.mjs',import.meta.url)),'--models',arg('--models','examples/verified-models'),'--mode','generated','--out',arg('--out','validation/local-peel'),'--asset',arg('--asset','Corset,FlightHelmet'),'--export','--snapshots','--config',JSON.stringify({initialSegmentation:'hierarchical',peelSourceHints:!noSource,postMerge:false,timeBudgetMs:240000})],{stdio:'inherit'});
if(result.error)throw result.error;process.exitCode=result.status??1;
