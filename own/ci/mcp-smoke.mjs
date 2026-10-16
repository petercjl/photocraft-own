import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import readline from 'node:readline';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function mcpSmoke(env,work){
 const cli=env.PHOTOCRAFT_SMOKE_CLI||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../bin/photocraft-own.mjs');
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
  const decode=result=>JSON.parse(result.content.filter(c=>c.type==='text').map(c=>c.text).join('\n'));
  const catalog=decode(await tool('command_list',{filter:'type.create'}));
  assert.ok(catalog.some(c=>c.id==='type.create'&&c.enabled),'Discover an enabled command in this session');
  const before=decode(await tool('doc_inspect'));
  const batch=decode(await tool('command_batch',{steps:[
   {id:'type.create',params:{x:4,y:28,text:'Recovery',size:16}},
   {id:'own.qa.nonexistent',params:{}},
   {id:'image.adjustments.invert',params:{}}
  ]}));
  assert.equal(batch.completed,1);assert.equal(batch.failed,1);assert.equal(batch.results.length,2);
  assert.equal(batch.results[0].ok,true);assert.equal(batch.results[1].ok,false);
  const after=decode(await tool('doc_inspect'));
  assert.ok(after.layers.some(l=>l.kind==='Type'&&l.text.text==='Recovery'),'Successful batch step must remain applied');
  assert.ok(after.history.length>=before.history.length,'Inspect actual history without assuming one entry per command');
  await assert.rejects(call('tools/call',{name:'command_run',arguments:{id:'image.adjustments.invert',unexpected:true}}),/32602/);
  assert.deepEqual(decode(await tool('doc_inspect')),after,'Rejected tool envelope must not execute');
  const ui=await call('tools/call',{name:'ui_inspect',arguments:{}});assert.equal(ui.isError,true,'UI requires bridge despite catalog presence');
  await tool('doc_save',{path:'mcp-recovered.pcraft'});await tool('doc_open',{path:'mcp-recovered.pcraft'});
  const reopened=decode(await tool('doc_inspect'));
  assert.equal(reopened.width,64);assert.equal(reopened.height,64);
  assert.ok(reopened.layers.some(l=>l.kind==='Type'&&l.text.text==='Recovery'),'Recoverable editable output must reopen');
  const rejected=await call('tools/call',{name:'doc_open',arguments:{path:'../outside.png'}});if(!rejected.isError)throw Error('MCP path scope escaped');return tools.tools.length;
 }finally{for(const p of pending.values())clearTimeout(p.timer);child.stdin.end();await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill();resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});});lines.close();}
}
