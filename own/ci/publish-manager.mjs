import {execFileSync} from 'node:child_process';
import semver from 'semver';
import {fail} from '../lib/common.mjs';
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.ACTIONS_ID_TOKEN_REQUEST_URL)fail('OIDC_ENVIRONMENT_REQUIRED','Run the committed workflow through npm-release-kit publish');
const version=process.env.RELEASE_VERSION,tag=process.env.RELEASE_TAG;
if(!semver.valid(version)||!['next','latest'].includes(tag)||Boolean(semver.prerelease(version))!==(tag==='next'))fail('INVALID_RELEASE','Release version/channel mismatch');
execFileSync('npx',['--yes','--package','release-it@21.1.0','release-it',version,'--ci','--npm.publish=true','--npm.skipChecks=true',`--npm.tag=${tag}`,'--git.requireCleanWorkingDir=true','--git.requireUpstream=true','--git.push=true','--git.commitMessage=chore: release own v${version}','--git.tagName=own-v${version}','--github.release=true'],{stdio:'inherit'});
