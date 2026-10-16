import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../skills/photocraft-own/',import.meta.url));
// Catch broken/case-mismatched routes before publishing the portable tree on Windows.
test('bundled operating-manual links resolve within its canonical tree',()=>{
 const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
 const markdown=walk(root).filter(p=>p.endsWith('.md'));
 let checked=0;
 for(const file of markdown){
  for(const [,href] of fs.readFileSync(file,'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
   if(/^[a-z]+:\/\//i.test(href)||href.startsWith('#'))continue;
   const target=path.resolve(path.dirname(file),href.split('#')[0]);
   const relative=path.relative(root,target);
   assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),`Unsafe manual link: ${href}`);
   let cursor=root;
   for(const component of relative.split(path.sep)){
    assert.ok(fs.readdirSync(cursor).includes(component),`Missing or case-mismatched link: ${href} in ${file}`);
    cursor=path.join(cursor,component);
   }
   assert.ok(fs.statSync(target).isFile(),`Not a file: ${href}`);checked++;
  }
 }
 assert.ok(checked>0,'No routed manual resources inspected');
});
