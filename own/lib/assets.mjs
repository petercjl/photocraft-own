import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import * as tar from 'tar';
import semver from 'semver';
import {pkg,fail,sha,digest,read,rejectLinks,progress} from './common.mjs';

export const payloadVersion = hash => `0.0.0-payload.h${hash}`;
export const payloadURL = hash => `https://registry.npmjs.org/@petercjl/photocraft-own/-/photocraft-own-${payloadVersion(hash)}.tgz`;
export function validateManifest(m,host) {
  if(m?.schema!==1 || m.package!==pkg.name || !semver.valid(m.version))fail('INVALID_MANIFEST','Invalid package/version manifest');
  const v=m.platforms?.[host];if(!v)fail('PLATFORM_UNAVAILABLE',`No verified ${host} runtime in release ${m.version}`);
  if(!['darwin-arm64','win32-x64'].includes(host)||!semver.valid(v.upstreamVersion)||!/^[a-f0-9]{40}$/.test(v.buildCommit)||!/^[a-f0-9]{40}$/.test(v.upstreamCommit)||v.identity!=='dev.petercjl.photocraft-own'||v.contract!==1)fail('INVALID_MANIFEST','Invalid runtime provenance/contract');
  for(const role of ['cli','desktop']) {
    const a=v.assets?.[role];if(!a)fail('INVALID_MANIFEST',`Missing ${role} asset`);
    if(!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.size)||a.size<1||a.size>512*1024*1024||!/^[a-zA-Z0-9._-]+\.tgz$/.test(a.filename))fail('INVALID_MANIFEST',`Invalid ${role} archive`);
    if(a.url && (a.url!==payloadURL(a.sha256)||!/^[a-f0-9]{64}$/.test(a.transportSha256)||!Number.isSafeInteger(a.transportSize)||a.transportSize<1||a.transportSize>520*1024*1024))fail('INVALID_MANIFEST','Invalid npm payload identity');
  }
  return v;
}
export async function registryVersion(version='latest') {
  if(!['latest','next'].includes(version)&&!semver.valid(version))fail('INVALID_VERSION','Use latest, next or an exact semver');
  const r=await fetch(`https://registry.npmjs.org/@petercjl%2fphotocraft-own/${version}`,{signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!r.ok)fail('REGISTRY_UNAVAILABLE',`npm registry HTTP ${r.status}`);
  const p=await r.json();if(p.name!==pkg.name||!semver.valid(p.version))fail('INVALID_MANIFEST','Registry package mismatch');return p;
}
export async function unpack(archive,destination,{payload=false}={}) {
  rejectLinks(destination);if(fs.existsSync(destination))fail('TARGET_EXISTS','Extraction requires a fresh directory');
  const entries=[];
  await tar.t({file:archive,strict:true,onReadEntry:e=>entries.push({name:e.path,type:e.type,size:e.size})});
  let total=0;
  for(const e of entries) {
    const n=e.name.replaceAll('\\','/');total+=e.size;
    if(n.startsWith('/')||/^[a-z]:/i.test(n)||n.replace(/\/$/,'').split('/').some(x=>x==='..'||x==='')||!['File','Directory','OldFile'].includes(e.type)||total>2*1024*1024*1024)fail('UNSAFE_ARCHIVE',`Unsafe archive entry: ${e.name}`);
    if(n.split('/').includes('..'))fail('UNSAFE_ARCHIVE','Parent traversal in archive');
  }
  if(payload && entries.some(e=>!['package/','package/package.json','package/payload.bin'].includes(e.name)))fail('UNSAFE_ARCHIVE','Unexpected npm payload content');
  fs.mkdirSync(destination,{recursive:true,mode:0o700});await tar.x({file:archive,cwd:destination,strict:true,preservePaths:false});
  return entries;
}
async function download(url,dest,size,hash) {
  let last;
  for(let attempt=0;attempt<3;attempt++) {
    const temp=`${dest}.download-${crypto.randomUUID()}`;
    try {
      progress(`download ${path.basename(dest)} (${attempt+1}/3)`);
      const response=await fetch(url,{signal:AbortSignal.timeout(300000),redirect:'error'});
      if(!response.ok||!response.body)fail('DOWNLOAD_FAILED',`npm HTTP ${response.status}`);
      let received=0;async function* bounded(){for await(const b of Readable.fromWeb(response.body)){received+=b.length;if(received>size)fail('CHECKSUM_MISMATCH','Download exceeds manifest size');yield b;}}
      await pipeline(bounded(),fs.createWriteStream(temp,{flags:'wx',mode:0o600}));
      if(received!==size||await digest(temp)!==hash)fail('CHECKSUM_MISMATCH','Downloaded archive checksum mismatch');
      fs.renameSync(temp,dest);return;
    } catch(e){last=e;if(fs.existsSync(temp))fs.unlinkSync(temp);if(e.code==='CHECKSUM_MISMATCH')throw e;}
  }
  throw last;
}
export async function assetFile(a,cache,assetDir) {
  if(assetDir) {
    const file=path.join(path.resolve(assetDir),a.filename);rejectLinks(file);
    if(!fs.existsSync(file)||fs.statSync(file).size!==a.size||await digest(file)!==a.sha256)fail('CHECKSUM_MISMATCH','Local asset does not match the manifest');return {file,reused:true,downloadBytes:0};
  }
  rejectLinks(cache);fs.mkdirSync(cache,{recursive:true,mode:0o700});const file=path.join(cache,`${a.sha256}.tgz`);rejectLinks(file);
  if(fs.existsSync(file)) {if(fs.statSync(file).size===a.size&&await digest(file)===a.sha256)return {file,reused:true,downloadBytes:0};fail('CORRUPT_CACHE','Cached asset failed verification; preserve and inspect it');}
  if(!a.url)fail('ASSET_UNPUBLISHED','No npm payload is published for this build');
  const scratch=fs.mkdtempSync(path.join(cache,'download-')),transport=path.join(scratch,'package.tgz');
  try {
    await download(a.url,transport,a.transportSize,a.transportSha256);
    const content=path.join(scratch,'content');await unpack(transport,content,{payload:true});const blob=path.join(content,'package','payload.bin');
    if(!fs.existsSync(blob)||fs.statSync(blob).size!==a.size||await digest(blob)!==a.sha256)fail('CHECKSUM_MISMATCH','Payload content checksum mismatch');
    fs.copyFileSync(blob,file,fs.constants.COPYFILE_EXCL);return {file,reused:false,downloadBytes:a.transportSize};
  }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}
