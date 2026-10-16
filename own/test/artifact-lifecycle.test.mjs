import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {read,paths,exclusive,platform,pkg} from '../lib/common.mjs';
import {runtimeIdentity,updateStatus,identityHash,assertManifestBinding} from '../lib/runtime-identity.mjs';
import {install,activeRuntime,readState,updateInstall,updateCheck} from '../lib/runtime.mjs';
import {nativeInput,fingerprint} from '../ci/native-inputs.mjs';
import {execFileSync} from 'node:child_process';
import {planRelease,verifyPublishedBinding} from '../ci/release-plan.mjs';
const manifest=read(new URL('../release.json',import.meta.url)),host='darwin-arm64';
const compatibility={managerContract:1,nativeContract:1},current={fingerprint:'a',policyHash:'b'};
const binding={schema:1,...current,artifactVersion:manifest.version,manifestHash:identityHash(manifest),sourceCommit:manifest.platforms[host].buildCommit,registryVersion:'0.1.1',sourceRun:'38837291938',compatibility};
const candidate={version:'0.1.2',manifest,binding,current,compatibility};
test('manager version and native identity update independently',()=>{
 const record={...manifest.platforms[host],version:manifest.version,platform:host};
 let s=updateStatus('0.1.1',{version:'0.1.2',photocraftOwnManifest:manifest},record,host);
 assert.equal(s.managerUpdateAvailable,true);assert.equal(s.runtimeUpdateAvailable,false);
 const changed=structuredClone(manifest);changed.version='0.1.2';s=updateStatus('0.1.2',{version:'0.1.2',photocraftOwnManifest:changed},record,host);assert.equal(s.managerUpdateAvailable,false);assert.equal(s.runtimeUpdateAvailable,true);
 assert.equal(runtimeIdentity(record),runtimeIdentity({...record,headless:true,installedAt:'ignored'}));
});
test('reuse requires identical native inputs, policy, manifest and compatibility',()=>{
 assert.equal(planRelease(candidate).mode,'manager');
 for(const patch of [{current:{...current,fingerprint:'changed'}},{current:{...current,policyHash:'changed'}},{binding:null},{compatibility:{managerContract:2,nativeContract:1}},{manifest:{...manifest,version:'0.1.0'}}]){
  assert.equal(planRelease({...candidate,...patch}).mode,'native');
  assert.throws(()=>planRelease({...candidate,...patch,mode:'manager'}),/UNVERIFIED_REUSE/);
 }
 assert.equal(planRelease({...candidate,mode:'native',runtimeVersion:'0.2.0'}).runtimeVersion,'0.2.0');
 assert.equal(planRelease({...candidate,runtimeVersion:'0.2.0'}).mode,'native');
 assert.throws(()=>planRelease({...candidate,mode:'manager',runtimeVersion:'0.2.0'}),/explicit native/);
 assert.throws(()=>planRelease({...candidate,mode:'native',runtimeVersion:'0.2.0-next.0'}),/Stable manager/);
 assert.throws(()=>planRelease({...candidate,mode:'native',runtimeVersion:'0.1.0'}),/advance/);
});
test('published proof rejects missing native jobs, wrong SHA and registry tampering',async()=>{
 const run={path:'.github/workflows/own-release.yml',status:'completed',conclusion:'success',head_sha:binding.sourceCommit};
 const jobs=['(macos-15, aarch64-apple-darwin)','(windows-latest, x86_64-pc-windows-msvc)'].map(x=>({name:'qa / qa '+x,conclusion:'success'}));
 const registry=async()=>({photocraftOwnManifest:manifest}),api=p=>p.includes('/jobs?')?{jobs}:run;
 await verifyPublishedBinding(binding,manifest,{registry,api});
 await assert.rejects(verifyPublishedBinding(binding,manifest,{registry:async()=>({photocraftOwnManifest:{}}),api}),/mismatch/);
 await assert.rejects(verifyPublishedBinding(binding,manifest,{registry,api:p=>p.includes('/jobs?')?{jobs:jobs.slice(0,1)}:run}),/platform QA/);
 await assert.rejects(verifyPublishedBinding(binding,manifest,{registry,api:p=>p.includes('/jobs?')?{jobs}:{...run,head_sha:'0'.repeat(40)}}),/provenance/);
});
test('classification preserves recipe, locks, assets and unknown inputs; excludes manager/docs',()=>{
 for(const name of ['Cargo.lock','assets/font.ttf','new-toolchain.cfg','own/ci/unknown-build.mjs','own/new-native-resource.bin','own/ci/build.mjs','own/upstream.json','own/lib/assets.mjs'])assert.equal(nativeInput(name,'changed'),'changed');
 for(const name of ['own/skills/photocraft-own/SKILL.md','own/lib/runtime-identity.mjs','own/ci/release-plan.mjs','docs/guide.md','.github/workflows/own-release.yml'])assert.equal(nativeInput(name,'changed'),null);
 const lock={version:'0.1.1',packages:{'':{version:'0.1.1',dependencies:{tar:'1'}}}};const a=nativeInput('own/package-lock.json',JSON.stringify(lock));lock.version='0.1.2';lock.packages[''].version='0.1.2';assert.equal(nativeInput('own/package-lock.json',JSON.stringify(lock)),a);lock.packages[''].dependencies.tar='2';assert.notEqual(nativeInput('own/package-lock.json',JSON.stringify(lock)),a);
 const recipe='jobs:\n  qa:\n    run: cargo build';assert.equal(nativeInput('.github/workflows/own-build.yml','on: push\n'+recipe),recipe);assert.notEqual(nativeInput('.github/workflows/own-build.yml',recipe+' changed'),recipe);
});
test('manager-only update preserves legacy state and headless runtime while desktop lease is live',{skip:!process.env.PHOTOCRAFT_TEST_MANIFEST},async()=>{
 const file=process.env.PHOTOCRAFT_TEST_MANIFEST,m=read(file),p=paths({root:path.join(fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pc-identity-')),'managed')});
 await install({yes:true,manifest:m,assetDir:path.dirname(file),headless:true,p});
 // Legacy states lack artifactId; a manager upgrade must not force migration/activation.
 const state=read(p.state);delete state.artifactId;fs.writeFileSync(p.state,JSON.stringify(state));
 exclusive(path.join(p.manager,'sessions/desktop.json'),{pid:process.pid,kind:'desktop'});
 const before=fs.readFileSync(p.state),record=activeRuntime(p).record;
 const resolve=async()=>({version:'9.0.0',photocraftOwnManifest:m});
 const status=await updateCheck({p,resolve});assert.equal(status.runtimeUpdateAvailable,false);assert.equal(status.managerUpdateAvailable,true);
 const result=await updateInstall({yes:true,p,resolve});assert.equal(result.unchanged,true);assert.equal(result.downloadBytes,0);assert.deepEqual(result.transfer,[]);assert.deepEqual(fs.readFileSync(p.state),before);assert.equal(readState(p).headless,true);assert.equal(runtimeIdentity(record),runtimeIdentity(activeRuntime(p).record));
 const changed=structuredClone(m);changed.platforms[platform].executables.cli.sha256='0'.repeat(64);
 await assert.rejects(install({yes:true,manifest:changed,headless:true,p}),e=>e.code==='APP_RUNNING');
});

test('Git input fingerprint ignores manager commits and distinguishes raw unknown binary inputs',()=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pc-fingerprint-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const put=(name,data)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data);};
 const commit=()=>{git('add','.');git('commit','-m','fixture');return fingerprint(root).fingerprint;};
 git('init');git('config','user.name','QA');git('config','user.email','qa@example.invalid');
 put('native.rs','fn main() {}');put('own/lib/skills.mjs','manager one');const original=commit();
 put('own/lib/skills.mjs','manager two');assert.equal(commit(),original);
 put('own/unknown.bin',Buffer.from([0xff]));const first=commit();assert.notEqual(first,original);
 put('own/unknown.bin',Buffer.from([0xfe]));assert.notEqual(commit(),first);
 put('own/ci/build.mjs','changed recipe');assert.notEqual(commit(),first);
});

test('npm embedded binding must match the packaged native manifest exactly',()=>{
 assertManifestBinding(structuredClone(manifest),manifest);
 assert.throws(()=>assertManifestBinding({...manifest,version:'9.0.0'},manifest),{code:'INVALID_MANIFEST_BINDING'});
});
