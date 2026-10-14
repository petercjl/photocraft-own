import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {packageRoot,pkg,paths,fail,read,sha,exclusive,replaceBacked,rejectLinks,locked} from './common.mjs';

export const source=path.join(packageRoot,'skills','photocraft-own');
function inventory(root) {
  const out={};function walk(dir,base=''){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const rel=base+e.name,f=path.join(dir,e.name);if(e.isSymbolicLink())fail('UNSAFE_SKILL','Canonical Skill must contain ordinary files');if(e.isDirectory())walk(f,rel+'/');else if(e.isFile())out[rel]=sha(fs.readFileSync(f));}}walk(root);return out;
}
export function skillTarget({agent='codex',targetRoot,home=os.homedir()}={}) {
  if(!['codex','sealseek'].includes(agent))fail('UNKNOWN_AGENT','Supported adapters: codex, sealseek');
  if(!targetRoot&&agent==='sealseek')fail('TARGET_ROOT_REQUIRED','Use the Skill root advertised by the SealSeek host via --target-root');
  return path.join(path.resolve(targetRoot||(process.env.CODEX_HOME?path.join(process.env.CODEX_HOME,'skills'):path.join(home,'.codex','skills'))),'photocraft-own');
}
function receipt(target,p) {return path.join(p.manager,'skills',sha(target)+'.json');}
export function skillStatus(options={},p=paths()) {
  const target=skillTarget(options),record=receipt(target,p),exists=fs.existsSync(target)||fs.existsSync(path.dirname(target))&&fs.readdirSync(path.dirname(target)).includes(path.basename(target));
  let managed=false,current=false,mode=null,modified=[];const files=inventory(source),digest=sha(JSON.stringify(files));
  if(exists){const st=fs.lstatSync(target);if(st.isSymbolicLink()) {mode='link';try{managed=fs.realpathSync.native(target)===fs.realpathSync.native(source);}catch{managed=false;}current=managed;}
    else if(fs.existsSync(record)){const prior=read(record);managed=prior.package===pkg.name&&prior.target===target;mode='copy';if(managed){for(const [name,hash] of Object.entries(prior.files)){const f=path.join(target,name);if(['agents/openai.yaml','.install-meta.json'].includes(name))continue;if(!fs.existsSync(f)||!fs.statSync(f).isFile()||sha(fs.readFileSync(f))!==hash)modified.push(name);}current=prior.digest===digest&&modified.length===0;}}
  }
  return {ok:true,source,target,exists,managed,current,mode,modified,version:pkg.version,digest,files,record};
}
export async function skillInstall(options={},p=paths()) {
  return locked(p,async()=>{
    const status=skillStatus(options,p);rejectLinks(path.dirname(status.target));
    if(status.exists&&!status.managed)fail('UNMANAGED_TARGET','Existing Skill target is user-owned; choose another target root');
    if(status.modified.length)fail('LOCAL_EDITS','Managed Skill contains local edits; preserve them before update',status.modified);
    if(status.current){if(!fs.existsSync(status.record))exclusive(status.record,{package:pkg.name,target:status.target,version:pkg.version,digest:status.digest,files:status.files,mode:status.mode});return {...status,unchanged:true};}
    fs.mkdirSync(path.dirname(status.target),{recursive:true});let backup=null,mode=status.mode;
    if(!status.exists&&!options.copy){try{fs.symlinkSync(source,status.target,process.platform==='win32'?'junction':'dir');mode='link';}catch(e){if(!['EPERM','EACCES','ENOTSUP'].includes(e.code))throw e;mode='copy';}}
    if(mode!=='link') {
      mode='copy';const stage=path.join(path.dirname(status.target),`.photocraft-own-next-${crypto.randomUUID()}`);fs.cpSync(source,stage,{recursive:true,errorOnExist:true,force:false});
      if(status.exists){backup=path.join(p.manager,'skill-backups',crypto.randomUUID());fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});fs.cpSync(status.target,backup,{recursive:true,errorOnExist:true,force:false});
        const priorFiles=read(status.record).files;const preserve=(dir,base='')=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const rel=base+entry.name,src=path.join(dir,entry.name),dest=path.join(stage,rel);if(entry.isSymbolicLink())fail('UNSAFE_SKILL','Managed Skill contains a symbolic link');if(entry.isDirectory())preserve(src,rel+'/');else if(!Object.hasOwn(status.files,rel)&&!Object.hasOwn(priorFiles,rel)){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest,fs.constants.COPYFILE_EXCL);}}};preserve(status.target);
        for(const name of ['agents/openai.yaml','.install-meta.json']){const ui=path.join(status.target,name);if(fs.existsSync(ui))fs.copyFileSync(ui,path.join(stage,name));}
        try {const old=`${status.target}.previous-${crypto.randomUUID()}`;fs.renameSync(status.target,old);try{fs.renameSync(stage,status.target);}catch(e){fs.renameSync(old,status.target);throw e;}fs.rmSync(old,{recursive:true});}
        catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;for(const name of Object.keys(status.files)){const dest=path.join(status.target,name);rejectLinks(dest);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(stage,name),dest);}for(const name of Object.keys(priorFiles)){if(!Object.hasOwn(status.files,name)){const stale=path.join(status.target,name);rejectLinks(stale);if(fs.existsSync(stale))fs.unlinkSync(stale);}}fs.rmSync(stage,{recursive:true});}
      }else{if(fs.existsSync(stage))fs.renameSync(stage,status.target);}
    }
    replaceBacked(status.record,{package:pkg.name,target:status.target,version:pkg.version,digest:status.digest,files:status.files,mode,backup});
    const result=skillStatus(options,p);if(!result.managed||!result.current)fail('SKILL_VERIFICATION_FAILED','Installed Skill hashes do not match');return {...result,backup};
  });
}
