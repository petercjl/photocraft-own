import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {unpack} from '../lib/assets.mjs';
import {packInfo} from '../ci/npm-pack.mjs';
import {paths,exclusive,read,pkg,ID,packageRoot} from '../lib/common.mjs';
import {startupUpdate,setAutoUpdate,autoUpdatePolicy,leases,globalManagerPrefix,updateGlobalManager,syncManagedInstallation,doctor,resolveNpmCLI,runManagerProcess} from '../lib/runtime.mjs';
const manifest=read(new URL('../release.json',import.meta.url));
function fixture(){
 const base=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pc-startup-test-'));
 const prefix=path.join(base,'prefix'),root=path.join(prefix,...(process.platform==='win32'?[]:['lib']),'node_modules','@petercjl','photocraft-own');
 fs.mkdirSync(path.join(root,'bin'),{recursive:true});exclusive(path.join(root,'package.json'),{name:pkg.name,version:pkg.version});exclusive(path.join(root,'bin/photocraft-own.mjs'),'old-entry');
 const shim=path.join(prefix,process.platform==='win32'?'photocraft-own.cmd':'bin/photocraft-own');fs.mkdirSync(path.dirname(shim),{recursive:true});
 if(process.platform==='win32')exclusive(shim,'node photocraft-own.mjs');else fs.symlinkSync(path.join(root,'bin/photocraft-own.mjs'),shim);
 const p=paths({root:path.join(base,'managed')});exclusive(p.state,{identity:ID,version:manifest.version,active:'runtime-fixture',headless:true});
 const logs=[],options={p,root,prefix,host:'darwin-arm64',environment:{},log:m=>logs.push(m),resolve:async()=>({name:pkg.name,version:pkg.version,photocraftOwnManifest:manifest}),sync:async()=>({ok:true,warnings:[]})};
 return {base,p,root,prefix,shim,logs,options};
}
test('global startup eligibility excludes source/non-global trees; controls are persistent and backed up',async()=>{
 const f=fixture();assert.equal(globalManagerPrefix(f.root),f.prefix);assert.equal(globalManagerPrefix(f.base),null);
 await assert.rejects(setAutoUpdate(false,{p:f.p}),e=>e.code==='CONFIRMATION_REQUIRED');
 await setAutoUpdate(false,{yes:true,p:f.p});const enabled=await setAutoUpdate(true,{yes:true,p:f.p});assert.equal(read(enabled.backup).enabled,false);assert.equal(autoUpdatePolicy(f.p).enabled,true);
 await setAutoUpdate(false,{yes:true,p:f.p});assert.equal((await startupUpdate(f.options)).skipped,'disabled');assert.equal(leases(f.p).length,0);
});
test('active desktop and Agent sessions defer replacement without registry access',async()=>{
 for(const kind of ['desktop','exec','mcp','serve']){
  const f=fixture();exclusive(path.join(f.p.manager,'sessions','active.json'),{pid:process.pid,kind});
  const result=await startupUpdate({...f.options,resolve:async()=>{throw Error('must not access registry');}});
  assert.equal(result.skipped,'active-session');assert.equal(f.logs.length,0);result.cleanup();assert.equal(leases(f.p).length,1);
 }
});
test('offline/invalid registry checks retain installed bytes and release update lock',async()=>{
 for(const resolve of [async()=>{throw Object.assign(Error('offline'),{code:'NETWORK'});},async()=>({version:'999.0.0',photocraftOwnManifest:{}})]){
  const f=fixture(),before=fs.readFileSync(f.p.state),entry=fs.readFileSync(path.join(f.root,'bin/photocraft-own.mjs'));
  const r=await startupUpdate({...f.options,resolve});assert.ok(r.warning);assert.ok(fs.readFileSync(f.p.state).equals(before));assert.ok(fs.readFileSync(path.join(f.root,'bin/photocraft-own.mjs')).equals(entry));
  assert.equal(fs.existsSync(path.join(f.p.manager,'startup-update.lock')),false);r.cleanup();assert.equal(leases(f.p).length,0);
 }
});
test('new stable manager synchronizes then requests one fresh-entry handoff; installed versions never downgrade',async()=>{
 const f=fixture();let replaced=0,synced=0;
 const r=await startupUpdate({...f.options,resolve:async()=>({version:'9.0.0',photocraftOwnManifest:manifest}),updateManager:async(version)=>{replaced++;assert.equal(version,'9.0.0');return {sync:{warnings:[]}};}});
 assert.equal(r.relaunch,true);assert.equal(replaced,1);r.cleanup();
 const current=await startupUpdate({...f.options,managerVersion:'9.0.0',root:f.root});assert.equal(current.relaunch,true);current.cleanup();
 const same=await startupUpdate({...f.options,resolve:async()=>({version:'0.0.1',photocraftOwnManifest:manifest}),sync:async()=>{synced++;return {warnings:[]};},updateManager:async()=>{throw Error('downgrade');}});
 assert.equal(synced,1);assert.equal(same.ok,true);same.cleanup();
 const skip=await startupUpdate({...f.options,environment:{PHOTOCRAFT_OWN_AUTO_REENTRY:pkg.version}});assert.equal(skip.skipped,'disabled-or-reentry');
});
test('concurrent startup waits for updater then defers against retained operation lease',{timeout:5000},async()=>{
 const f=fixture();let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const first=startupUpdate({...f.options,sync:async()=>{entered();await gate;return {warnings:[]};}});await Promise.race([ready,first.then(()=>{throw Error('Startup returned before entering synchronization');})]);
 let finished=false;const second=startupUpdate({...f.options,lockWaitMs:1000}).then(r=>{finished=true;return r;});
 await new Promise(r=>setTimeout(r,25));assert.equal(finished,false);release();const a=await first,b=await second;
 assert.equal(b.skipped,'active-session');a.cleanup();b.cleanup();assert.equal(leases(f.p).length,0);
});
test('unknown stale lock is preserved and reported; live update timeout blocks unsafe dispatch',async()=>{
 const f=fixture(),lock=path.join(f.p.manager,'startup-update.lock');exclusive(lock,{pid:0});
 await assert.rejects(startupUpdate(f.options),e=>e.code==='RECOVERY_REQUIRED'&&e.startupBlocked);assert.equal(read(lock).pid,0);assert.ok((await doctor(f.p)).errors.some(e=>e.code==='RECOVERY_REQUIRED'));
 fs.unlinkSync(lock);exclusive(lock,{pid:process.pid});await assert.rejects(startupUpdate({...f.options,lockWaitMs:0}),e=>e.code==='BUSY'&&e.startupBlocked);assert.equal(read(lock).pid,process.pid);
});
test('failed npm replacement restores and probes the old package and shim from a recoverable backup',async()=>{
 const f=fixture();let probes=0;
 await assert.rejects(updateGlobalManager('9.0.0',{...f,run:async(_exe,args)=>{
  if(args.includes('install')){fs.writeFileSync(path.join(f.root,'package.json'),JSON.stringify({name:pkg.name,version:'broken'}));fs.unlinkSync(path.join(f.root,'bin/photocraft-own.mjs'));throw Error('injected npm interruption');}
  probes++;assert.equal(fs.readFileSync(path.join(f.root,'bin/photocraft-own.mjs'),'utf8'),'old-entry');return {stdout:JSON.stringify({manager:pkg.version})};
 }}),/injected npm interruption/);
 assert.equal(probes,1);assert.equal(read(path.join(f.root,'package.json')).version,pkg.version);assert.equal(globalManagerPrefix(f.root),f.prefix);
 const dirs=fs.readdirSync(path.join(f.p.manager,'manager-backups'));assert.equal(dirs.length,1);assert.equal(read(path.join(f.p.manager,'manager-backups',dirs[0],'receipt.json')).previous,pkg.version);
});
test('updated manager entry is verified before synchronization; copy edits and removed targets remain preserved',async()=>{
 const f=fixture(),calls=[];
 const r=await updateGlobalManager('9.0.0',{...f,run:async(_exe,args)=>{calls.push(args);if(args.includes('install'))return {stdout:''};if(args.at(-1)==='version')return {stdout:'{"manager":"9.0.0"}'};return {stdout:'{"ok":true,"warnings":[]}'}}});
 assert.equal(r.version,'9.0.0');assert.equal(calls.length,3);assert.ok(calls[0].includes('--ignore-scripts'));assert.deepEqual(calls[2].slice(1),['update','sync','--yes']);
 const target=path.join(f.base,'host-skills','photocraft-own');fs.mkdirSync(target,{recursive:true});exclusive(path.join(target,'SKILL.md'),'local edit');
 exclusive(path.join(f.p.manager,'skills','known.json'),{package:pkg.name,target,mode:'copy'});
 exclusive(path.join(f.p.manager,'skills','removed.json'),{package:pkg.name,target:path.join(f.base,'removed','photocraft-own'),mode:'copy'});
 const sync=await syncManagedInstallation({p:f.p,installRuntime:async o=>{assert.equal(o.headless,true);return {unchanged:true,downloadBytes:0};},installSkill:async()=>{throw Object.assign(Error('keep edits'),{code:'LOCAL_EDITS'});}});
 assert.equal(sync.warnings.length,1);assert.equal(sync.warnings[0].code,'LOCAL_EDITS');assert.equal(fs.readFileSync(path.join(target,'SKILL.md'),'utf8'),'local edit');assert.equal(fs.existsSync(path.join(f.base,'removed')),false);
});

