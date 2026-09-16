/** Fixed-budget, hash-pinned before/after verification of the real input models.
 * Uses the full production source-atlas Worker, not cached meshes or a mock solver.
 * Run: npm run test:fill:real -- --out validation/my-fill [--asset Corset]
 */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const get=(flag,fallback)=>{const i=process.argv.indexOf(flag);return i<0?fallback:process.argv[i+1];};
const config={fillMode:get('--mode','area-priority'),fillResolution:Number(get('--resolution',512)),fillRounds:Number(get('--rounds',4)),fillMaxTrials:Number(get('--trials',128)),fillTimeBudgetMs:Number(get('--seconds',90))*1000,timeBudgetMs:240000};
const args=[fileURLToPath(new URL('./verified-models-smoke.mjs',import.meta.url)),'--models',get('--models','examples/verified-models'),'--out',get('--out','validation/local-fill-real'),'--config',JSON.stringify(config),'--export'];
if(get('--asset'))args.push('--asset',get('--asset'));
const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;
