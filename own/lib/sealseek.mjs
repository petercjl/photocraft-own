import fs from 'node:fs';
import path from 'node:path';
import {pkg,paths,read,sha,fail,locked,exclusive,replaceBacked,rejectLinks} from './common.mjs';
import {skillStatus} from './skills.mjs';
export async function registerSealSeek(options,p=paths()) {
 if(options.agent!=='sealseek'||!options.registry||!options.poolRoot)fail('USAGE','SealSeek registration requires --agent sealseek --target-root, --registry and --pool-root');
 return locked(p,async()=>{
  const skill=skillStatus(options,p);if(!skill.managed||!skill.current)fail('SKILL_NOT_READY','Install the current managed Skill before registration');
  const id='photocraft-own',poolRoot=path.resolve(options.poolRoot),files=[path.resolve(options.registry),path.join(poolRoot,'skill.json')],link=path.join(poolRoot,id);
  const receipt=path.join(p.manager,'registrations',sha(JSON.stringify(files))+'.json');rejectLinks(receipt);const owned=fs.existsSync(receipt)&&read(receipt).package===pkg.name;
  const documents=files.map((file,i)=>{rejectLinks(file);const d=read(file);if(d.schema_version!==(i===0?'workspace-skill-manifest.v1':'skill-pool-manifest.v1')||!d.skills||typeof d.skills!=='object'||Array.isArray(d.skills))fail('UNSUPPORTED_REGISTRY','SealSeek manifest schema is unsupported');if((Object.hasOwn(d,id)||Object.hasOwn(d.skills,id))&&!owned)fail('UNMANAGED_REGISTRATION','Existing registration is user-owned');if(d[id]&&d.skills[id]&&JSON.stringify(d[id])!==JSON.stringify(d.skills[id]))fail('REGISTRY_CONFLICT','Two host records disagree; preserve and reconcile before update');return d;});
  rejectLinks(poolRoot);
  if(fs.existsSync(link)||fs.readdirSync(poolRoot).includes(id)){const st=fs.lstatSync(link);if(!st.isSymbolicLink()||fs.realpathSync.native(link)!==fs.realpathSync.native(skill.target))fail('UNMANAGED_TARGET','Existing Skill pool target is user-owned');}
  const ui=read(path.join(skill.source,'.install-meta.json'));if(!ui.title||!ui.description)fail('INVALID_METADATA','Missing Chinese UI metadata');
  if(!fs.existsSync(receipt))exclusive(receipt,{package:pkg.name,files,target:skill.target,phase:'preparing'});
  const backups=[];
  for(let i=0;i<files.length;i++){
   const d=documents[i],prior=d[id]||d.skills[id];if(prior?.current_version===pkg.version&&d[id]&&d.skills[id])continue;
   const entry=prior?{...prior,current_version:pkg.version,updated_at:new Date().toISOString()}:{enabled:true,channels:['all'],source:'customized',title:ui.title,description:ui.description,category_name:'图片处理',current_version:pkg.version,updated_at:new Date().toISOString()};d[id]=entry;d.skills[id]=entry;backups.push({file:files[i],backup:replaceBacked(files[i],d)});
  }
  if(!fs.existsSync(link))fs.symlinkSync(skill.target,link,process.platform==='win32'?'junction':'dir');
  replaceBacked(receipt,{package:pkg.name,files,target:skill.target,phase:'complete',version:pkg.version,backups});
  for(const file of files){const d=read(file);if(d[id]?.current_version!==pkg.version||d.skills[id]?.current_version!==pkg.version)fail('REGISTRATION_FAILED','Host registration verification failed');}
  return {ok:true,registered:true,version:pkg.version,target:skill.target,registries:files,poolLink:link,backups,hostRuntimeVerified:false};
 });
}
