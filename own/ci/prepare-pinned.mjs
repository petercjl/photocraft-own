import fs from 'node:fs';
import path from 'node:path';
import {packageRoot,platform,read,exclusive} from '../lib/common.mjs';
import {validateManifest,assetFile} from '../lib/assets.mjs';
const m=read(path.join(packageRoot,'release.json')),v=validateManifest(m,platform),out=path.resolve(process.argv[2]||path.join(packageRoot,'out/pinned'));
if(fs.existsSync(out))throw Error('Pinned staging destination already exists');fs.mkdirSync(out,{recursive:true});
for(const a of Object.values(v.assets)){const result=await assetFile(a,path.join(out,'cache'));fs.copyFileSync(result.file,path.join(out,a.filename),fs.constants.COPYFILE_EXCL);}
exclusive(path.join(out,'manifest.json'),m);console.log(JSON.stringify({ok:true,manifest:path.join(out,'manifest.json'),runtimeVersion:m.version}));
