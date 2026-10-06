const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const timers = new Map(); let timerId = 0;
class MarkdownView {}
const context = { module: { exports: {} },
  require: () => ({ Plugin: class {}, PluginSettingTab: class {}, MarkdownView,
    Platform: {}, setIcon() {}, Notice: class {} }),
  ResizeObserver: class { observe() {} disconnect() { this.disconnected = true; } },
  setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
  clearTimeout(id) { timers.delete(id); }, cancelAnimationFrame() {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') +
  '\nmodule.exports.internals = { DEFAULTS, SESSION_DEFAULTS, DocumentRail };', context);
const Plugin = context.module.exports;
const { DEFAULTS, SESSION_DEFAULTS, DocumentRail } = Plugin.internals;
function style() {
  return { values: new Map(), setProperty(k, v) { this.values.set(k, v); },
    getPropertyValue(k) { return this.values.get(k) || ''; }, removeProperty(k) { this.values.delete(k); } };
}
function documentFixture() {
  const frames = new Map(); let frameId = 0;
  const doc = { frames, defaultView: {
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); }, matchMedia() { return { matches: false }; }
  }, body: { style: style() } };
  doc.flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  return doc;
}
function element(doc) {
  const classes = new Set(), events = new Map();
  const el = { ownerDocument: doc, style: style(), children: [], clientWidth: 900,
    classList: { contains: k => classes.has(k), add: k => classes.add(k), remove: k => classes.delete(k),
      toggle(k, v) { if (v) classes.add(k); else classes.delete(k); } },
    addClass(k) { classes.add(k); }, removeClass(k) { classes.delete(k); },
    toggleClass(k,v) { this.classList.toggle(k,v); },
    addEventListener(k,fn) { events.set(k,fn); }, removeEventListener(k) { events.delete(k); },
    events, setAttribute() {}, removeAttribute() {}, setText() {}, contains() { return false; },
    empty() { this.children.length = 0; }, remove() { this.removed = true; },
    createDiv() { const c = element(doc); this.children.push(c); return c; },
    createSpan() { return this.createDiv(); }, createEl() { return this.createDiv(); },
    querySelector() { return null; }, getBoundingClientRect() { return { top: 0, bottom: 600, height: 10 }; }
  };
  return el;
}
function viewFixture(doc, name) {
  const view = new MarkdownView(); view.containerEl = element(doc);
  view.file = { path: name }; view.text = '# A\nbody\n## B\nbody\n## C'; view.reads = 0;
  view.getViewData = () => { view.reads++; return view.text; };
  const scroller = element(doc); Object.assign(scroller, { scrollTop: 0, scrollHeight: 5000, clientHeight: 600 });
  view.currentMode = { type: 'preview', getScroll: () => 0, renderer: { previewEl: scroller } };
  view.previewMode = view.currentMode;
  return view;
}
(async () => {
  const main = documentFixture(), popout = documentFixture();
  main.body.style.setProperty('--ss-tick-width', '99px'); main.body.style.setProperty('--unrelated', 'keep');
  popout.body.style.setProperty('--ss-tick-width', '99px');
  const one = viewFixture(main, 'one.md'), two = viewFixture(popout, 'two.md');
  const heading = (name, line) => ({ heading: name, level: 1, position: { start: { line } } });
  const caches = new Map([[one.file, { headings: [heading('A',0), heading('B',2), heading('C',4)] }],
    [two.file, { headings: [heading('D',0), heading('E',2), heading('F',4)] }]]);
  let leaves = [{ view: one }, { view: two }];
  const plugin = new Plugin(); plugin.settings = { ...DEFAULTS, ...SESSION_DEFAULTS }; plugin.rails = new Map();
  plugin.app = { metadataCache: { getFileCache: file => caches.get(file) },
    workspace: { getLeavesOfType: () => leaves } };
  one.app = two.app = plugin.app;
  plugin.refresh(); const a = plugin.rails.get(one), b = plugin.rails.get(two);
  assert.equal(one.reads, 1); assert.equal(two.reads, 1);
  const originalTicks = [...a.el.children];
  for (let i = 0; i < 100; i++) plugin.refresh();
  plugin.refresh(false, true); // metadata resolved after changed: same headings
  assert.equal(one.reads, 1); assert.equal(two.reads, 1);
  assert.deepEqual(a.el.children, originalTicks);
  assert.equal(main.frames.size, 1); assert.equal(popout.frames.size, 1);
  main.flush(); popout.flush();

  // Thousands of renderer sections should not be measured for default allocation tracking.
  let measurements = 0, syncs = 0;
  one.currentMode.renderer.sections = Array.from({length: 5000}, (_, line) => ({ lineStart: line,
    lineEnd: line + 1, el: { getBoundingClientRect() { measurements++; return {top: 0, bottom: 10, height: 10}; } } }));
  const sync = a.syncActive.bind(a); a.syncActive = () => { syncs++; sync(); };
  for (let i = 0; i < 100; i++) a.onScroll();
  assert.equal(main.frames.size, 1); assert.equal(syncs, 0);
  main.flush(); assert.equal(syncs, 1); assert.equal(measurements, 0);
  plugin.settings.activeMode = 'visible'; a.onScroll(); main.flush(); assert.equal(measurements, 5000);
  plugin.settings.activeMode = 'single';

  // Mode switches rebind scrolling without rereading a note or replacing ticks.
  const oldScroll = one.currentMode.renderer.previewEl;
  const editorScroll = element(main); Object.assign(editorScroll, { scrollHeight: 2000, clientHeight: 600, scrollTop: 0 });
  one.currentMode = { type: 'source', getScroll: () => 0, cm: { scrollDOM: editorScroll } };
  a.onScroll(); plugin.refresh(); assert.equal(oldScroll.events.has('scroll'), false);
  assert.equal(a.scroller, editorScroll); assert.equal(one.reads, 1);
  assert.deepEqual(a.el.children, originalTicks);

  // An edit rebuilds its own file once; resolved must not rebuild it a second time.
  one.text += '\n## New'; caches.get(one.file).headings.push(heading('New',5));
  a.rebuild(); const afterEdit = one.reads; plugin.refresh(false, true);
  assert.equal(one.reads, afterEdit); assert.equal(two.reads, 1);
  const missing = viewFixture(main, 'late.md'); missing.app = plugin.app; leaves.push({ view: missing });
  plugin.refresh(); assert.equal(plugin.rails.get(missing).headings.length, 0);
  caches.set(missing.file, { headings: [heading('Indexed',0)] }); plugin.refresh(false,true);
  assert.equal(plugin.rails.get(missing).headings.length, 1);
  const replacement = { path: 'replacement.md' }; one.file = replacement;
  caches.set(replacement, { headings: [heading('Replacement',0)] }); plugin.refresh();
  assert.equal(a.headings[0].heading, 'Replacement');

  // Visibility thresholds must update in both directions without rebuilding.
  plugin.settings.minHeadings = 10; b.updateSettings();
  assert.equal(b.el.classList.contains('is-hidden'), true);
  plugin.settings.minHeadings = 1; b.updateSettings();
  assert.equal(b.el.classList.contains('is-hidden'), false);

  // Appearance updates reuse ticks, work in each window, and never persist on body.
  const saved = [], stableTicks = [...b.el.children];
  plugin.saveData = async settings => { saved.push(settings); };
  for (let i = 0; i < 50; i++) { plugin.settings.tickWidth = 20 + i; plugin.saveSettings(); }
  assert.equal(timers.size, 1); assert.equal(saved.length, 0);
  assert.deepEqual(b.el.children, stableTicks); assert.equal(two.reads, 1);
  for (const rail of [a,b]) {
    assert.equal(rail.el.style.getPropertyValue('--ss-tick-width'), '69px');
    assert.equal(rail.flyout.style.getPropertyValue('--ss-tick-width'), '69px');
    assert.equal(rail.host.ownerDocument.body.style.getPropertyValue('--ss-tick-width'), '');
  }
  assert.equal(main.body.style.getPropertyValue('--unrelated'), 'keep');
  const fire = [...timers.values()][0]; timers.clear(); fire(); await plugin.settingsWrite;
  assert.equal(saved.length, 1); assert.equal(saved[0].tickWidth, 69);
  plugin.settings.tickWidth = 70; plugin.saveSettings(); a.onScroll();
  plugin.onunload(); await plugin.settingsWrite;
  assert.equal(saved.length, 2); assert.equal(saved[1].tickWidth, 70);
  assert.equal(timers.size, 0); assert.equal(main.frames.size, 0); assert.equal(popout.frames.size, 0);
  assert.equal(plugin.rails.size, 0);
  for (const rail of [a,b]) {
    assert.equal(rail.el.removed, true); assert.equal(rail.flyout.removed, true);
    assert.equal(rail.host.classList.contains('margin-rail-host'), false);
    assert.equal(rail.resizeObserver.disconnected, true);
  }
  assert.equal(editorScroll.events.has('scroll'), false);
  // Pending saves keep immutable snapshots and cannot complete out of order.
  const queued = new Plugin(); queued.settings = { tickWidth: 1 }; queued.rails = new Map();
  const writes = []; let finishFirst;
  queued.saveData = data => {
    writes.push(data.tickWidth);
    return writes.length === 1 ? new Promise(resolve => { finishFirst = resolve; }) : Promise.resolve();
  };
  queued.saveSettings(); queued.flushSettings(); await Promise.resolve();
  queued.settings.tickWidth = 2; queued.saveSettings(); queued.flushSettings(); await Promise.resolve();
  assert.deepEqual(writes, [1]); finishFirst(); await queued.settingsWrite;
  assert.deepEqual(writes, [1,2]);
  const css = fs.readFileSync(path.join(__dirname,'../styles.css'),'utf8');
  assert.ok(css.includes('.workspace-leaf-content[data-type="markdown"].margin-rail-host'));
  console.log('Performance checks passed: burst scroll batching, 5,000-section default path, incremental refresh, late indexing, popout styles, debounced saves, and unload cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
