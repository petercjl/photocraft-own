import semver from 'semver';
import {pkg,fail} from '../lib/common.mjs';
const release=process.argv[2],version=semver.valid(release)||semver.inc(pkg.version,release,'next');
if(!version||!semver.gt(version,pkg.version))fail('INVALID_VERSION','Release version must advance the manager version');
if(process.env.RELEASE_TAG&&Boolean(semver.prerelease(version))!==(process.env.RELEASE_TAG==='next'))fail('INVALID_TAG','Use next for prereleases and latest for stable releases');
console.log(version);
