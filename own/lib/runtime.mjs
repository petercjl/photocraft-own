import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import semver from 'semver';
import {pkg,packageRoot,ID,platform,paths,fail,read,rejectLinks,exclusive,replaceBacked,locked,requireYes,progress,digest} from './common.mjs';
import {validateManifest,assetFile,unpack,registryVersion} from './assets.mjs';
import {runtimeIdentity,updateStatus} from './runtime-identity.mjs';
import {skillInstall} from './skills.mjs';

export function executablePaths(host=platform) {
  return host==='darwin-arm64'?{cli:'bin/photocraft-cli',desktop:'PhotoCraft Own.app/Contents/MacOS/PhotoCraft Own'}:{cli:'bin/photocraft-cli.exe',desktop:'desktop/photocraft-own.exe'};
}
export function readState(p=paths()) {
  rejectLinks(p.state);if(!fs.existsSync(p.state))return null;
  const s=read(p.state);
  if(s.identity!==ID||!semver.valid(s.version)||!s.active||!/^runtime-[\w.-]+$/.test(s.active))fail('INVALID_STATE','Unrecognized managed installation');
  return s;
}
export function runtimeDir(s,p=paths()) { const dir=path.join(p.versions,s.active);rejectLinks(dir);return dir; }
export function activeRuntime(p=paths()) {
  const state=readState(p);if(!state)fail('NOT_INSTALLED','Run photocraft-own install first');
  const root=runtimeDir(state,p),record=read(path.join(root,'runtime.json'));
  if(record.identity!==ID||record.version!==state.version||record.platform!==platform)fail('INVALID_RUNTIME','Installed runtime identity/version mismatch');
  return {state,root,record};
}
function live(pid) {if(!Number.isSafeInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}}
export function leases(p=paths()) {
  const dir=path.join(p.manager,'sessions');if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir).filter(n=>n.endsWith('.json')).map(n=>{const f=path.join(dir,n);rejectLinks(f);const s=read(f);return {...s,live:live(s.pid)};});
}
export async function verifyRuntime(root,record,{desktop=true}={}) {
  const names=executablePaths(record.platform);
  for(const role of desktop?['cli','desktop']:['cli']) {
    const f=path.join(root,names[role]);rejectLinks(f);
    if(!record.executables?.[role]||record.executables[role].path!==names[role]||!fs.existsSync(f)||!fs.statSync(f).isFile()||await digest(f)!==record.executables[role].sha256)fail('INVALID_RUNTIME',`${role} binary verification failed`);
  }
  const cli=spawnSync(path.join(root,names.cli),['--version'],{encoding:'utf8',timeout:30000});
  if(cli.status!==0||!cli.stdout.startsWith(`photocraft-cli ${record.upstreamVersion}`))fail('INVALID_RUNTIME','Native CLI version probe failed');
  return cli.stdout.trim();
}
function pendingTransactions(p) {
  return fs.existsSync(p.manager)?fs.readdirSync(p.manager).filter(n=>/^transaction-.*\.json$/.test(n)&&!n.endsWith('.complete.json')&&!n.endsWith('.failed.json')&&!fs.existsSync(path.join(p.manager,n.replace('.json','.complete.json')))&&!fs.existsSync(path.join(p.manager,n.replace('.json','.failed.json')))):[];
}
export async function install({yes=false,manifest,assetDir,channel='latest',headless=false,p=paths(),beforeActivate}={}) {
  requireYes(yes);
  if(!['darwin-arm64','win32-x64'].includes(platform))fail('UNSUPPORTED_PLATFORM',platform);
  let m=manifest;
  if(!m){const local=read(path.join(packageRoot,'release.json'));m=Object.keys(local.platforms).length?local:(await registryVersion(channel)).photocraftOwnManifest;}
  const v=validateManifest(m,platform);
  return locked(p,async()=>{
    if(pendingTransactions(p).length)fail('RECOVERY_REQUIRED','Inspect interrupted transactions before activation');
    const current=readState(p);
    if(current&&(!current.headless||headless)){
      const active=activeRuntime(p);
      if(runtimeIdentity(active.record)===runtimeIdentity({...v,version:m.version,platform})){
        await verifyRuntime(active.root,active.record,{desktop:!current.headless});
        return {ok:true,unchanged:true,...current,transfer:[],downloadBytes:0};
      }
    }
    if(leases(p).some(x=>x.live&&x.kind==='desktop'))fail('APP_RUNNING','Quit PhotoCraft Own before activating an update');
    fs.mkdirSync(p.versions,{recursive:true,mode:0o700});const id=`runtime-${m.version}-${crypto.randomUUID()}`,dest=path.join(p.versions,id),journal=path.join(p.manager,`transaction-${crypto.randomUUID()}.json`);
    exclusive(journal,{identity:ID,version:m.version,phase:'preparing',destination:dest,previous:current});
    fs.mkdirSync(dest,{mode:0o700});let activated=false;
    const transfers=[];
    try {
      for(const role of headless?['cli']:['cli','desktop']) {
        progress(`prepare ${role}`);const a=await assetFile(v.assets[role],p.cache,assetDir);transfers.push({role,...a,file:undefined});
        const part=path.join(dest,`.stage-${role}`);await unpack(a.file,part);
        for(const n of fs.readdirSync(part)) {const target=path.join(dest,n);if(fs.existsSync(target))fail('INVALID_RUNTIME','Overlapping component archive');fs.renameSync(path.join(part,n),target);}
        fs.rmdirSync(part);
      }
      const record={...v,version:m.version,platform,headless};exclusive(path.join(dest,'runtime.json'),record);
      await verifyRuntime(dest,record,{desktop:!headless});
      if(platform==='darwin-arm64'&&!headless)execFileSync('codesign',['--verify','--deep','--strict',path.join(dest,'PhotoCraft Own.app')],{stdio:'pipe'});
      await beforeActivate?.();
      const next={schema:1,artifactId:runtimeIdentity(record),identity:ID,version:m.version,upstreamVersion:v.upstreamVersion,upstreamCommit:v.upstreamCommit,buildCommit:v.buildCommit,active:id,headless,installedAt:new Date().toISOString(),previous:current};
      const backup=replaceBacked(p.state,next);activated=true;
      exclusive(journal.replace('.json','.complete.json'),{ok:true,phase:'activated',active:id,backup});
      return {ok:true,...next,runtime:dest,config:p.config,backup,transfer:transfers};
    }catch(e){exclusive(journal.replace('.json','.failed.json'),{code:e.code||'INSTALL_FAILED',message:e.message,activated,retainedRuntime:dest});throw e;}
  });
}
export async function rollback({yes=false,p=paths()}={}) {
  requireYes(yes);return locked(p,async()=>{
    if(leases(p).some(x=>x.live&&x.kind==='desktop'))fail('APP_RUNNING','Quit PhotoCraft Own before rollback');
    const s=readState(p);if(!s?.previous)fail('NO_ROLLBACK','No previous managed runtime');
    const prior=s.previous,root=runtimeDir(prior,p),record=read(path.join(root,'runtime.json'));await verifyRuntime(root,record,{desktop:!prior.headless});
    const backup=replaceBacked(p.state,{...prior,previous:null,rolledBackAt:new Date().toISOString()});return {ok:true,version:prior.version,runtime:root,backup,userImagesUntouched:true};
  });
}
export async function doctor(p=paths()) {
  const errors=[];let runtime=null,nativeVersion=null,sessions=[],startupUpdateState=null;
  try{runtime=activeRuntime(p);nativeVersion=await verifyRuntime(runtime.root,runtime.record,{desktop:!runtime.state.headless});}catch(e){errors.push({code:e.code||'INVALID_RUNTIME',message:e.message});}
  try{sessions=leases(p);}catch(e){errors.push({code:'INVALID_SESSION',message:e.message});}
  try{startupUpdateState=startupUpdateStatus(p);if(startupUpdateState.lock)errors.push({code:live(startupUpdateState.lock.pid)?'BUSY':'RECOVERY_REQUIRED',message:'Inspect the startup update lock before another update'});}catch(e){errors.push({code:e.code||'INVALID_UPDATE_POLICY',message:e.message});}
  const pending=pendingTransactions(p);
  if(fs.existsSync(p.lock))errors.push({code:'BUSY',message:'Managed operation lock exists'});
  if(pending.length)errors.push({code:'RECOVERY_REQUIRED',message:'Inspect interrupted transaction records before another install'});
  return {ok:errors.length===0,managerVersion:pkg.version,platform,supported:['darwin-arm64','win32-x64'].includes(platform),installed:runtime?.state||null,nativeVersion,paths:p,lock:fs.existsSync(p.lock),pendingTransactions:pending,sessions,startupUpdate:startupUpdateState,errors};
}
export async function runNative(args,{mode='exec',p=paths()}={}) {
  const r=activeRuntime(p);await verifyRuntime(r.root,r.record,{desktop:false});
  const child=spawn(path.join(r.root,executablePaths().cli),args,{stdio:'inherit',env:{...process.env,PHOTOCRAFT_CONFIG_DIR:p.config}});
  const lease=path.join(p.manager,'sessions',`${crypto.randomUUID()}.json`);
  if(child.pid)exclusive(lease,{pid:child.pid,kind:mode,active:r.state.active,startedAt:new Date().toISOString()});
  const forward=signal=>()=>{if(child.pid&&!child.killed)child.kill(signal);};const signals=['SIGINT','SIGTERM'];const handlers=signals.map(s=>forward(s));signals.forEach((s,i)=>process.on(s,handlers[i]));
  try{return await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve(code??(signal==='SIGINT'?130:143)));});}
  finally{signals.forEach((s,i)=>process.removeListener(s,handlers[i]));if(fs.existsSync(lease))fs.unlinkSync(lease);}
}
export async function launch(args=[],p=paths()) {
  const r=activeRuntime(p);if(r.state.headless)fail('DESKTOP_NOT_INSTALLED','Install without --headless to add the desktop');await verifyRuntime(r.root,r.record);
  fs.mkdirSync(p.config,{recursive:true,mode:0o700});const log=path.join(p.manager,`desktop-${crypto.randomUUID()}.log`),fd=fs.openSync(log,'wx',0o600);
  const child=spawn(path.join(r.root,executablePaths().desktop),args,{env:{...process.env,PHOTOCRAFT_CONFIG_DIR:p.config},stdio:['ignore',fd,fd],detached:true});fs.closeSync(fd);
  await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
  exclusive(path.join(p.manager,'sessions',`${crypto.randomUUID()}.json`),{pid:child.pid,kind:'desktop',active:r.state.active,startedAt:new Date().toISOString()});child.unref();
  return {ok:true,pid:child.pid,desktop:path.join(r.root,executablePaths().desktop),config:p.config,log};
}
export async function updateCheck({channel='latest',p=paths(),resolve=registryVersion}={}) {
  const latest=await resolve(channel),s=readState(p),record=s?activeRuntime(p).record:null;
  return {ok:true,...updateStatus(pkg.version,latest,record,platform),channel};
}
export async function updateInstall({yes=false,channel='latest',p=paths(),resolve=registryVersion}={}) {
  requireYes(yes);const latest=await resolve(channel);
  if(!latest.photocraftOwnManifest)fail('MANIFEST_UNAVAILABLE','This npm version has no runtime manifest');
  return install({yes,manifest:latest.photocraftOwnManifest,p,headless:readState(p)?.headless??false});
}

