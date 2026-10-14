import test from 'node:test';
import assert from 'node:assert/strict';
import {packInfo} from '../ci/npm-pack.mjs';
import {verifyResume} from '../ci/verify-resume.mjs';

test('npm 11 and npm 12 pack metadata retain the same verified identity',()=>{
 const p={name:'@petercjl/photocraft-own',version:'0.1.0',filename:'petercjl-photocraft-own-0.1.0.tgz',size:100,integrity:'sha512-YWJjZA==',files:[]};
 for(const output of [[p],{[p.name]:p}])assert.deepEqual(packInfo(JSON.stringify(output),p.name,p.version),p);
 for(const bad of [[],{},[p,p],[{...p,name:'other'}],[{...p,filename:'../escape.tgz'}]])assert.throws(()=>packInfo(JSON.stringify(bad),p.name,p.version),{code:'PACK_METADATA_INVALID'});
});

test('publication recovery requires both platform results and unchanged distributed code',()=>{
 const run={path:'.github/workflows/own-release.yml',event:'workflow_dispatch',status:'completed',conclusion:'failure',head_sha:'a'.repeat(40)};
 const jobs=['qa / qa (macos-15, aarch64-apple-darwin)','qa / qa (windows-latest, x86_64-pc-windows-msvc)'].map(name=>({name,conclusion:'success'})).concat({name:'publish',conclusion:'failure'});
 const artifacts=['native-macOS','native-Windows'].map(name=>({name,expired:false}));
 assert.equal(verifyResume(run,jobs,artifacts,['own/ci/npm-pack.mjs','.github/workflows/own-release.yml']),run.head_sha);
 assert.throws(()=>verifyResume(run,jobs,artifacts,['own/lib/runtime.mjs']),{code:'UNVERIFIED_RESUME'});
 assert.throws(()=>verifyResume(run,jobs.slice(1),artifacts,[]),{code:'UNVERIFIED_RESUME'});
 assert.throws(()=>verifyResume(run,jobs,[{...artifacts[0],expired:true},artifacts[1]],[]),{code:'UNVERIFIED_RESUME'});
 assert.throws(()=>verifyResume({...run,conclusion:'success'},jobs,artifacts,[]),{code:'UNVERIFIED_RESUME'});
});
