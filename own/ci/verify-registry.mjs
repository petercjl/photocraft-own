import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pkg,fail} from '../lib/common.mjs';
const version=process.env.RELEASE_VERSION,tag=process.env.RELEASE_TAG;
const deadline=Date.now()+10*60*1000;let meta;
while(Date.now()<deadline){const r=await fetch('https://registry.npmjs.org/@petercjl%2fphotocraft-own',{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000)});if(r.ok){const p=await r.json();if(p['dist-tags']?.[tag]===version&&p.versions?.[version]){meta=p.versions[version];break;}}await new Promise(r=>setTimeout(r,15000));}
if(!meta)fail('REGISTRY_NOT_VERIFIED',version);
const prefix=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-exact-'));
const result=spawnSync('npm',['install','--global','--prefix',prefix,'--ignore-scripts',`${pkg.name}@${version}`],{encoding:'utf8'});if(result.status!==0)fail('INSTALL_FAILED',result.stderr);
const binary=path.join(prefix,'lib','node_modules','@petercjl','photocraft-own','bin','photocraft-own.mjs');const probe=spawnSync(process.execPath,[binary,'version'],{encoding:'utf8'});if(probe.status!==0||JSON.parse(probe.stdout).manager!==version)fail('VERSION_MISMATCH',version);
console.log(JSON.stringify({ok:true,package:pkg.name,version,tag}));
