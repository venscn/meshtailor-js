/** Compile core packages for dependency-light tests/tools, not a UI build. */
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname,join,relative,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
export async function compileCore(){
  const root=fileURLToPath(new URL('../../',import.meta.url));
  let compiler;
  try{compiler=require.resolve('typescript/bin/tsc');}catch{const global=spawnSync('npm',['root','-g'],{encoding:'utf8',shell:process.platform==='win32'});compiler=join(global.stdout.trim(),'typescript/bin/tsc');if(global.status||!existsSync(compiler))throw new Error('Install TypeScript first: npm install.');}
  const output=await mkdtemp(join(tmpdir(),'meshtailor-tools-'));
  const cleanup=()=>rm(output,{recursive:true,force:true});
  try{
    const result=spawnSync(process.execPath,[compiler,'-p','tsconfig.smoke.json','--noEmit','false','--outDir',output],{cwd:root,encoding:'utf8'});
    if(result.status)throw new Error(result.stdout+'\n'+result.stderr);
    await writeFile(join(output,'package.json'),' {"type":"module"}\n');
    async function walk(path){for(const e of await readdir(path,{withFileTypes:true})){const file=join(path,e.name);if(e.isDirectory())await walk(file);else if(e.name.endsWith('.js')){let s=await readFile(file,'utf8');s=s.replace(/(['"])@meshtailor\/([\w-]+)\1/g,(_,quote,name)=>{let path=relative(dirname(file),join(output,'packages',name,'src/index.js')).split(sep).join('/');if(!path.startsWith('.'))path='./'+path;return quote+path+quote;});await writeFile(file,s);}}}
    await walk(output);
    return {root,output,cleanup,load:path=>import(pathToFileURL(join(output,path)).href)};
  }catch(error){await cleanup();throw error;}
}
