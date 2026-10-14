import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {packageRoot,pkg} from '../lib/common.mjs';
import {packInfo} from './npm-pack.mjs';
const out=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-own-pack-'));
function run(args,cwd=packageRoot){const p=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,encoding:'utf8',shell:process.platform==='win32',timeout:120000});if(p.status!==0)throw Error(p.stderr+p.stdout);return p.stdout;}
const packed=packInfo(run(['pack','--json','--pack-destination',out]),pkg.name,pkg.version);
for(const entry of packed.files){if(/(^|\/)(out|test|dev|node_modules|ci)\//.test(entry.path)||/\.png$|\.psd$|\.pcraft$/.test(entry.path))throw Error('Unexpected packed content: '+entry.path);}
run(['install','--global','--prefix',out,'--ignore-scripts',path.join(out,packed.filename)]);
const installed=path.join(out,process.platform==='win32'?'node_modules':'lib/node_modules','@petercjl/photocraft-own/bin/photocraft-own.mjs');
const p=spawnSync(process.execPath,[installed,'version'],{encoding:'utf8',env:{...process.env,PHOTOCRAFT_OWN_HOME:path.join(out,'runtime')}});if(p.status!==0||JSON.parse(p.stdout).manager!==packed.version)throw Error('Packed entry version mismatch');
console.log(JSON.stringify({ok:true,version:packed.version,packedBytes:packed.size,fileCount:packed.files.length,installedEntry:installed}));
