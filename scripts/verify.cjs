const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.ok(manifest.author && manifest.description.length <= 250);
assert.equal(manifest.id, 'scrollspy-rail');
if (process.argv[2]) assert.equal(process.argv[2], manifest.version, 'Release tag must match manifest version');
for (const file of ['LICENSE', 'README.md', 'main.js', 'styles.css']) assert.ok(fs.statSync(file).isFile(), file);
execFileSync(process.execPath, ['--check', 'main.js'], { stdio: 'inherit' });
for (const file of fs.readdirSync('tests').filter(name => name.endsWith('.cjs')).sort()) {
  execFileSync(process.execPath, [path.join('tests', file)], { stdio: 'inherit' });
}
console.log(`Release files verified for ${manifest.version}.`);