// Startup updates belong to the manager. Native executables and protocol bytes are unchanged.
export function autoUpdatePolicy(p=paths()) {
  const file=path.join(p.config,'startup-update.json');rejectLinks(file);
  const policy=fs.existsSync(file)?read(file):{schema:1,enabled:true,channel:'latest'};
  if(policy.schema!==1||typeof policy.enabled!=='boolean'||policy.channel!=='latest')fail('INVALID_UPDATE_POLICY','Inspect startup update configuration');
  return policy;
}
export async function setAutoUpdate(enabled,{yes=false,p=paths()}={}) {
  requireYes(yes);return locked(p,async()=>{
    const policy={...autoUpdatePolicy(p),enabled};
    const backup=replaceBacked(path.join(p.config,'startup-update.json'),policy);
    return {ok:true,...policy,backup};
  });
}
export function globalManagerPrefix(root=packageRoot,host=process.platform) {
  const prefix=path.resolve(root,host==='win32'?'../../..':'../../../..');
  const expected=path.join(prefix,...(host==='win32'?[]:['lib']),'node_modules','@petercjl','photocraft-own');
  if(path.resolve(root)!==expected)return null;
  const shim=path.join(prefix,host==='win32'?'photocraft-own.cmd':'bin/photocraft-own');
  if(!fs.existsSync(shim))return null;
  if(host==='win32')return fs.readFileSync(shim,'utf8').includes('photocraft-own.mjs')?prefix:null;
  return fs.realpathSync(shim)===fs.realpathSync(path.join(root,'bin/photocraft-own.mjs'))?prefix:null;
}
export function startupUpdateStatus(p=paths()) {
  const lock=path.join(p.manager,'startup-update.lock');
  return {ok:true,...autoUpdatePolicy(p),trigger:['launch','exec','mcp','serve'],globalInstall:globalManagerPrefix()!==null,environmentDisabled:process.env.PHOTOCRAFT_OWN_AUTO_UPDATE==='0',lock:fs.existsSync(lock)?{path:lock,...read(lock)}:null};
}
export function resolveNpmCLI() {
  const candidates=[process.env.npm_execpath,path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js')];
  for(const dir of (process.env.PATH||'').split(path.delimiter))candidates.push(path.join(dir,'npm'));
  for(const candidate of candidates.filter(Boolean)){
    try{const file=fs.realpathSync(candidate);if(file.endsWith(path.join('npm','bin','npm-cli.js'))&&fs.statSync(file).isFile())return file;}catch{}
  }
  fail('NPM_UNAVAILABLE','A verified npm CLI is required for manager updates');
}
export async function runManagerProcess(executable,args,options={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(executable,args,{...options,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
    child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});
    let cancelled=null,killTimer;const signals=['SIGINT','SIGTERM'];
    const handlers=signals.map(signal=>()=>{
      cancelled=signal;try{child.kill(signal);}catch{child.kill('SIGTERM');}
      // A signal delivered during exec/bootstrap can be lost or ignored. Bound cancellation.
      if(!killTimer){killTimer=setTimeout(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');},1000);killTimer.unref();}
    });
    const cleanup=()=>{clearTimeout(killTimer);signals.forEach((signal,i)=>process.removeListener(signal,handlers[i]));};
    signals.forEach((signal,i)=>process.on(signal,handlers[i]));
    child.once('error',error=>{cleanup();reject(error);});child.once('close',(code,signal)=>{
      cleanup();
      if(cancelled)reject(Object.assign(Error('Startup update cancelled; preserve the previous installation'),{code:'UPDATE_CANCELLED',startupBlocked:true,exitCode:cancelled==='SIGINT'?130:143}));
      else if(code!==0)reject(Object.assign(Error(stderr.trim()||`Update process failed (${code??signal})`),{code:'UPDATE_PROCESS_FAILED'}));
      else resolve({stdout,stderr});
    });
  });
}
export async function syncManagedInstallation({p=paths(),manifest=read(path.join(packageRoot,'release.json')),installRuntime=install,installSkill=skillInstall}={}) {
  const state=readState(p),warnings=[];
  const runtime=state?await installRuntime({yes:true,p,manifest,headless:state.headless}):{skipped:'NOT_INSTALLED'};
  const skills=[],dir=path.join(p.manager,'skills');
  if(fs.existsSync(dir))for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))){
    const file=path.join(dir,name);rejectLinks(file);const record=read(file);
    if(record.package!==pkg.name||typeof record.target!=='string'||path.basename(record.target)!=='photocraft-own')continue;
    if(!fs.existsSync(record.target))continue; // An intentionally removed target is not re-created.
    try{const result=await installSkill({agent:'codex',targetRoot:path.dirname(record.target),copy:record.mode==='copy'},p);skills.push({target:result.target,current:result.current,unchanged:result.unchanged||false});}
    catch(e){warnings.push({code:e.code||'SKILL_UPDATE_FAILED',target:record.target,message:e.message});}
  }
  return {ok:true,runtime,skills,warnings};
}
export async function updateGlobalManager(version,{p=paths(),root=packageRoot,prefix=globalManagerPrefix(root),run=runManagerProcess}={}) {
  if(!prefix||!semver.valid(version)||semver.prerelease(version))fail('UNSUPPORTED_MANAGER_UPDATE','Startup updates require an installed global stable npm package');
  const npm=resolveNpmCLI(),entry=path.join(root,'bin/photocraft-own.mjs');
  const backup=await locked(p,async()=>{
    const base=path.join(p.manager,'manager-backups',crypto.randomUUID());fs.mkdirSync(base,{recursive:true,mode:0o700});
    // Back up package bytes (including nested global dependencies) and all existing npm shims.
    rejectLinks(root);fs.statSync(root);fs.cpSync(root,path.join(base,'package'),{recursive:true,errorOnExist:true,force:false});
    const shimDir=process.platform==='win32'?prefix:path.join(prefix,'bin');
    const names=process.platform==='win32'?['photocraft-own','photocraft-own.cmd','photocraft-own.ps1']:['photocraft-own'];
    const shims=names.filter(n=>fs.existsSync(path.join(shimDir,n))).map(name=>{
      const file=path.join(shimDir,name),stat=fs.lstatSync(file);
      if(stat.isSymbolicLink())return {name,type:'link',target:fs.readlinkSync(file)};
      if(!stat.isFile())fail('UNSAFE_PATH','npm shim must be a file or symbolic link');
      fs.copyFileSync(file,path.join(base,name),fs.constants.COPYFILE_EXCL);
      return {name,type:'file',mode:stat.mode&0o777};
    });
    exclusive(path.join(base,'receipt.json'),{schema:1,package:pkg.name,previous:read(path.join(root,'package.json')).version,version,root,prefix,shims});
    const restore=()=>{
      if(fs.existsSync(root))fs.renameSync(root,path.join(path.dirname(root),`.photocraft-own-failed-${crypto.randomUUID()}`));
      fs.cpSync(path.join(base,'package'),root,{recursive:true,errorOnExist:true,force:false});
      for(const shim of shims){
        const file=path.join(shimDir,shim.name);try{fs.lstatSync(file);fs.unlinkSync(file);}catch(e){if(e.code!=='ENOENT')throw e;}
        if(shim.type==='link')fs.symlinkSync(shim.target,file,'file');
        else{fs.copyFileSync(path.join(base,shim.name),file,fs.constants.COPYFILE_EXCL);fs.chmodSync(file,shim.mode);}
      }
    };
    try{
      await run(process.execPath,[npm,'install','--global','--prefix',prefix,'--ignore-scripts','--no-audit','--no-fund','--registry','https://registry.npmjs.org','--@petercjl:registry=https://registry.npmjs.org',`${pkg.name}@${version}`],{timeout:180000,env:process.env});
      const probe=await run(process.execPath,[entry,'version'],{timeout:30000,env:{...process.env,PHOTOCRAFT_OWN_HOME:p.root}});
      if(JSON.parse(probe.stdout).manager!==version)fail('VERSION_MISMATCH','Updated manager entry reports a different version');
    }catch(e){
      try{restore();const probe=await run(process.execPath,[entry,'version'],{timeout:30000,env:{...process.env,PHOTOCRAFT_OWN_HOME:p.root}});if(JSON.parse(probe.stdout).manager!==read(path.join(base,'receipt.json')).previous)throw Error('Restored entry version mismatch');}
      catch(recovery){throw Object.assign(Error(`Manager rollback requires inspection: ${base}; ${recovery.message}`),{code:'RECOVERY_REQUIRED',startupBlocked:true});}
      throw e;
    }
    return base;
  });
  // Load the new package's binding and Skill code in a fresh process.
  const result=await run(process.execPath,[entry,'update','sync','--yes'],{timeout:300000,env:{...process.env,PHOTOCRAFT_OWN_HOME:p.root}});
  return {ok:true,version,backup,sync:JSON.parse(result.stdout)};
}
async function startupRegistry() {
  const response=await fetch('https://registry.npmjs.org/@petercjl%2fphotocraft-own/latest',{signal:AbortSignal.timeout(5000),redirect:'error'});
  if(!response.ok)fail('REGISTRY_UNAVAILABLE',`npm registry HTTP ${response.status}`);
  const latest=await response.json();if(latest.name!==pkg.name||!semver.valid(latest.version)||semver.prerelease(latest.version))fail('INVALID_MANIFEST','Startup updates require a stable package identity');
  return latest;
}
export async function startupUpdate({p=paths(),root=packageRoot,managerVersion=pkg.version,host=platform,prefix=globalManagerPrefix(root),resolve=startupRegistry,updateManager=updateGlobalManager,sync=syncManagedInstallation,sessionList=leases,log=progress,lockWaitMs=180000,environment=process.env}={}) {
  const noop=()=>{};
  if(environment.PHOTOCRAFT_OWN_AUTO_UPDATE==='0'||environment.PHOTOCRAFT_OWN_AUTO_REENTRY===managerVersion)return {skipped:'disabled-or-reentry',cleanup:noop};
  if(!prefix)return {skipped:'non-global-install',cleanup:noop};
  let fd,lease;const lock=path.join(p.manager,'startup-update.lock'),nonce=crypto.randomUUID();
  const cleanup=()=>{if(lease&&fs.existsSync(lease))fs.unlinkSync(lease);};
  try{
    if(!autoUpdatePolicy(p).enabled)return {skipped:'disabled',cleanup:noop};
    fs.mkdirSync(p.manager,{recursive:true,mode:0o700});
    const deadline=Date.now()+lockWaitMs;
    while(fd===undefined){
      try{fd=fs.openSync(lock,'wx',0o600);fs.writeSync(fd,JSON.stringify({schema:1,pid:process.pid,startedAt:new Date().toISOString()}));}
      catch(e){
        if(e.code!=='EEXIST')throw e;
        rejectLinks(lock);const prior=read(lock);
        if(!live(prior.pid))throw Object.assign(Error('Interrupted startup-update lock; inspect update auto status before recovery'),{code:'RECOVERY_REQUIRED',startupBlocked:true});
        if(Date.now()>=deadline)throw Object.assign(Error('Another startup update is still active; retry after it completes'),{code:'BUSY',startupBlocked:true});
        await new Promise(r=>setTimeout(r,100));
      }
    }
    lease=path.join(p.manager,'sessions',`startup-${nonce}.json`);
    exclusive(lease,{pid:process.pid,kind:'startup',nonce,startedAt:new Date().toISOString()});
    const diskVersion=read(path.join(root,'package.json')).version;
    if(diskVersion!==managerVersion)return {relaunch:true,version:diskVersion,cleanup};
    if(sessionList(p).some(s=>s.live&&s.nonce!==nonce))return {skipped:'active-session',cleanup};
    if(!readState(p))return {skipped:'NOT_INSTALLED',cleanup};
    const latest=await resolve();validateManifest(latest.photocraftOwnManifest,host);
    if(semver.gt(latest.version,managerVersion)){
      log(`startup update ${managerVersion} -> ${latest.version}`);
      const result=await updateManager(latest.version,{p,root,prefix});
      for(const warning of result.sync?.warnings||[])log(`startup update warning ${warning.code}: ${warning.message}`);
      return {relaunch:true,version:latest.version,result,cleanup};
    }
    // Never downgrade an installed package or use another version's unbounded runtime binding.
    const result=await sync({p});for(const warning of result.warnings||[])log(`startup update warning ${warning.code}: ${warning.message}`);
    return {ok:true,result,cleanup};
  }catch(e){
    log(`startup update ${e.code||'UNAVAILABLE'}: ${e.message}; retaining the installed version`);
    if(e.startupBlocked){cleanup();throw e;}
    // A successful npm replacement can precede a failed native/Skill synchronization.
    try{const version=read(path.join(root,'package.json')).version;if(version!==managerVersion)return {relaunch:true,version,warning:e.code||'UPDATE_FAILED',cleanup};}catch{}
    return {warning:e.code||'UPDATE_FAILED',cleanup};
  }finally{if(fd!==undefined){fs.closeSync(fd);fs.unlinkSync(lock);}}
}
export async function relayUpdatedManager(args,version,p=paths()) {
  const child=spawn(process.execPath,[path.join(packageRoot,'bin/photocraft-own.mjs'),...args],{stdio:'inherit',env:{...process.env,PHOTOCRAFT_OWN_HOME:p.root,PHOTOCRAFT_OWN_AUTO_REENTRY:version}});
  const signals=['SIGINT','SIGTERM'],handlers=signals.map(signal=>()=>{if(child.pid&&!child.killed)child.kill(signal);});
  signals.forEach((signal,i)=>process.on(signal,handlers[i]));
  try{return await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve(code??(signal==='SIGINT'?130:143)));});}
  finally{signals.forEach((signal,i)=>process.removeListener(signal,handlers[i]));}
}
