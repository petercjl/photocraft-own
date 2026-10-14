import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {pkg,read,digest,exclusive,replaceBacked,fail,packageRoot} from '../lib/common.mjs';
import {validateManifest,payloadVersion,payloadURL,assetFile} from '../lib/assets.mjs';
import {packInfo} from './npm-pack.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.ACTIONS_ID_TOKEN_REQUEST_URL)fail('OIDC_ENVIRONMENT_REQUIRED','Payloads require the authorized GitHub-hosted OIDC release job');
const root=path.resolve(process.argv[2]),version=process.argv[3],expected=process.env.EXPECTED_REF;
const manifests=[],files=new Map();function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='manifest.json')manifests.push(read(p));else if(e.name.endsWith('.tgz')){if(files.has(e.name))fail('DUPLICATE_ASSET',e.name);files.set(e.name,p);}}}walk(root);
const combined={schema:1,package:pkg.name,version,platforms:{}};
for(const m of manifests){if(m.package!==pkg.name||m.version!==version)fail('INVALID_MANIFEST','Candidate mismatch');for(const [host,v] of Object.entries(m.platforms)){validateManifest(m,host);if(v.developmentBuild||v.buildCommit!==expected||combined.platforms[host])fail('INVALID_MANIFEST','Unverified or duplicate platform');combined.platforms[host]=v;}}
for(const host of ['darwin-arm64','win32-x64'])validateManifest(combined,host);
// Preflight every local asset before any publication.
for(const v of Object.values(combined.platforms))for(const a of Object.values(v.assets)){const file=files.get(a.filename);if(!file||fs.statSync(file).size!==a.size||await digest(file)!==a.sha256)fail('CHECKSUM_MISMATCH',a.filename);}
async function metadata(ver){const r=await fetch(`https://registry.npmjs.org/@petercjl%2fphotocraft-own/${ver}`,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000)});if(r.status===404)return null;if(!r.ok)fail('REGISTRY_UNAVAILABLE',String(r.status));return r.json();}
for(const v of Object.values(combined.platforms))for(const a of Object.values(v.assets)){
 const ver=payloadVersion(a.sha256),dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-payload-'));
 try{
  fs.copyFileSync(files.get(a.filename),path.join(dir,'payload.bin'),fs.constants.COPYFILE_EXCL);
  exclusive(path.join(dir,'package.json'),{name:pkg.name,version:ver,description:'PhotoCraft Own immutable runtime data. Install the latest manager instead.',license:'MIT',files:['payload.bin'],repository:pkg.repository,publishConfig:{access:'public'}});
  const npm=args=>execFileSync('npm',args,{cwd:dir,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const pack=packInfo(npm(['pack','--json']),pkg.name,ver),tgz=path.join(dir,pack.filename);let meta=await metadata(ver);
  if(!meta){try{npm(['publish',tgz,'--provenance','--access','public','--tag','desktop-assets']);}catch(e){if(/EOTP|ENEEDAUTH|auth\/cli\//.test(String(e.stderr)))fail('TRUSTED_PUBLISHER_REQUIRED','Repair OIDC configuration; no OTP/token fallback');throw e;}}
  const deadline=Date.now()+20*60*1000;while(!meta){if(Date.now()>deadline)fail('NPM_PROCESSING_PENDING',ver);await new Promise(r=>setTimeout(r,15000));meta=await metadata(ver);}
  if(meta.dist?.integrity!==pack.integrity||meta.dist?.tarball!==payloadURL(a.sha256))fail('PAYLOAD_CONFLICT',ver);
  Object.assign(a,{url:payloadURL(a.sha256),transportSize:fs.statSync(tgz).size,transportSha256:await digest(tgz)});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
// Download and verify the actual registry payloads before publishing the manager.
const cache=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'photocraft-registry-qa-'));
try{for(const v of Object.values(combined.platforms))for(const a of Object.values(v.assets))await assetFile(a,cache);}finally{fs.rmSync(cache,{recursive:true,force:true});}
replaceBacked(path.join(packageRoot,'release.json'),combined);
const manifestPackage=read(path.join(packageRoot,'package.json'));manifestPackage.photocraftOwnManifest=combined;replaceBacked(path.join(packageRoot,'package.json'),manifestPackage);
console.log(JSON.stringify({ok:true,version,platforms:Object.keys(combined.platforms)}));
