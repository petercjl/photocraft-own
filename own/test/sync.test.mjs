import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {restoreOwned} from '../ci/protect.mjs';
test('upstream sync preserves complete owned namespaces, including new upstream files',()=>{
 const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-sync-test-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const put=(name,text)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
 git('init','--initial-branch=main');git('config','user.name','QA');git('config','user.email','qa@example.invalid');
 put('own/upstream.json','{}');put('own/manager.mjs','owned');put('.github/workflows/own-build.yml','owned workflow');put('app.rs','base');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');
 git('checkout','-b','incoming');put('own/manager.mjs','incoming');put('own/introduced.mjs','unowned addition');put('.github/workflows/own-extra.yml','unowned workflow');put('app.rs','upstream improvement');git('add','.');git('commit','-m','incoming');
 git('checkout','main');git('merge','--no-commit','--no-ff','incoming');restoreOwned(git,base);
 assert.equal(fs.readFileSync(path.join(root,'own/manager.mjs'),'utf8'),'owned');assert.equal(fs.existsSync(path.join(root,'own/introduced.mjs')),false);assert.equal(fs.existsSync(path.join(root,'.github/workflows/own-extra.yml')),false);assert.equal(fs.readFileSync(path.join(root,'app.rs'),'utf8'),'upstream improvement');
});
