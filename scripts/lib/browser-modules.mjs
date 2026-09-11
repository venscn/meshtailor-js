/** Load already-compiled local ES modules into an offline browser page.
 * No HTTP server, CDN, substitute renderer or network permissions are required.
 * Only import locations are rewritten; implementation code is unchanged.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep, posix } from 'node:path';
export async function browserModuleSources(root){
  const modules={};
  async function walk(path){for(const e of await readdir(path,{withFileTypes:true})){const f=join(path,e.name);if(e.isDirectory())await walk(f);else if(e.name.endsWith('.js')){
    const id='/'+relative(root,f).split(sep).join('/');
    modules[id]=(await readFile(f,'utf8')).replace(/(\bfrom\s*|\bimport\s*)(['"])([^'"]+)\2/g,(match,prefix,quote,spec)=>spec.startsWith('.')?prefix+quote+posix.resolve(posix.dirname(id),spec)+quote:match);
  }}}
  await walk(root);return modules;
}
export function moduleBootstrap(sources){
  return `(()=>{const sources=${JSON.stringify(sources)},cache=new Map(),building=new Set();window.moduleURL=function build(id){if(cache.has(id))return cache.get(id);if(building.has(id))throw Error('Cyclic test import '+id);if(!sources[id])throw Error('Missing test module '+id);building.add(id);const source=sources[id].replace(/(\\bfrom\\s*|\\bimport\\s*)(['"])(\\/[^'"]+)\\2/g,(_,prefix,quote,dependency)=>prefix+quote+build(dependency)+quote);const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));cache.set(id,url);building.delete(id);return url;};return true;})()`;
}
