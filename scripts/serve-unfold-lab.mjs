/** Local-only fallback for browsers that restrict file:// workers. No dependencies. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const port=Number(process.env.PORT||4175);if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be an integer in 1..65535.');
const html=await readFile(new URL('../unfold-lab.html',import.meta.url));
const server=createServer((req,res)=>{
  if(!['/','/unfold-lab.html'].includes((req.url||'').split('?')[0])){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(html);
});
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`Hinge Lab: http://127.0.0.1:${port} (Ctrl+C to stop)`));
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>server.close());
