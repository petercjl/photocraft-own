import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {packageRoot,pkg,read} from '../lib/common.mjs';
import {assertManifestBinding} from '../lib/runtime-identity.mjs';
import {packInfo} from './npm-pack.mjs';
const out=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-own-pack-'));
function run(args,cwd=packageRoot){const p=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,encoding:'utf8',shell:process.platform==='win32',timeout:120000});if(p.status!==0)throw Error(p.stderr+p.stdout);return p.stdout;}
const packed=packInfo(run(['pack','--json','--pack-destination',out]),pkg.name,pkg.version);
for(const entry of packed.files){if(/(^|\/)(out|test|dev|node_modules|ci)\//.test(entry.path)||/\.png$|\.psd$|\.pcraft$/.test(entry.path))throw Error('Unexpected packed content: '+entry.path);}
run(['install','--global','--prefix',out,'--ignore-scripts',path.join(out,packed.filename)]);
const installed=path.join(out,process.platform==='win32'?'node_modules':'lib/node_modules','@petercjl/photocraft-own/bin/photocraft-own.mjs');
const installedRoot=path.resolve(installed,'../..');assertManifestBinding(read(path.join(installedRoot,'package.json')).photocraftOwnManifest,read(path.join(installedRoot,'release.json')));
const p=spawnSync(process.execPath,[installed,'version'],{encoding:'utf8',env:{...process.env,PHOTOCRAFT_OWN_HOME:path.join(out,'runtime')}});if(p.status!==0||JSON.parse(p.stdout).manager!==packed.version)throw Error('Packed entry version mismatch');
if(process.env.PHOTOCRAFT_TEST_MANIFEST){
 const smoke=spawnSync(process.execPath,[path.join(packageRoot,'ci/smoke.mjs'),process.env.PHOTOCRAFT_TEST_MANIFEST],{encoding:'utf8',timeout:240000,env:{...process.env,PHOTOCRAFT_SMOKE_CLI:installed,PHOTOCRAFT_OWN_HOME:path.join(out,'runtime')}});
 if(smoke.status!==0)throw Error('Packed manager/native integration failed: '+smoke.stderr+smoke.stdout);
 console.log(smoke.stdout);
}
console.log(JSON.stringify({ok:true,version:packed.version,packedBytes:packed.size,fileCount:packed.files.length,installedEntry:installed}));
