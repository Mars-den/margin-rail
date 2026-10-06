const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');
let pending = null;
let hasBookmarkCheck = false;
let paintedIcon;
const context = { require: () => ({ Plugin: class {}, PluginSettingTab: class {}, setIcon(el, icon) { paintedIcon = icon; }, getIcon() { return hasBookmarkCheck ? {} : null; } }),
  module: { exports: {} }, cancelAnimationFrame() {}, setTimeout(fn) { pending = fn; return 1; }, clearTimeout() { pending = null; } };
vm.createContext(context);
vm.runInContext(source + '\nmodule.exports = {headingSubpath, findHeadingBookmark, bookmarksCore, DocumentRail, RailView};', context);
const { headingSubpath, findHeadingBookmark, bookmarksCore, DocumentRail, RailView } = context.module.exports;
(async () => {
  assert.equal(headingSubpath('Hello: [[world]] | test #1'), '#Hello world test 1');
  assert.equal(headingSubpath('Plain **heading**'), '#Plain **heading**');
  const existing = { type: 'file', path: 'Example.md', subpath: '#Details' };
  const grouped = [{ type: 'group', items: [{ type: 'group', items: [existing] }] }];
  assert.equal(findHeadingBookmark(grouped, 'Example.md', '#Details'), existing);
  assert.equal(findHeadingBookmark(grouped, 'Other.md', '#Details'), null);
  assert.equal(findHeadingBookmark([{ type: 'file', path: 'Example.md' }], 'Example.md', '#Details'), null);
  assert.equal(bookmarksCore({}), null);
  assert.equal(bookmarksCore({ internalPlugins: { getEnabledPluginById: () => null } }), null);
  assert.equal(bookmarksCore({ internalPlugins: { getEnabledPluginById: () => ({ items: [] }) } }), null);
  const core = { items: grouped, addItem(item) { this.items.push(item); }, removeItem(item) {
    function remove(items) {
      const index = items.indexOf(item);
      if (index >= 0) { items.splice(index, 1); return true; }
      return items.some(entry => entry.items && remove(entry.items));
    }
    remove(this.items);
  } };
  const rail = Object.create(DocumentRail.prototype);
  rail.view = { app: { internalPlugins: { getEnabledPluginById: id => id === 'bookmarks' ? core : null } }, file: { path: 'Example.md' } };
  rail.headings = [{ heading: 'Details' }, { heading: 'New: section' }];
  assert.equal(rail.bookmarkState(0).saved, true);
  await rail.bookmarkHeading(0);
  assert.equal(rail.bookmarkState(0).saved, false); // removal works inside nested groups
  await rail.bookmarkHeading(0);
  assert.equal(rail.bookmarkState(0).saved, true);
  await rail.bookmarkHeading(0);
  assert.equal(rail.bookmarkState(0).saved, false);
  await rail.bookmarkHeading(1);
  assert.equal(core.items.length, 2);
  assert.equal(core.items[1].path, 'Example.md');
  assert.equal(core.items[1].subpath, '#New section');
  assert.equal(typeof core.items[1].ctime, 'number');
  assert.equal(rail.bookmarkState(1).saved, true);
  await rail.bookmarkHeading(1);
  assert.equal(core.items.length, 1);
  assert.equal(rail.bookmarkState(1).saved, false);
  await rail.bookmarkHeading(-1);
  assert.equal(core.items.length, 1);
  rail.view.file = { path: 'Other.md' };
  assert.equal(rail.bookmarkState(0).saved, false);
  await rail.bookmarkHeading(0);
  assert.equal(core.items[1].path, 'Other.md');
  core.addItem = () => { throw new Error('failed write'); };
  await assert.rejects(rail.bookmarkHeading(1), /failed write/);
  rail.view.app.internalPlugins.getEnabledPluginById = () => null;
  assert.equal(rail.bookmarkState(0).available, false);
  await rail.bookmarkHeading(0);
  rail.view.app.internalPlugins.getEnabledPluginById = () => core;
  const dotStates = [];
  rail.el = { children: [0, 1].map(index => ({ classList: { toggle(name, value) { dotStates[index] = value; } } })) };
  rail.paintBookmarks();
  assert.deepEqual(dotStates, [true, false]);
  const button = Object.create(RailView.prototype);
  button.plugin = { settings: { showBookmarkButton: true } };
  button.flyout = { toggleClass() {} };
  button.flyoutBookmark = { attrs: { title: 'old native tooltip' }, toggleClass() {},
    removeAttribute(name) { delete this.attrs[name]; }, setAttribute(name, value) { this.attrs[name] = value; } };
  button.bookmarkState = () => ({ available: true, saved: true });
  button.updateBookmarkButton();
  assert.equal(paintedIcon, "bookmark-minus", "Older icon sets keep a visible remove-bookmark action");
  hasBookmarkCheck = true;
  button.updateBookmarkButton();
  assert.equal(paintedIcon, "bookmark-check");
  button.bookmarkState = () => ({ available: true, saved: false });
  button.updateBookmarkButton();
  assert.equal(paintedIcon, "bookmark-plus");
  button.bookmarkState = () => ({ available: true, saved: true });
  button.updateBookmarkButton();
  assert.equal(button.flyoutBookmark.disabled, false);
  assert.equal(button.flyoutBookmark.attrs.title, undefined);
  assert.equal(button.flyoutBookmark.attrs['aria-label'], 'Remove heading bookmark');
  const hover = Object.create(RailView.prototype);
  hover.plugin = { settings: { showBookmarkButton: true, showLabels: true } };
  hover.host = { ownerDocument: {} };
  hover.flyout = { contains: () => false };
  let closed = 0; hover.onLeave = () => closed++;
  hover.scheduleLeave();
  assert.equal(closed, 0);
  assert.ok(pending);
  hover.cancelLeave(); // entering the label cancels the pending close
  assert.equal(pending, null);
  hover.overFlyout = true;
  hover.scheduleLeave();
  assert.equal(pending, null);
  hover.overFlyout = false;
  hover.scheduleLeave();
  pending();
  assert.equal(closed, 1);
  hover.plugin.settings.showBookmarkButton = false;
  hover.scheduleLeave();
  assert.equal(closed, 2); // ordinary labels keep their original immediate close
  console.log('Bookmark checks passed: heading anchors, group lookup, add/remove toggling, tick dots, single tooltip, file targeting, unavailable core, failed writes, label hover grace.');
})().catch(error => { console.error(error); process.exitCode = 1; });
