import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function verifyResume(run,jobs,artifacts,changed) {
  const reject=message=>{throw Object.assign(Error(message),{code:'UNVERIFIED_RESUME'});};
  if(run.path!=='.github/workflows/own-release.yml'||run.event!=='workflow_dispatch'||run.status!=='completed'||run.conclusion!=='failure'||!/^[a-f0-9]{40}$/.test(run.head_sha))reject('Resume requires a completed failed release run');
  for(const name of ['qa / qa (macos-15, aarch64-apple-darwin)','qa / qa (windows-latest, x86_64-pc-windows-msvc)'])if(jobs.filter(j=>j.name===name&&j.conclusion==='success').length!==1)reject('Both native QA jobs must have passed');
  if(!jobs.some(j=>j.name==='publish'&&j.conclusion==='failure'))reject('Only publication failures can resume');
  for(const name of ['native-macOS','native-Windows'])if(artifacts.filter(a=>a.name===name&&!a.expired).length!==1)reject('Verified native artifacts are missing or expired');
  if(changed.some(n=>!n.startsWith('own/ci/')&&!n.startsWith('own/test/')&&n!=='.github/workflows/own-release.yml'))reject('Runtime or packaged files changed; run fresh native QA');
  return run.head_sha;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const id=process.argv[2],repo=process.env.GITHUB_REPOSITORY;
  if(!/^\d+$/.test(id||'')||repo!=='petercjl/photocraft-own')throw Error('Invalid recovery run/repository');
  const api=p=>JSON.parse(execFileSync('gh',['api',`repos/${repo}/${p}`],{encoding:'utf8'}));
  const run=api(`actions/runs/${id}`),jobs=api(`actions/runs/${id}/jobs?per_page=100`).jobs,artifacts=api(`actions/runs/${id}/artifacts?per_page=100`).artifacts;
  execFileSync('git',['merge-base','--is-ancestor',run.head_sha,'HEAD']);
  const changed=execFileSync('git',['diff','--name-only',run.head_sha,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  console.log(verifyResume(run,jobs,artifacts,changed));
}
