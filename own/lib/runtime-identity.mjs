import crypto from 'node:crypto';
import semver from 'semver';
import {validateManifest} from './assets.mjs';
export function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
export const identityHash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
// Transport locations and manager metadata do not change executable identity.
export function runtimeIdentity(v) {
  return identityHash({identity:v.identity,version:v.version,platform:v.platform,contract:v.contract,upstreamVersion:v.upstreamVersion,upstreamCommit:v.upstreamCommit,buildCommit:v.buildCommit,features:v.features,executables:v.executables,assets:Object.fromEntries(['cli','desktop'].map(role=>[role,{sha256:v.assets[role].sha256,size:v.assets[role].size}]))});
}
export function updateStatus(manager,latest,record,host) {
  const m=latest.photocraftOwnManifest,v=validateManifest(m,host);
  const managerUpdateAvailable=semver.gt(latest.version,manager);
  const runtimeUpdateAvailable=!record||runtimeIdentity(record)!==runtimeIdentity({...v,version:m.version,platform:host});
  return {managerInstalled:manager,managerAvailable:latest.version,runtimeInstalled:record?.version||null,runtimeAvailable:m.version,managerUpdateAvailable,runtimeUpdateAvailable,available:managerUpdateAvailable||runtimeUpdateAvailable};
}

export function assertManifestBinding(packageManifest,runtimeManifest) {
  if(!packageManifest||!runtimeManifest||identityHash(packageManifest)!==identityHash(runtimeManifest))throw Object.assign(Error('Embedded npm manifest differs from the pinned runtime release'),{code:'INVALID_MANIFEST_BINDING'});
}
