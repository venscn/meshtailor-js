/** Package a worker's static module graph for offline file:// use.
 * TypeScript changes module syntax only; the real worker/solver code is not replaced.
 */
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
export function classicWorkerBundle(sources,entry){
  let ts;try{ts=require('typescript');}catch{const p=spawnSync('npm',['root','-g'],{encoding:'utf8',shell:process.platform==='win32'});ts=require(join(p.stdout.trim(),'typescript'));}
  const visited=new Set(),wrappers=[];
  function visit(id){if(visited.has(id))return;visited.add(id);const s=sources[id];if(s===undefined)throw Error('Missing worker dependency '+id);
    for(const m of s.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\/[^'"]+)['"]/g))visit(m[1]);
    const js=ts.transpileModule(s,{fileName:id+'.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    wrappers.push(JSON.stringify(id)+':function(module,exports,require){\n'+js+'\n}');
  }visit(entry);
  return `(()=>{const factories={${wrappers.join(',\n')}},cache={};function require(id){if(cache[id])return cache[id].exports;const fn=factories[id];if(!fn)throw Error('Missing offline worker module '+id);const m={exports:{}};cache[id]=m;fn(m,m.exports,require);return m.exports;}require(${JSON.stringify(entry)});})();`;
}