test('real npm startup upgrade preserves the native identity, synchronizes copied Skill and restores a failed replacement', {skip:!process.env.PHOTOCRAFT_TEST_MANIFEST},async()=>{
 const base=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pc-startup-real-'));
 const prefix=path.join(base,'prefix'),p=paths({root:path.join(base,'runtime')}),env={...process.env,PHOTOCRAFT_OWN_HOME:p.root,PHOTOCRAFT_OWN_AUTO_UPDATE:'0'};
 const execute=(exe,args,options={})=>{
  const r=spawnSync(exe,args,{cwd:packageRoot,...options,env:options.env||env,encoding:'utf8',timeout:options.timeout||120000});
  if(r.status!==0)throw Error(r.stderr+r.stdout);return {stdout:r.stdout,stderr:r.stderr};
 };
 const npm=args=>execute(process.execPath,[resolveNpmCLI(),...args]).stdout;
 const packed=packInfo(npm(['pack','--json','--pack-destination',base]),pkg.name,pkg.version);
 await unpack(path.join(base,packed.filename),path.join(base,'candidate'));
 const candidate=path.join(base,'candidate/package'),meta=path.join(candidate,'package.json');
 const next={...read(meta),version:'99.0.0'};fs.writeFileSync(meta,JSON.stringify(next,null,2));
 const artifact=packInfo(npm(['pack',candidate,'--json','--pack-destination',base]),pkg.name,'99.0.0');
 npm(['install','--global','--prefix',prefix,'--ignore-scripts','--registry','https://registry.npmjs.org',`${pkg.name}@0.1.3`]);
 const root=path.join(prefix,...(process.platform==='win32'?[]:['lib']),'node_modules','@petercjl','photocraft-own'),entry=path.join(root,'bin/photocraft-own.mjs');
 const cli=args=>JSON.parse(execute(process.execPath,[entry,...args]).stdout);
 const manifestFile=path.resolve(process.env.PHOTOCRAFT_TEST_MANIFEST);
 cli(['install','--headless','--manifest',manifestFile,'--asset-dir',path.dirname(manifestFile),'--yes']);
 const targetRoot=path.join(base,'host-skills');cli(['skill','install','--agent','codex','--target-root',targetRoot,'--copy']);
 const state=fs.readFileSync(p.state),versions=fs.readdirSync(p.versions);
 const result=await startupUpdate({p,root,managerVersion:'0.1.3',environment:{},log:()=>{},resolve:async()=>({name:pkg.name,version:'99.0.0',photocraftOwnManifest:manifest}),updateManager:(version,options)=>updateGlobalManager(version,{...options,run:async(exe,args,opts)=>{
  const selected=args.map(a=>a===`${pkg.name}@99.0.0`?path.join(base,artifact.filename):a);
  return execute(exe,selected,{...opts,env});
 }})});
 try{
  assert.equal(result.relaunch,true);assert.equal(cli(['version']).manager,'99.0.0');
  assert.equal(result.result.sync.runtime.unchanged,true);assert.equal(result.result.sync.runtime.downloadBytes,0);
  assert.ok(fs.readFileSync(p.state).equals(state));assert.deepEqual(fs.readdirSync(p.versions),versions);
  const skill=cli(['skill','status','--agent','codex','--target-root',targetRoot,'--json']);assert.equal(skill.current,true);assert.equal(skill.version,'99.0.0');
  assert.ok(fs.existsSync(path.join(skill.target,'references/queries/recover-operation.md')));
  // Execute through the new entry exactly as the one-time handoff will, with clean stdout.
  const out=path.join(base,'handoff.psd');
  execute(process.execPath,[entry,'exec','--','run','--new','{"width":32,"height":32,"background":"#204080"}','--cmd','type.create','--params','{"x":2,"y":20,"text":"New","size":12}','--out',out],{env:{...env,PHOTOCRAFT_OWN_AUTO_UPDATE:'1',PHOTOCRAFT_OWN_AUTO_REENTRY:'99.0.0'}});
  assert.ok(cli(['exec','--','info',out,'--compact']).layers.some(l=>l.kind==='Type'&&l.text.text==='New'));
 }finally{result.cleanup();}
 await assert.rejects(updateGlobalManager('100.0.0',{p,root,prefix,run:async(exe,args,opts)=>{
  if(args.includes('install')){fs.writeFileSync(path.join(root,'package.json'),'{"version":"broken"}');throw Error('real-entry rollback injection');}
  return execute(exe,args,{...opts,env});
 }}),/real-entry rollback injection/);
 assert.equal(cli(['version']).manager,'99.0.0');assert.equal(globalManagerPrefix(root),prefix);assert.ok(fs.readFileSync(p.state).equals(state));
});

test('cancelling a manager child stops dispatch and removes signal handlers',{timeout:5000},async()=>{
 const counts=['SIGINT','SIGTERM'].map(s=>process.listenerCount(s));
 const child=runManagerProcess(process.execPath,['-e','setInterval(()=>{},1000)']);
 assert.equal(process.listenerCount('SIGTERM'),counts[1]+1);process.emit('SIGTERM');
 await assert.rejects(child,e=>e.code==='UPDATE_CANCELLED'&&e.startupBlocked&&e.exitCode===143);
 assert.deepEqual(['SIGINT','SIGTERM'].map(s=>process.listenerCount(s)),counts);
});

test('unsupported native host returns promptly without entering synchronization',async()=>{
 const f=fixture();let synced=false;
 const result=await startupUpdate({...f.options,host:'linux-x64',sync:async()=>{synced=true;throw Error('unsupported');}});
 assert.equal(result.warning,'PLATFORM_UNAVAILABLE');assert.equal(synced,false);assert.equal(fs.existsSync(path.join(f.p.manager,'startup-update.lock')),false);result.cleanup();
});
