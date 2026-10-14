import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as tar from 'tar';
import {paths,exclusive,replaceBacked,locked,read,sha} from '../lib/common.mjs';
import {skillInstall,skillStatus,source} from '../lib/skills.mjs';
import {unpack,validateManifest,assetFile} from '../lib/assets.mjs';
import {doctor,install,readState,rollback} from '../lib/runtime.mjs';
function fixture(){const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-own-test-'));return {root,p:paths({root:path.join(root,'managed')}),options:{agent:'codex',targetRoot:path.join(root,'skills'),copy:true}};}
const code=c=>e=>e.code===c;
test('install copied Skill and update preserve UI metadata and added files',async()=>{
 const {p,options}=fixture();let s=await skillInstall(options,p);assert.equal(s.current,true);
 const ui=path.join(s.target,'agents','openai.yaml');fs.writeFileSync(ui,'display_name: Custom\n');fs.writeFileSync(path.join(s.target,'personal.txt'),'user data');
 const record=read(s.record);record.digest='old';fs.writeFileSync(s.record,JSON.stringify(record));
 s=await skillInstall(options,p);assert.equal(s.current,true);assert.equal(fs.readFileSync(ui,'utf8'),'display_name: Custom\n');assert.equal(fs.readFileSync(path.join(s.target,'personal.txt'),'utf8'),'user data');assert.ok(fs.existsSync(s.backup));
 assert.equal((await skillInstall(options,p)).unchanged,true);
 fs.appendFileSync(path.join(s.target,'SKILL.md'),'local edit');await assert.rejects(skillInstall(options,p),code('LOCAL_EDITS'));
});
test('locked-update fallback backs up and verifies managed files',async()=>{
 const {p,options}=fixture();const s=await skillInstall(options,p),record=read(s.record);record.digest='old';fs.writeFileSync(s.record,JSON.stringify(record));
 const rename=fs.renameSync;fs.renameSync=(from,to)=>{if(from===s.target)throw Object.assign(Error('locked'),{code:'EBUSY'});return rename(from,to);};
 try {const result=await skillInstall(options,p);assert.ok(result.backup);assert.equal(result.current,true);}finally{fs.renameSync=rename;}
});
test('unknown targets, missing SealSeek root, links and competing operations are refused',async()=>{
 const {p,options}=fixture(),target=path.join(options.targetRoot,'photocraft-own');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'SKILL.md'),'owned');
 await assert.rejects(skillInstall(options,p),code('UNMANAGED_TARGET'));assert.throws(()=>skillStatus({agent:'sealseek'},p),code('TARGET_ROOT_REQUIRED'));
 await locked(p,async()=>{await assert.rejects(locked(p,async()=>{}),code('BUSY'));});
 assert.equal(fs.readFileSync(path.join(target,'SKILL.md'),'utf8'),'owned');
});
test('state replacement creates recovery backup; exclusive writes refuse overwrite',()=>{
 const {root}=fixture(),file=path.join(root,'state.json');exclusive(file,{version:1});const backup=replaceBacked(file,{version:2});assert.deepEqual(read(backup),{version:1});assert.deepEqual(read(file),{version:2});assert.throws(()=>exclusive(file,{}),code('EEXIST'));
});
test('archive extraction rejects links; hash mismatch preserves input',async()=>{
 const {root}=fixture(),stage=path.join(root,'stage');fs.mkdirSync(stage);fs.writeFileSync(path.join(stage,'file'),'safe');// Construct an unsafe symbolic-link archive without requiring Windows symlink privileges.
 const header=new tar.Header({path:'link',type:'SymbolicLink',linkpath:'file',size:0,mode:0o777});header.encode();
 const archive=path.join(root,'unsafe.tgz');fs.writeFileSync(archive,Buffer.concat([header.block,Buffer.alloc(1024)]));await assert.rejects(unpack(archive,path.join(root,'out')),code('UNSAFE_ARCHIVE'));assert.equal(fs.existsSync(path.join(root,'out')),false);
 await assert.rejects(assetFile({filename:'unsafe.tgz',size:fs.statSync(archive).size,sha256:'0'.repeat(64)},path.join(root,'cache'),root),code('CHECKSUM_MISMATCH'));
});
test('doctor identifies missing runtime and interrupted transactions',async()=>{
 const {p}=fixture();exclusive(path.join(p.manager,'transaction-stale.json'),{phase:'preparing'});const d=await doctor(p);assert.equal(d.ok,false);assert.ok(d.errors.some(x=>x.code==='RECOVERY_REQUIRED'));assert.ok(d.errors.some(x=>x.code==='NOT_INSTALLED'));
});
test('managed-runtime update failure retains old active version; verified rollback', {skip:!process.env.PHOTOCRAFT_TEST_MANIFEST},async()=>{
 const {p}=fixture(),file=process.env.PHOTOCRAFT_TEST_MANIFEST,m=read(file),assetDir=path.dirname(file);await install({yes:true,p,manifest:m,assetDir});const before=readState(p);
 const next=structuredClone(m);next.version='0.1.0-next.1';await assert.rejects(install({yes:true,p,manifest:next,assetDir,beforeActivate:()=>{throw Error('injected interruption');}}),/injected interruption/);assert.equal(readState(p).active,before.active);assert.equal((await doctor(p)).ok,true);
 await install({yes:true,p,manifest:next,assetDir});assert.equal(readState(p).version,next.version);await rollback({yes:true,p});assert.equal(readState(p).active,before.active);
});
