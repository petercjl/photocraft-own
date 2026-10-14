export function packInfo(output,name,version) {
  const result=JSON.parse(output);
  const records=Array.isArray(result)?result:Object.values(result);
  const p=records.length===1?records[0]:null;
  if(!p||p.name!==name||p.version!==version||!/^[a-zA-Z0-9._-]+\.tgz$/.test(p.filename)||!Number.isSafeInteger(p.size)||p.size<1||!/^sha512-[A-Za-z0-9+/=]+$/.test(p.integrity)||!Array.isArray(p.files))throw Object.assign(Error('Unexpected npm pack identity or metadata'),{code:'PACK_METADATA_INVALID'});
  return p;
}
