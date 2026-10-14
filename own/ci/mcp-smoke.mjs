import {spawn} from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function mcpSmoke(env,work){
 const cli=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/photocraft-own.mjs');
 const child=spawn(process.execPath,[cli,'mcp','--automation-read-root',work,'--automation-write-root',work],{env,stdio:['pipe','pipe','pipe']});
 let id=0,errors='';const pending=new Map();child.stderr.on('data',b=>errors+=b);const lines=readline.createInterface({input:child.stdout});
 lines.on('line',line=>{try {const msg=JSON.parse(line),p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}}catch(e){for(const p of pending.values())p.reject(e);}});
 child.on('error',e=>{for(const p of pending.values())p.reject(e);});child.on('exit',()=>{for(const p of pending.values())p.reject(Error('MCP exited: '+errors));});
 const send=msg=>child.stdin.write(JSON.stringify(msg)+'\n');
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('MCP timeout: '+errors));},30000);pending.set(n,{resolve,reject,timer});send({jsonrpc:'2.0',id:n,method,params});});
 const tool=async(name,args={})=>{const result=await call('tools/call',{name,arguments:args});if(result.isError)throw Error(JSON.stringify(result));return result;};
 try {
  await call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'photocraft-own-qa',version:'1.0'}});send({jsonrpc:'2.0',method:'notifications/initialized'});
  const tools=await call('tools/list');if(!tools.tools.some(t=>t.name==='command_run'))throw Error('Missing MCP engine tool');
  await tool('doc_new',{width:64,height:64,background:'#204080'});await tool('command_run',{id:'image.adjustments.invert'});await tool('doc_export',{path:'mcp.png'});
  const rejected=await call('tools/call',{name:'doc_open',arguments:{path:'../outside.png'}});if(!rejected.isError)throw Error('MCP path scope escaped');return tools.tools.length;
 }finally{for(const p of pending.values())clearTimeout(p.timer);child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});});lines.close();}
}
