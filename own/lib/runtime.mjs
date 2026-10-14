import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn,spawnSync,execFileSync} from 'node:child_process';
import semver from 'semver';
import {pkg,packageRoot,ID,platform,paths,fail,read,rejectLinks,exclusive,replaceBacked,locked,requireYes,progress,digest} from './common.mjs';
import {validateManifest,assetFile,unpack,registryVersion} from './assets.mjs';

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
    if(current?.version===m.version&&current.buildCommit===v.buildCommit&&(!current.headless||headless)){
      const active=activeRuntime(p);await verifyRuntime(active.root,active.record,{desktop:!current.headless});return {ok:true,unchanged:true,...current};
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
      const next={schema:1,identity:ID,version:m.version,upstreamVersion:v.upstreamVersion,upstreamCommit:v.upstreamCommit,buildCommit:v.buildCommit,active:id,headless,installedAt:new Date().toISOString(),previous:current};
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
  const errors=[];let runtime=null,nativeVersion=null,sessions=[];
  try{runtime=activeRuntime(p);nativeVersion=await verifyRuntime(runtime.root,runtime.record,{desktop:!runtime.state.headless});}catch(e){errors.push({code:e.code||'INVALID_RUNTIME',message:e.message});}
  try{sessions=leases(p);}catch(e){errors.push({code:'INVALID_SESSION',message:e.message});}
  const pending=pendingTransactions(p);
  if(fs.existsSync(p.lock))errors.push({code:'BUSY',message:'Managed operation lock exists'});
  if(pending.length)errors.push({code:'RECOVERY_REQUIRED',message:'Inspect interrupted transaction records before another install'});
  return {ok:errors.length===0,managerVersion:pkg.version,platform,supported:['darwin-arm64','win32-x64'].includes(platform),installed:runtime?.state||null,nativeVersion,paths:p,lock:fs.existsSync(p.lock),pendingTransactions:pending,sessions,errors};
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
export async function updateCheck({channel='latest',p=paths()}={}) {const latest=await registryVersion(channel),s=readState(p);return {ok:true,managerInstalled:pkg.version,managerAvailable:latest.version,runtimeInstalled:s?.version||null,runtimeAvailable:latest.photocraftOwnManifest?.version||null,available:!s||semver.gt(latest.version,s.version),channel};}
export async function updateInstall({yes=false,channel='latest',p=paths()}={}) {
  requireYes(yes);const latest=await registryVersion(channel);
  if(!latest.photocraftOwnManifest)fail('MANIFEST_UNAVAILABLE','This npm version has no runtime manifest');
  return install({yes,manifest:latest.photocraftOwnManifest,p});
}
