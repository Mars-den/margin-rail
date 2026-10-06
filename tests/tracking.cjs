const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');
const context = { require: () => ({ Plugin: class {}, PluginSettingTab: class {} }), module: { exports: {} } };
vm.createContext(context);
vm.runInContext(source + '\nmodule.exports = {headingAllocations, resolveCurrent, resolveActive, DEFAULTS, DocumentRail};', context);
const { headingAllocations, resolveCurrent, resolveActive, DEFAULTS, DocumentRail } = context.module.exports;
const lines = [10, 20, 80, 95];
const viewport = { first: 22, last: 90, progress: 0.5, scrollable: true, atBottom: false };
const settings = mode => ({ ...DEFAULTS, trackingMode: mode });
assert.equal(resolveCurrent(lines, 100, settings('position'), viewport), 1);
assert.equal(resolveCurrent(lines, 100, settings('length'), viewport), 1);
assert.equal(resolveCurrent(lines, 100, settings('equal'), viewport), 2);
for (const mode of ['length', 'equal']) {
  const ranges = headingAllocations(lines, 100, mode);
  assert.equal(ranges[0].start, 0);
  assert.ok(Math.abs(ranges.at(-1).end - 1) < 1e-12);
  ranges.forEach((range, i) => {
    assert.ok(range.end > range.start);
    assert.equal(resolveCurrent(lines, 100, settings(mode), { ...viewport, progress: (range.start + range.end) / 2 }), i);
    if (i) assert.equal(range.start, ranges[i - 1].end);
  });
  assert.equal(resolveCurrent(lines, 100, settings(mode), { ...viewport, progress: 1 }), 3);
  // Whole scroll range, including fractional pixels and clamped overscroll.
  for (let step = -10; step <= 1010; step++) {
    const result = resolveCurrent(lines, 100, settings(mode), { ...viewport, progress: step / 1000 });
    assert.ok(result >= 0 && result < lines.length);
  }
}
assert.equal(headingAllocations(lines, 100, 'length')[0].end, 0.2); // preamble belongs to first heading
assert.equal(resolveCurrent([], 0, DEFAULTS, viewport), -1);
assert.equal(resolveCurrent([0], 1, settings('length'), viewport), 0);
for (const mode of ['position', 'length', 'equal', 'off']) {
  assert.equal(resolveCurrent(lines, 100, settings(mode), { ...viewport, atBottom: true }), 3);
  const noEnd = { ...settings(mode), lastAtBottom: false };
  const atEnd = { ...viewport, atBottom: true };
  assert.equal(resolveCurrent(lines, 100, noEnd, atEnd), mode === 'off' ? -1 : mode === 'equal' ? 2 : 1);
}
assert.equal(resolveCurrent(lines, 100, settings('off'), viewport), -1);
assert.equal(resolveCurrent(lines, 100, settings('off'), { ...viewport, atBottom: true, scrollable: false }), -1);
assert.deepEqual([...resolveActive(lines, { ...settings('equal'), activeMode: 'visible' }, viewport, 2)], [2]);
assert.deepEqual([...resolveActive(lines, { ...settings('off'), activeMode: 'visible' }, viewport, -1)], []);
assert.deepEqual([...resolveActive(lines, { ...settings('equal'), activeMode: 'visible' }, { ...viewport, first: 15, last: 85 }, 0)], [0, 1, 2]);
// Document integration: use real syncActive with viewport/scroller adapters.
for (const mode of ['position', 'length', 'equal', 'off']) {
  const rail = Object.create(DocumentRail.prototype);
  rail.plugin = { settings: settings(mode) };
  rail.headings = lines.map(line => ({ position: { start: { line } } }));
  rail.lines = Array(100).fill('');
  rail.scroller = { scrollTop: 400, scrollHeight: 1000, clientHeight: 200 };
  rail.visibleRange = () => [22, 90];
  rail.scrollTopLine = () => 22;
  rail.paintProgress = fraction => { rail.fraction = fraction; };
  rail.paintActive = (active, current) => { rail.result = { active, current }; };
  rail.syncActive();
  assert.equal(rail.result.current, mode === 'off' ? -1 : mode === 'equal' ? 2 : 1);
  rail.scroller.scrollTop = 800;
  rail.syncActive();
  assert.equal(rail.result.current, 3);
}
console.log('Tracking checks passed: allocations, all rule/end combinations, viewport highlights, non-scrollable notes, document integration.');

// Reading mode must ignore the editor that remains mounted but hidden.
const listeners = new Map();
const scroller = name => ({ name, scrollTop: 0, scrollHeight: 1000, clientHeight: 200,
  addEventListener(type, fn) { listeners.set(name, fn); },
  removeEventListener() { listeners.delete(name); } });
const editorScroll = scroller('editor'), readingScroll = scroller('reading');
const readingMode = { type: 'preview', renderer: { previewEl: readingScroll } };
const sourceMode = { type: 'source', cm: { scrollDOM: editorScroll } };
const phone = Object.create(DocumentRail.prototype);
phone.view = { currentMode: readingMode, previewMode: readingMode,
  editor: { cm: sourceMode.cm }, containerEl: { querySelector() { throw Error('Prefer active-mode API'); } } };
phone.plugin = { settings: settings('length') };
phone.headings = lines.map(line => ({ position: { start: { line } } }));
phone.lines = Array(100).fill(''); phone.visibleRange = () => [0, 20];
phone.scrollTopLine = () => 0; phone.paintProgress = () => {};
phone.paintActive = (active, current) => { phone.current = current; };
phone.onScroll = () => phone.syncActive();
phone.attachScroller(); assert.equal(phone.scroller, readingScroll);
readingScroll.scrollTop = 680; listeners.get('reading')();
assert.equal(phone.current, 2); // allocation advances while the hidden editor remains at zero
assert.equal(editorScroll.scrollTop, 0);
phone.view.currentMode = sourceMode; phone.attachScroller();
assert.equal(phone.scroller, editorScroll); assert.equal(listeners.has('reading'), false);
editorScroll.scrollTop = 800; listeners.get('editor')(); assert.equal(phone.current, 3);
phone.detachScroller(); assert.equal(listeners.size, 0);
console.log('Mode selection checks passed: hidden editor ignored, reading scroll events advance tracking, switching modes rebinds and cleans up.');
