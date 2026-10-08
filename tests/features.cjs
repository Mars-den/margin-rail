const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');
const context = { require: () => ({ Plugin: class {}, PluginSettingTab: class {} }),
  module: { exports: {} }, cancelAnimationFrame() {} };
vm.createContext(context);
vm.runInContext(source + '\nmodule.exports = {sectionProgress, headingBranches, hierarchyVisible, scrubProgress, DEFAULTS, RailView, DocumentRail};', context);
const { sectionProgress, headingBranches, hierarchyVisible, scrubProgress, DEFAULTS, RailView, DocumentRail } = context.module.exports;
// These cases exercise physical-position tracking independently of the install preset.
const positionSettings = { ...DEFAULTS, trackingMode: "position" };
const lines = [0, 20, 80];
const view = { first: 50, progress: 0.5, scrollable: true, atBottom: false };
assert.equal(sectionProgress(lines, 100, positionSettings, view, 1), 0.5);
assert.ok(Math.abs(sectionProgress(lines, 100, { ...DEFAULTS, trackingMode: 'length' }, view, 1) - 0.5) < 1e-10);
assert.ok(Math.abs(sectionProgress(lines, 100, { ...DEFAULTS, trackingMode: 'equal' }, view, 1) - 0.5) < 1e-10);
assert.equal(sectionProgress(lines, 100, positionSettings, view, -1), 0);
assert.equal(sectionProgress(lines, 100, positionSettings, { ...view, first: 0 }, 1), 0);
assert.equal(sectionProgress(lines, 100, positionSettings, { ...view, first: 200 }, 1), 1);
assert.equal(sectionProgress(lines, 100, positionSettings, { ...view, atBottom: true }, 2), 1);
assert.equal(sectionProgress([0], 100, positionSettings, { ...view, first: 0, scrollable: false, atBottom: true }, 0), 0);
const levels = [2, 3, 4, 4, 3, 4, 2];
assert.deepEqual([...headingBranches(levels, 2)], [0, 1, 1, 1, 4, 4, 6]);
assert.deepEqual([...hierarchyVisible(levels, 2, -1, -1)], [true, true, false, false, true, false, true]);
assert.deepEqual([...hierarchyVisible(levels, 2, 5, 1)], [true, true, true, true, true, true, true]);
assert.deepEqual([...hierarchyVisible(levels, 1, -1, 0)], [true, true, true, true, true, true, true]);
assert.deepEqual([...hierarchyVisible([], 2, -1, -1)], []);
assert.equal(scrubProgress(-10, 100, 300), 0);
assert.equal(scrubProgress(200, 100, 300), 0.5);
assert.equal(scrubProgress(400, 100, 300), 1);

const style = () => ({ values: {}, setProperty(key, value) { this.values[key] = value; },
  getPropertyValue(key) { return this.values[key] || ''; }, removeProperty(key) { delete this.values[key]; } });
const tick = center => ({ hidden: false, style: style(), classList: { toggle() {} },
  getBoundingClientRect() { return this.hidden ? { top: 0, height: 0 } : { top: center - 5, height: 10 }; } });
function rail() {
  const r = Object.create(RailView.prototype);
  r.plugin = { settings: { ...DEFAULTS, hierarchyMode: 'all' } };
  r.levels = [1, 2, 2]; r.centers = []; r.waveFrame = 0; r.drag = null;
  r.activeIndex = 0; r.expandedBranch = -1; r.hoveredIndex = -1;
  r.flyout = { toggleClass() {}, addClass() {}, removeClass() {} };
  r.el = { children: [tick(100), tick(200), tick(300)], style: style(),
    addClass() {}, removeClass() {}, toggleClass() {}, capture: null,
    setPointerCapture(id) { this.capture = id; }, hasPointerCapture(id) { return this.capture === id; },
    releasePointerCapture() { this.capture = null; }, getBoundingClientRect: () => ({ top: 90, bottom: 310 }) };
  r.scrubbed = []; r.activated = [];
  r.activate = index => r.activated.push(index);
  r.scrubTo = progress => r.scrubbed.push(progress);
  return r;
}
const event = (clientY, extra = {}) => ({ clientY, pointerId: 7, button: 0, preventDefault() {}, ...extra });
const r = rail();
r.startDrag(event(100));
assert.equal(r.el.capture, 7);
r.endDrag(event(250));
assert.deepEqual(r.scrubbed, [0.75]);
assert.equal(r.suppressClick, true); // release must not turn into a heading jump
assert.equal(r.drag, null);
assert.equal(r.el.capture, null);
r.startDrag(event(100));
r.endDrag(event(101));
assert.deepEqual(r.activated, [0]); // an ordinary click navigates exactly once before hit targets move
assert.equal(r.suppressClick, true); // consume the browser's extra click after pointerup
r.startDrag(event(100));
r.endDrag(event(250), true);
assert.deepEqual(r.scrubbed, [0.75]); // cancelled gestures must not move the note
r.startDrag(event(100, { button: 2 }));
assert.equal(r.drag, null);
r.plugin.settings.dragToScrub = false;
r.startDrag(event(100));
assert.equal(r.drag, null);
const hidden = rail(); hidden.el.children[1].hidden = true;
assert.equal(hidden.nearestIndex(195), 0); // hidden headings cannot catch clicks
hidden.paintProgress(0.25);
assert.equal(hidden.el.children[0].style.values['--ss-section-progress'], '25.00%');
hidden.paintProgress(0.75);
assert.equal(hidden.el.children[0].style.values['--ss-section-progress'], '75.00%');
const doc = Object.create(DocumentRail.prototype);
doc.scroller = { style: { scrollBehavior: 'smooth' }, scrollTop: 0, scrollHeight: 1000, clientHeight: 200 };
let updates = 0; doc.syncActive = () => updates++;
doc.scrubTo(0.25);
assert.equal(doc.scroller.scrollTop, 200);
assert.equal(doc.scroller.style.scrollBehavior, 'smooth');
doc.scrubTo(2);
assert.equal(doc.scroller.scrollTop, 800);
assert.equal(updates, 2);

// Simulate a middle-anchored rail changing height when a branch opens.
const branch = rail();
branch.plugin.settings.hierarchyMode = 'nearby';
branch.plugin.settings.idleLevels = 2;
branch.levels = [1, 2, 3, 3, 2, 3];
branch.el.children = branch.levels.map((_, index) => {
  const item = tick(0);
  item.getBoundingClientRect = () => {
    if (item.hidden) return { top: 0, height: 0 };
    const visible = branch.el.children.filter(t => !t.hidden);
    const shift = Number.parseFloat(branch.el.style.translate?.split(' ')[1]) || 0;
    return { top: 200 - visible.length * 5 + visible.indexOf(item) * 10 + shift, height: 10 };
  };
  return item;
});
branch.updateHierarchy();
const before = branch.el.children[1].getBoundingClientRect().top;
branch.revealAt(before + 5);
assert.equal(branch.el.children[1].getBoundingClientRect().top, before);
assert.equal(branch.el.children[2].hidden, false);
assert.equal(branch.el.children[3].hidden, false);
assert.equal(branch.el.children[5].hidden, true);
branch.onLeave();
assert.equal(branch.el.children[2].hidden, true);
assert.equal(branch.el.style.translate, '');
console.log('Feature checks passed: section progress, relative hierarchy, hidden hit targets, drag capture/release/cancel, click preservation, document scrubbing.');
