#!/usr/bin/env node
/** Restore optional computed OBJ examples already stored in this package's Git.
 * No network, npm dependency, solver execution, or changes to source data.
 */
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, renameSync, existsSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--out')) {
  console.error('Usage: node scripts/restore-result-examples.mjs [--out <directory>]');
  process.exit(2);
}
const destination=args.length ? resolve(args[1]) : join(root,'results','v0.4.18');
const reference='repack-0.4.18-1';
const entries=['organized/Corset-organized.obj','organized/FlightHelmet-organized.obj',
               'fill/Corset-filled.obj','fill/FlightHelmet-filled.obj'];
try {
  execFileSync('git',['rev-parse','--verify',`${reference}^{commit}`],{cwd:root,stdio:'pipe'});
  // Read everything first, so missing Git objects never produce a partial example set.
  const data=entries.map(name=>({name,bytes:execFileSync('git',['show',`${reference}:results/v0.4.18/${name}`],
    {cwd:root,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']})}));
  for(const {name,bytes} of data){
    const target=join(destination,name);mkdirSync(dirname(target),{recursive:true});
    const temporary=target+'.restore-partial';
    writeFileSync(temporary,bytes);renameSync(temporary,target);
    console.log(`${name}: ${bytes.length} bytes; sha256=${createHash('sha256').update(bytes).digest('hex')}`);
  }
  console.log(`Restored from the included Git history to: ${destination}`);
} catch(error){
  console.error('Cannot restore examples. Git CLI and the included .git directory are required. No download was attempted.');
  console.error(error.message);process.exitCode=1;
}
