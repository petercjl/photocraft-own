import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {identityHash} from '../lib/runtime-identity.mjs';
export const policyHash=identityHash(fs.readFileSync(fileURLToPath(import.meta.url),'utf8'));
export function nativeInput(name,content) {
  if(name==='own/package.json'){
    const p=JSON.parse(content);return JSON.stringify({name:p.name,license:p.license,repository:p.repository,dependencies:p.dependencies});
  }
  if(name==='own/package-lock.json'){
    const p=JSON.parse(content);delete p.version;if(p.packages?.[''])delete p.packages[''].version;return JSON.stringify(p);
  }
  if(name==='own/lib/runtime.mjs'){
    const contract=content.match(/export function executablePaths\(host=platform\) \{[\s\S]*?\n\}/);
    if(!contract)throw Error('Native executable path contract cannot be classified');return contract[0];
  }
  if(name==='.github/workflows/own-build.yml'){const start=content.indexOf('jobs:');if(start<0)throw Error('Unclassified native workflow');return content.slice(start);}
  if(name.startsWith('own/')){
    if(/^own\/(skills|test|dev)\//.test(name))return null;
    const managerFiles=['own/.gitignore','own/LICENSE','own/NOTICE','own/README.md','own/bin/photocraft-own.mjs','own/capabilities.json','own/release.json','own/native-release.json','own/lib/runtime-identity.mjs','own/lib/skills.mjs','own/lib/sealseek.mjs',...['mcp-smoke','npm-pack','pack-smoke','protect','publish-assets','publish-manager','smoke','sync','verify-registry','verify-resume','version','native-inputs','prepare-pinned','record-native','release-plan'].map(n=>`own/ci/${n}.mjs`)];
    return managerFiles.includes(name)?null:content;
  }
  if(name==='.github/workflows/own-release.yml'||name==='.github/workflows/own-manager.yml')return null;
  if(/^(docs|book|log|plan|plans)\//.test(name)||/^(README[^/]*|AGENTS\.md|CONTRIBUTING[^/]*|CHANGELOG[^/]*)$/.test(name))return null;
  return content; // Unknown paths, lockfiles, assets, workflows and toolchain inputs are native.
}
export function fingerprint(root,ref='HEAD') {
  const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
  const entries=git('ls-tree','-rz','--full-tree',ref).toString().split('\0').filter(Boolean),inputs=[];
  for(const entry of entries){const [meta,name]=entry.split('\t'),[mode,type,oid]=meta.split(' ');if(type!=='blob')throw Error('Unclassified Git tree entry: '+name);
    const normalized=['own/package.json','own/package-lock.json','own/lib/runtime.mjs','.github/workflows/own-build.yml'].includes(name);
    if(normalized){const content=nativeInput(name,git('cat-file','blob',oid).toString());inputs.push([name,name==='.github/workflows/own-build.yml'?'workflow':mode,identityHash(content)]);}
    else if(nativeInput(name,'')!==null)inputs.push([name,mode,oid]);

  }
  return {fingerprint:identityHash(inputs),inputCount:inputs.length,policyHash};
}
