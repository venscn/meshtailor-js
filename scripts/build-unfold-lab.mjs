/** Bundle local compiled ES modules into one offline file. No CDN or npm runtime. */
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {classicWorkerBundle} from './lib/classic-worker-bundle.mjs';
import {compileCore} from './lib/compiled-core.mjs';
import {browserModuleSources,moduleBootstrap} from './lib/browser-modules.mjs';
const c=await compileCore();try{
  const modules=await browserModuleSources(c.output);
  modules['/lab-entry.js']=await readFile(join(c.root,'apps/unfold-lab/main.mjs'),'utf8');
  const worker=classicWorkerBundle(modules,'/apps/studio/src/workers/uv.worker.js');
  const boot=moduleBootstrap(modules)+`;window.labWorkerURL=()=>URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:'text/javascript'}));`+`;import(moduleURL('/lab-entry.js')).catch(e=>{document.getElementById('error').hidden=false;document.getElementById('error').textContent=e.stack;});`;
  const html=(await readFile(join(c.root,'apps/unfold-lab/index.html'),'utf8')).replace('<!--BOOTSTRAP-->','<script>'+boot.replace(/<\/script/gi,'<\\/script')+'</script>');
  const dest=resolve(process.argv[2]||join(c.root,'unfold-lab.html'));await writeFile(dest,html);console.log('Built '+dest+' ('+Buffer.byteLength(html)+' bytes)');
}finally{await c.cleanup();}
