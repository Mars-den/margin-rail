// Run from the public branch: node scripts/release.cjs 1.0.1
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
process.chdir(path.resolve(__dirname, '..'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw Error('Supply a version like 1.0.1.');
if (git('status', '--porcelain')) throw Error('Commit your changes before releasing.');
if (git('rev-parse', '--abbrev-ref', '@{u}') !== 'origin/main') throw Error('Release from the branch tracking origin/main.');
if (spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/tags/${version}`]).status === 0) throw Error('That tag already exists.');

const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const old = manifest.version.split('.').map(Number), next = version.split('.').map(Number);
const diff = next.findIndex((part, index) => part !== old[index]);
if (diff < 0 || next[diff] < old[diff]) throw Error('The new version must be newer.');
execFileSync(process.execPath, ['scripts/verify.cjs'], { stdio: 'inherit' });
manifest.version = version;
const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
versions[version] = manifest.minAppVersion;
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync('versions.json', JSON.stringify(versions, null, 2) + '\n');
git('add', 'manifest.json', 'versions.json');
git('commit', '-m', `Release ${version}`);
git('tag', version);
execFileSync('git', ['push', '--atomic', 'origin', 'HEAD:main', `refs/tags/${version}`], { stdio: 'inherit' });
console.log('GitHub Actions will verify the tag and publish the installable assets.');
