import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import * as tar from 'tar';
import {packageRoot,pkg,platform,ID,exclusive,digest,read,fail} from '../lib/common.mjs';
import {executablePaths} from '../lib/runtime.mjs';

const repo=path.resolve(packageRoot,'..');
const version=process.env.PHOTOCRAFT_RELEASE_VERSION||pkg.version;
const args=process.argv.slice(2),skip=args.includes('--skip-build'),allowDirty=args.includes('--allow-dirty');
if(!['darwin-arm64','win32-x64'].includes(platform))fail('UNSUPPORTED_PLATFORM',platform);
const target=platform==='darwin-arm64'?'aarch64-apple-darwin':'x86_64-pc-windows-msvc';
const git=(...a)=>execFileSync('git',a,{cwd:repo,encoding:'utf8'}).trim();
if(!allowDirty&&git('status','--porcelain'))fail('DIRTY_BUILD','Commit the candidate before producing release artifacts (use --allow-dirty for a local development build)');
const buildCommit=git('rev-parse','HEAD'),upstream=read(path.join(packageRoot,'upstream.json'));
const upstreamVersion=fs.readFileSync(path.join(repo,'Cargo.toml'),'utf8').match(/\[workspace\.package\][\s\S]*?version\s*=\s*"([^"]+)"/)[1];
const env={...process.env,PHOTOCRAFT_BUILD_SHA:buildCommit,PHOTOCRAFT_BUILD_DATE:new Date().toISOString().slice(0,10)};
if(platform==='win32-x64')env.CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_RUSTFLAGS='-C target-feature=+crt-static';
if(!skip)execFileSync('cargo',['build','--release','--locked','-p','photocraft','-p','photocraft-cli','--features','heif,photocraft/own','--target',target],{cwd:repo,env,stdio:'inherit'});
const out=path.join(packageRoot,'out',`build-${version}-${platform}-${crypto.randomUUID()}`);fs.mkdirSync(out,{recursive:true});
const binaryDir=path.join(process.env.CARGO_TARGET_DIR||path.join(repo,'target'),target,'release');
const cliStage=path.join(out,'cli'),desktopStage=path.join(out,'desktop');fs.mkdirSync(path.join(cliStage,'bin'),{recursive:true});fs.mkdirSync(desktopStage);
const exes=executablePaths(),cli=path.join(cliStage,exes.cli);fs.copyFileSync(path.join(binaryDir,platform==='darwin-arm64'?'photocraft-cli':'photocraft-cli.exe'),cli,fs.constants.COPYFILE_EXCL);fs.chmodSync(cli,0o755);
let app;
if(platform==='darwin-arm64') {
  app=path.join(desktopStage,'PhotoCraft Own.app');fs.mkdirSync(path.join(app,'Contents','MacOS'),{recursive:true});fs.mkdirSync(path.join(app,'Contents','Resources'));
  fs.copyFileSync(path.join(binaryDir,'photocraft'),path.join(desktopStage,exes.desktop),fs.constants.COPYFILE_EXCL);fs.chmodSync(path.join(desktopStage,exes.desktop),0o755);
  fs.copyFileSync(path.join(repo,'assets','app-icon','photocraft.icns'),path.join(app,'Contents','Resources','PhotoCraftOwn.icns'),fs.constants.COPYFILE_EXCL);
  exclusive(path.join(app,'Contents','Info.plist'),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleName</key><string>PhotoCraft Own</string><key>CFBundleDisplayName</key><string>PhotoCraft Own</string><key>CFBundleExecutable</key><string>PhotoCraft Own</string><key>CFBundleIdentifier</key><string>${ID}</string><key>CFBundleVersion</key><string>${version.split('-')[0]}</string><key>CFBundleShortVersionString</key><string>${version.split('-')[0]}</string><key>CFBundleIconFile</key><string>PhotoCraftOwn</string><key>CFBundlePackageType</key><string>APPL</string><key>LSMinimumSystemVersion</key><string>11.0</string><key>NSHighResolutionCapable</key><true/><key>NSHumanReadableCopyright</key><string>Based on PhotoCraft by the ArtCraft team and contributors. MIT OR Apache-2.0.</string></dict></plist>`,0o644);
  const identity=process.env.PHOTOCRAFT_OWN_SIGN_IDENTITY||'-';
  execFileSync('codesign',['--force','--sign',identity,'--timestamp=none',app],{stdio:'inherit'});
  execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
}else {
  app=path.join(desktopStage,'desktop');fs.mkdirSync(app);fs.copyFileSync(path.join(binaryDir,'photocraft.exe'),path.join(desktopStage,exes.desktop),fs.constants.COPYFILE_EXCL);
}
for(const stage of [cliStage,desktopStage]) {
  const licenses=path.join(stage,stage===cliStage?'cli-licenses':'desktop-licenses');fs.mkdirSync(licenses);
  for(const n of ['LICENSE-MIT','LICENSE-APACHE','NOTICE','ATTRIBUTION.md'])fs.copyFileSync(path.join(repo,n),path.join(licenses,n),fs.constants.COPYFILE_EXCL);
  for(const n of ['OFL-Inter.txt','OFL-JetBrainsMono.txt'])fs.copyFileSync(path.join(repo,'assets','fonts',n),path.join(licenses,n),fs.constants.COPYFILE_EXCL);
}
const assets={};
for(const [role,stage] of [['cli',cliStage],['desktop',desktopStage]]) {
  const filename=`photocraft-own-${version}-${platform}-${role}.tgz`,file=path.join(out,filename);
  await tar.c({gzip:true,file,cwd:stage,portable:true,noMtime:true},fs.readdirSync(stage).sort());assets[role]={filename,size:fs.statSync(file).size,sha256:await digest(file)};
}
const executables={cli:{path:exes.cli,sha256:await digest(cli)},desktop:{path:exes.desktop,sha256:await digest(path.join(desktopStage,exes.desktop))}};
const v={identity:ID,contract:1,upstreamVersion,upstreamCommit:upstream.commit,buildCommit,features:['heif','own'],developmentBuild:allowDirty||skip,signing:platform==='darwin-arm64'?(process.env.PHOTOCRAFT_OWN_SIGN_IDENTITY?'developer-id-signed':'ad-hoc'):'unsigned',executables,assets};
const manifest={schema:1,package:pkg.name,version:version,platforms:{[platform]:v}};
exclusive(path.join(out,'manifest.json'),manifest,0o644);
console.log(JSON.stringify({ok:true,out,manifest:path.join(out,'manifest.json'),platform,version:version},null,2));
