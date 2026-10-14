import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8'));
export const ID = 'dev.petercjl.photocraft-own';
export const platform = `${process.platform}-${process.arch}`;
export function fail(code,message,details) { throw Object.assign(new Error(message),{code,details}); }
export function read(file) { return JSON.parse(fs.readFileSync(file,'utf8')); }
export function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
export async function digest(file) { const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex'); }
export function rejectLinks(file) {
  let p=path.resolve(file);
  while(true) { try {if(fs.lstatSync(p).isSymbolicLink())fail('UNSAFE_PATH',`Symbolic link is not a managed path: ${p}`);}catch(e){if(e.code!=='ENOENT')throw e;} const parent=path.dirname(p);if(parent===p)break;p=parent; }
}
export function exclusive(file,value,mode=0o600) {
  rejectLinks(path.dirname(file));fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx',mode});
}
export function replaceBacked(file,value) {
  rejectLinks(file);const backup=fs.existsSync(file)?`${file}.backup-${crypto.randomUUID()}`:null;
  if(backup)fs.copyFileSync(file,backup,fs.constants.COPYFILE_EXCL);
  const next=`${file}.next-${crypto.randomUUID()}`;exclusive(next,value);fs.renameSync(next,file);return backup;
}
export function paths({home=os.homedir(),root=process.env.PHOTOCRAFT_OWN_HOME,host=process.platform}={}) {
  root=path.resolve(root || (host==='darwin'?path.join(home,'Library','Application Support','photocraft-own'):host==='win32'?path.join(process.env.LOCALAPPDATA||path.join(home,'AppData','Local'),'photocraft-own'):path.join(home,'.local','share','photocraft-own')));
  return {root,manager:path.join(root,'manager'),versions:path.join(root,'versions'),cache:path.join(root,'cache'),config:host==='win32'&&!process.env.PHOTOCRAFT_OWN_HOME?path.join(process.env.APPDATA||path.join(home,'AppData','Roaming'),'photocraft-own','config'):path.join(root,'config'),state:path.join(root,'manager','state.json'),lock:path.join(root,'manager','operation.lock')};
}
export async function locked(p,fn) {
  rejectLinks(p.root);fs.mkdirSync(p.manager,{recursive:true,mode:0o700});let fd;
  try{fd=fs.openSync(p.lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')fail('BUSY','A managed operation or interrupted lock exists; inspect doctor before recovery');throw e;}
  try{fs.writeSync(fd,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));return await fn();}
  finally{fs.closeSync(fd);fs.unlinkSync(p.lock);}
}
export function progress(message) { process.stderr.write(`photocraft-own: ${message}\n`); }
export function requireYes(yes) { if(!yes)fail('CONFIRMATION_REQUIRED','This operation requires --yes after user authorization'); }
