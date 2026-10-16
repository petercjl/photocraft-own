import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import semver from 'semver';
import {fail,pkg,packageRoot,read} from '../lib/common.mjs';
import {unpack} from '../lib/assets.mjs';
import {identityHash} from '../lib/runtime-identity.mjs';
import {packInfo} from './npm-pack.mjs';
function files(root,relative='') {
 return fs.readdirSync(path.join(root,relative),{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{const name=path.join(relative,e.name);return e.isDirectory()?files(root,name):[name];});
}
export function compareManagerContents(candidate,published,version) {
 const a=files(candidate),b=files(published);
 if(JSON.stringify(a)!==JSON.stringify(b))fail('PUBLISHED_CONTENT_MISMATCH','Published package file list differs from candidate');
 for(const name of a){
  const left=path.join(candidate,name),right=path.join(published,name);
  if(name==='package.json'){
   const expected={...read(left),version},actual=read(right);
   if(identityHash(expected)!==identityHash(actual))fail('PUBLISHED_CONTENT_MISMATCH','Published package metadata differs from candidate');
  }else if(!fs.readFileSync(left).equals(fs.readFileSync(right)))fail('PUBLISHED_CONTENT_MISMATCH','Published package differs: '+name);
 }
 return true;
}
export async function alreadyPublished(version,{root=packageRoot}={}) {
 if(!semver.valid(version))fail('INVALID_RELEASE','Invalid exact version');
 const response=await fetch(`https://registry.npmjs.org/@petercjl%2fphotocraft-own/${version}`,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(30000),redirect:'error'});
 if(response.status===404)return false;
 if(!response.ok)fail('REGISTRY_UNAVAILABLE',String(response.status));
 const meta=await response.json(),expectedURL=`https://registry.npmjs.org/@petercjl/photocraft-own/-/photocraft-own-${version}.tgz`;
 if(meta.name!==pkg.name||meta.version!==version||meta.dist?.tarball!==expectedURL||!/^sha512-[A-Za-z0-9+/=]+$/.test(meta.dist?.integrity||''))fail('INVALID_MANIFEST','Unexpected published manager identity');
 const scratch=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'pc-published-manager-'));
 try{
  const downloaded=await fetch(expectedURL,{signal:AbortSignal.timeout(30000),redirect:'error'});if(!downloaded.ok||!downloaded.body)fail('REGISTRY_UNAVAILABLE','Cannot verify published manager archive');
  const chunks=[];let bytes=0;for await(const chunk of downloaded.body){bytes+=chunk.length;if(bytes>4*1024*1024)fail('INVALID_MANIFEST','Manager archive exceeds verification limit');chunks.push(chunk);}
  const buffer=Buffer.concat(chunks),integrity='sha512-'+crypto.createHash('sha512').update(buffer).digest('base64');if(integrity!==meta.dist.integrity)fail('CHECKSUM_MISMATCH','Published manager archive integrity mismatch');
  const archive=path.join(scratch,'published.tgz');fs.writeFileSync(archive,buffer,{flag:'wx'});
  const packageInfo=read(path.join(root,'package.json'));
  const packed=packInfo(execFileSync('npm',['pack','--json','--pack-destination',scratch],{cwd:root,encoding:'utf8'}),packageInfo.name,packageInfo.version);
  await unpack(archive,path.join(scratch,'published'));await unpack(path.join(scratch,packed.filename),path.join(scratch,'candidate'));
  compareManagerContents(path.join(scratch,'candidate/package'),path.join(scratch,'published/package'),version);
  return true;
 }finally{fs.rmSync(scratch,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.env.GITHUB_ACTIONS!=='true'||!process.env.ACTIONS_ID_TOKEN_REQUEST_URL)fail('OIDC_ENVIRONMENT_REQUIRED','Run the committed workflow through npm-release-kit publish');
 const version=process.env.RELEASE_VERSION,tag=process.env.RELEASE_TAG;
 if(!semver.valid(version)||!['next','latest'].includes(tag)||Boolean(semver.prerelease(version))!==(tag==='next'))fail('INVALID_RELEASE','Release version/channel mismatch');
 // Both native and manager-only paths need a Git identity before npm publication.
 execFileSync('git',['config','user.name','github-actions[bot]']);execFileSync('git',['config','user.email','41898282+github-actions[bot]@users.noreply.github.com']);execFileSync('git',['var','GIT_AUTHOR_IDENT'],{stdio:'ignore'});
 const existing=await alreadyPublished(version);console.log(JSON.stringify({version,publicationAlreadyPresent:existing,verifiedExistingContents:existing}));
 execFileSync('npx',['--yes','--package','release-it@21.1.0','release-it',version,'--ci',`--npm.publish=${!existing}`,'--npm.skipChecks=true',`--npm.tag=${tag}`,'--git.requireCleanWorkingDir=true','--git.requireUpstream=true','--git.push=true','--git.commitMessage=chore: release own v${version}','--git.tagName=own-v${version}','--github.release=true'],{stdio:'inherit'});
}
