import {restoreOwned} from './protect.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {packageRoot,read,exclusive,fail} from '../lib/common.mjs';
const repo=path.resolve(packageRoot,'..'),settings=read(path.join(packageRoot,'upstream.json'));
const run=(exe,args,cwd=repo)=>execFileSync(exe,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const gh=(...args)=>run('gh',args),git=(...args)=>run('git',args);
const preview=!process.argv.includes('--apply');
if(git('status','--porcelain'))fail('DIRTY_WORKTREE','Commit local changes before synchronization');
git('fetch','origin',settings.productBranch);git('fetch','upstream',settings.branch);
const base=git('rev-parse',`origin/${settings.productBranch}`),incoming=git('rev-parse',`upstream/${settings.branch}`),branch=`codex/upstream-${incoming.slice(0,12)}`;
if(incoming===settings.commit){console.log(JSON.stringify({ok:true,unchanged:true,incoming}));process.exit(0);}
if(preview){console.log(JSON.stringify({ok:true,dryRun:true,base,incoming,branch}));process.exit(0);}
const existing=JSON.parse(gh('pr','list','--repo','petercjl/photocraft-own','--head',branch,'--state','all','--json','url,state'));if(existing.length){console.log(JSON.stringify({ok:true,existing}));process.exit(0);}
try {git('show',`${base}:own/upstream.json`);}catch{fail('PRODUCT_NOT_READY','Merge the initial distribution PR into own-main before applying upstream synchronization');}
const parent=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-sync-')),work=path.join(parent,'candidate');git('worktree','add','-b',branch,work,base);
const g=(...args)=>run('git',args,work);
try {
 g('merge','--no-commit','--no-ff',incoming);
 restoreOwned(g,base);
 const pin=path.join(work,'own','upstream.json');fs.copyFileSync(pin,path.join(parent,'upstream-before.json'),fs.constants.COPYFILE_EXCL);fs.writeFileSync(pin,JSON.stringify({...settings,commit:incoming},null,2)+'\n');
 g('add','own/upstream.json');g('commit','-m',`chore: sync PhotoCraft upstream ${incoming.slice(0,12)}`);g('push','origin',`HEAD:refs/heads/${branch}`);
 const body=path.join(parent,'pr-body.md');exclusive(body,`Sync upstream PhotoCraft through ${incoming}. Independent npm/runtime files are preserved.\n\nRequires both native QA targets and real candidate acceptance before promotion.\n`);
 const url=gh('pr','create','--repo','petercjl/photocraft-own','--base',settings.productBranch,'--head',branch,'--title',`Sync upstream ${incoming.slice(0,12)}`,'--body-file',body);
 gh('workflow','run','own-build.yml','--repo','petercjl/photocraft-own','--ref',branch);
 console.log(JSON.stringify({ok:true,url,base,incoming,branch}));
 git('worktree','remove',work);
}catch(e){fail('SYNC_REVIEW_REQUIRED',`Candidate retained at ${work}; resolve merge/conflict or PR permissions before retrying: ${e.message}`);}
