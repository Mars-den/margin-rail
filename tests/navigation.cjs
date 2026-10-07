const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');
const context = { require: () => ({ Plugin: class {}, PluginSettingTab: class {} }), module: { exports: {} } };
vm.createContext(context);
vm.runInContext(source + '\nmodule.exports = { DEFAULTS, RailView };', context);
const { DEFAULTS, RailView } = context.module.exports;
function fixture(levels) {
  const rail = Object.create(RailView.prototype);
  rail.plugin = { settings: { ...DEFAULTS, idleLevels: 2 } };
  rail.levels = levels;
  rail.activeIndex = 0; rail.expandedBranch = -1;
  rail.keyboardIndex = -1; rail.keyboardFocused = false;
  rail.host = { clientHeight: 240, getBoundingClientRect: () => ({top: 0, bottom: 240, height: 240}) };
  const attrs = {}, properties = {}, classes = {};
  rail.el = { children: levels.map((_, i) => ({ id: `h-${i}`, hidden: false, attrs: {},
    setAttribute(k,v) { this.attrs[k] = v; },
    getBoundingClientRect() { return this.hidden ? { height: 0 } :
      { top: 16 + i * 24 - rail.el.scrollTop, bottom: 40 + i * 24 - rail.el.scrollTop, height: 24 }; } })),
    attrs, properties, classes, scrollTop: 0,
    setAttribute(k,v) { attrs[k] = v; }, removeAttribute(k) { delete attrs[k]; },
    toggleClass(k,v) { classes[k] = v; },
    style: { setProperty(k,v) { properties[k] = v; }, removeProperty(k) { delete properties[k]; } },
    getBoundingClientRect: () => ({top: 16, bottom: 224, height: 208}) };
  rail.setHovered = i => { rail.hoveredIndex = i; };
  rail.showFlyout = i => { rail.labelIndex = i; };
  rail.onLeave = () => { rail.labelIndex = -1; rail.updateHierarchy(); };
  rail.activate = i => { rail.jumped = i; };
  return rail;
}
function key(rail, name) {
  let prevented = false, stopped = false;
  rail.onKeyDown({ key: name, preventDefault() { prevented = true; }, stopPropagation() { stopped = true; } });
  return { prevented, stopped };
}
const rail = fixture([1, 2, 3, 4, 5, 6]);
rail.updateHierarchy(); assert.equal(rail.el.children[5].hidden, true);
assert.deepEqual(key(rail, 'Tab'), { prevented: false, stopped: false });
key(rail, 'ArrowDown'); assert.equal(rail.keyboardIndex, 1);
assert.equal(rail.el.children[5].hidden, false);
key(rail, 'End'); assert.equal(rail.keyboardIndex, 5);
assert.equal(rail.el.attrs['aria-activedescendant'], 'h-5');
assert.equal(rail.el.children[5].attrs['aria-selected'], 'true');
assert.equal(rail.labelIndex, 5);
key(rail, 'ArrowDown'); assert.equal(rail.keyboardIndex, 5);
key(rail, 'Enter'); assert.equal(rail.jumped, 5);
key(rail, 'Home'); key(rail, 'ArrowUp'); assert.equal(rail.keyboardIndex, 0);
assert.deepEqual(key(rail, 'Escape'), { prevented: true, stopped: true });
assert.equal(rail.el.attrs['aria-activedescendant'], undefined);
assert.equal(rail.el.children[5].hidden, true);
assert.equal(rail.labelIndex, -1);
rail.jumped = -1; key(rail, 'Enter'); assert.equal(rail.jumped, -1);
key(fixture([]), 'End'); // Empty notes do not create a phantom selection.

const dense = fixture(Array(200).fill(1));
dense.fitPane(); assert.equal(dense.dense, true);
assert.equal(dense.el.properties['--ss-pane-height'], '208px');
key(dense, 'End'); assert.equal(dense.keyboardIndex, 199);
assert.ok(dense.el.scrollTop > 4000);
dense.measure(); assert.equal(dense.centers[0], null);
assert.equal(dense.nearestIndex(212), 199);
for (const anchor of ['top', 'middle', 'bottom']) {
  for (const axisOffset of [-500, 0, 500]) {
    Object.assign(dense.settings, { anchor, axisOffset });
    dense.fitPane();
    const available = parseFloat(dense.el.properties['--ss-pane-height']);
    assert.ok(available >= 24 && available <= 208);
    const offset = parseFloat(dense.el.properties['--ss-axis-offset']);
    if (anchor === 'top') assert.ok(offset >= 0);
    if (anchor === 'bottom') assert.ok(offset <= 0);
  }
}
dense.levels = [1]; dense.el.children.length = 1;
dense.settings.axisOffset = 0; dense.fitPane(); assert.equal(dense.dense, false);
console.log('Navigation checks passed: bounded dense outlines, offscreen hit testing, all nested headings, keyboard boundaries, selection, jump, dismiss, and empty notes.');
