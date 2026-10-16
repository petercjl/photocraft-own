import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cli=path.resolve(import.meta.dirname,'../bin/photocraft-own.mjs');
test('managed subcommand help works before installation and has no side effects',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'photocraft-help-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const managed=path.join(root,'not-installed');
  for(const args of [['skill','--help'],['skill','status','--help'],['skill','install','-h'],['update','--help'],['update','install','--help'],['install','--help'],['doctor','--help']]){
    const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,PHOTOCRAFT_OWN_HOME:managed}});
    assert.equal(r.status,0,r.stdout+r.stderr);
    assert.match(r.stdout,/photocraft-own/);
    if(args[0]==='skill')assert.match(r.stdout,/--target-root/);
  }
  assert.equal(fs.existsSync(managed),false);
  const bad=spawnSync(process.execPath,[cli,'unknown','--help'],{encoding:'utf8'});
  assert.equal(bad.status,2);
  assert.equal(JSON.parse(bad.stdout).error.code,'USAGE');
});
test('package declares executable initialization and update contracts',()=>{
  const caps=JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../capabilities.json')));
  const contract=caps.installation.lifecycle;
  assert.equal(contract.schema,1);
  for(const args of [contract.initialize.args,contract.update.args]){
    const r=spawnSync(process.execPath,[cli,...args.filter(a=>a!=='--yes'),'--help'],{encoding:'utf8'});
    assert.equal(r.status,0,r.stdout+r.stderr);
  }
  assert.equal(contract.initialize.whenDoctorError,'NOT_INSTALLED');
});
