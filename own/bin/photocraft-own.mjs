#!/usr/bin/env node
import fs from 'node:fs';
import {registerSealSeek} from '../lib/sealseek.mjs';
import path from 'node:path';
import {pkg,packageRoot,platform,paths,read,fail} from '../lib/common.mjs';
import {doctor,install,rollback,launch,runNative,readState,updateCheck,updateInstall} from '../lib/runtime.mjs';
import {skillStatus,skillInstall,source} from '../lib/skills.mjs';

const USAGE=`photocraft-own: managed PhotoCraft desktop and Agent image editing
  version | capabilities | doctor [--json]
  install [--headless] [--channel latest|next] [--manifest FILE --asset-dir DIR] --yes
  launch [native desktop arguments...]
  exec -- <native photocraft-cli arguments...>
  mcp [native MCP arguments...] | serve [native serve arguments...]
  update check [--channel latest|next] | update install [--channel latest|next] --yes
  rollback --yes
  skill source | skill register --agent sealseek --target-root DIR --registry FILE --pool-root DIR
  skill status|install|update --agent codex|sealseek [--target-root DIR] [--copy] [--json]
  mcp-config --read-root DIR --write-root DIR [--json]
Native CLI arguments and engine commands are preserved. MCP/serve stdout is protocol-only.
`;
function options(args,allowed=[]) {
  const o={};for(let i=0;i<args.length;i++){const k=args[i];if(k==='--json')continue;if(!allowed.includes(k))fail('USAGE',`Unknown option ${k}`);if(['--yes','--headless','--copy','--native'].includes(k))o[k.slice(2)]=true;else{const value=args[++i];if(!value||value.startsWith('--'))fail('USAGE',`${k} requires a value`);o[k.slice(2)]=value;}}return o;
}
const args=process.argv.slice(2),command=args.shift();let protocol=['mcp','serve'].includes(command);
function json(value){process.stdout.write(JSON.stringify(value,null,2)+'\n');}
try {
  if(!command||['help','--help','-h'].includes(command)){process.stdout.write(USAGE);}
  else if(['exec','mcp','serve'].includes(command)){if(args[0]==='--')args.shift();process.exitCode=await runNative(command==='exec'?args:[command,...args],{mode:command});}
  else if(command==='launch'){json(await launch(args));}
  else if(command==='version'){options(args);json({manager:pkg.version,platform,runtime:readState(paths())});}
  else if(command==='capabilities'){const o=options(args,['--native']);if(o.native){process.exitCode=await runNative(['commands','--json']);}else json(read(path.join(packageRoot,'capabilities.json')));}
  else if(command==='doctor'){options(args);const result=await doctor();json(result);if(!result.ok)process.exitCode=1;}
  else if(command==='install'){const o=options(args,['--yes','--headless','--manifest','--asset-dir','--channel']);json(await install({yes:o.yes,headless:o.headless,manifest:o.manifest?read(path.resolve(o.manifest)):undefined,assetDir:o['asset-dir'],channel:o.channel}));}
  else if(command==='rollback'){const o=options(args,['--yes']);json(await rollback({yes:o.yes}));}
  else if(command==='update'){const action=args.shift(),o=options(args,['--yes','--channel']);if(action==='check')json(await updateCheck(o));else if(action==='install')json(await updateInstall(o));else fail('USAGE','Use update check or update install');}
  else if(command==='skill'){const action=args.shift(),o=options(args,['--agent','--target-root','--copy','--registry','--pool-root']);const opt={agent:o.agent,targetRoot:o['target-root'],copy:o.copy,registry:o.registry,poolRoot:o['pool-root']};if(action==='source')json({ok:true,source,version:pkg.version});else if(action==='status')json(skillStatus(opt));else if(action==='register')json(await registerSealSeek(opt));else if(['install','update'].includes(action))json(await skillInstall(opt));else fail('USAGE','Use skill source/status/install/update');}
  else if(command==='mcp-config'){const o=options(args,['--read-root','--write-root']);if(!o['read-root']||!o['write-root'])fail('USAGE','Declare both --read-root and --write-root');json({mcpServers:{'photocraft-own':{command:process.execPath,args:[path.join(packageRoot,'bin','photocraft-own.mjs'),'mcp','--automation-read-root',path.resolve(o['read-root']),'--automation-write-root',path.resolve(o['write-root'])]}}});}
  else fail('USAGE',`Unknown command ${command}`);
}catch(e){const error=JSON.stringify({ok:false,error:{code:e.code||'OPERATION_FAILED',message:e.message,...(e.details?{details:e.details}:{})}},null,2)+'\n';if(protocol)process.stderr.write(error);else process.stdout.write(error);process.exitCode=e.code==='USAGE'?2:1;}
