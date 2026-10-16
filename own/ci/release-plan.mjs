import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import semver from 'semver';
import {identityHash,assertManifestBinding} from '../lib/runtime-identity.mjs';
import {validateManifest,registryVersion} from '../lib/assets.mjs';
import {fingerprint} from './native-inputs.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export function planRelease({version,mode='auto',runtimeVersion,current,binding,manifest,compatibility}) {
  if(!semver.valid(version)||!['auto','manager','native'].includes(mode))throw Error('Invalid release plan inputs');
  let reason='Native inputs or artifact proof changed';
  let reuse=binding?.schema===1&&binding.policyHash===current.policyHash&&binding.fingerprint===current.fingerprint&&binding.manifestHash===identityHash(manifest)&&binding.artifactVersion===manifest.version&&identityHash(binding.compatibility)===identityHash(compatibility);
  try{for(const host of ['darwin-arm64','win32-x64']){const v=validateManifest(manifest,host);if(v.developmentBuild||v.buildCommit!==binding.sourceCommit||v.contract!==compatibility.nativeContract||!Object.values(v.assets).every(a=>a.url))reuse=false;}}catch{reuse=false;}
  if(reuse)reason='Unchanged native inputs; pinned compatible published artifacts';
  if(mode==='manager'&&!reuse)throw Error('UNVERIFIED_REUSE: '+reason);
  const requestedNewRuntime=runtimeVersion!==undefined&&runtimeVersion!==manifest.version;
  if(mode==='manager'&&requestedNewRuntime)throw Error('UNVERIFIED_REUSE: explicit native version requires a native build');
  const selected=mode==='native'||requestedNewRuntime||!reuse?'native':'manager';
  if(selected==='native'&&reuse)reason='Explicit native build requested';
  runtimeVersion=runtimeVersion||version;
  if(selected==='native'&&(!semver.valid(runtimeVersion)||!semver.gt(runtimeVersion,manifest.version)))throw Error('Native candidate version must advance the pinned program version');
  if(!semver.prerelease(version)&&semver.prerelease(selected==='manager'?manifest.version:runtimeVersion))throw Error('Stable manager requires a stable native program');
  return {schema:1,mode:selected,managerVersion:version,runtimeVersion:selected==='manager'?manifest.version:runtimeVersion,nativeSourceRef:selected==='manager'?binding.sourceCommit:null,...current,reason,qa:selected==='manager'?['manager-macOS','manager-Windows','pinned CLI/MCP/install/update/rollback/package']:['full native macOS','full native Windows','CLI/MCP/install/update/rollback/package']};
}
export async function verifyPublishedBinding(binding,manifest,{registry=registryVersion,api}={}) {
  if(!binding||!/^\d+$/.test(binding.sourceRun||''))throw Error('Missing native QA source run');
  const meta=await registry(binding.registryVersion);if(identityHash(meta.photocraftOwnManifest)!==binding.manifestHash||identityHash(manifest)!==binding.manifestHash)throw Error('Published manifest binding mismatch');
  const get=api|| (p=>JSON.parse(execFileSync('gh',['api',`repos/petercjl/photocraft-own/${p}`],{encoding:'utf8'})));
  const run=get(`actions/runs/${binding.sourceRun}`),jobs=get(`actions/runs/${binding.sourceRun}/jobs?per_page=100`).jobs;
  if(run.path!=='.github/workflows/own-release.yml'||run.status!=='completed'||!['success','failure'].includes(run.conclusion)||run.head_sha!==binding.sourceCommit)throw Error('Native QA provenance mismatch');
  if(run.conclusion==='failure'&&!jobs.some(j=>j.name==='publish'&&j.conclusion==='failure'))throw Error('Not a publication-only failure');
  for(const suffix of ['(macos-15, aarch64-apple-darwin)','(windows-latest, x86_64-pc-windows-msvc)'])if(!jobs.some(j=>j.name.startsWith('qa / qa ')&&j.name.endsWith(suffix)&&j.conclusion==='success'))throw Error('Missing successful native platform QA');
  return true;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const load=n=>JSON.parse(fs.readFileSync(path.join(repo,'own',n)));
 const binding=fs.existsSync(path.join(repo,'own/native-release.json'))?load('native-release.json'):null,manifest=load('release.json');
 if(execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim())throw Error('Commit the release candidate before planning publication');
 assertManifestBinding(load('package.json').photocraftOwnManifest,manifest);
 const plan=planRelease({version:process.env.RELEASE_VERSION||process.argv[2],mode:process.env.RELEASE_MODE||'auto',runtimeVersion:process.env.RUNTIME_VERSION||undefined,current:fingerprint(repo),binding,manifest,compatibility:load('capabilities.json').runtimeCompatibility});
 if(plan.mode==='manager')await verifyPublishedBinding(binding,manifest);
 console.log(JSON.stringify(plan,null,2));
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`mode=${plan.mode}\nruntime_version=${plan.runtimeVersion}\n`);
}
