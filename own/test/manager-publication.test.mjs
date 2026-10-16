import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {compareManagerContents} from '../ci/publish-manager.mjs';
function fixture(){const root=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pc-publication-'));const dirs=['candidate','published'].map(n=>{const dir=path.join(root,n);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'cli.mjs'),'export const version = 1;', {flag:'wx'});fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({name:'@petercjl/photocraft-own',version:n==='candidate'?'0.1.1':'0.1.2',dependencies:{tar:'7.5.22'}}),{flag:'wx'});return dir;});return dirs;}
test('published-manager recovery permits only the exact candidate contents and requested version',()=>{const [a,b]=fixture();assert.equal(compareManagerContents(a,b,'0.1.2'),true);assert.throws(()=>compareManagerContents(a,b,'0.1.3'),{code:'PUBLISHED_CONTENT_MISMATCH'});});
test('published-manager recovery refuses changed code, metadata or extra files',()=>{
 for(const change of ['code','metadata','extra']){const [a,b]=fixture();if(change==='code')fs.writeFileSync(path.join(b,'cli.mjs'),'different');if(change==='metadata')fs.writeFileSync(path.join(b,'package.json'),JSON.stringify({name:'other',version:'0.1.2'}));if(change==='extra')fs.writeFileSync(path.join(b,'unexpected.txt'),'extra');assert.throws(()=>compareManagerContents(a,b,'0.1.2'),{code:'PUBLISHED_CONTENT_MISMATCH'});}
});
