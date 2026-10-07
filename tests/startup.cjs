const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const notices = [];
class MarkdownView {}
const context = { require: () => ({ Plugin: class {}, PluginSettingTab: class {}, MarkdownView,
  Notice: class { constructor(text) { notices.push(text); } } }), module: { exports: {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8') + '\nmodule.exports.visibility = railVisibilityReason;', context);
(async () => {
  const plugin = new context.module.exports();
  const workspaceEvents = new Map(), cacheEvents = new Map();
  let layoutReady, command, refreshes = 0;
  plugin.loadData = async () => null;
  plugin.addSettingTab = () => {};
  plugin.applyStyles = () => {};
  plugin.registerEvent = () => {};
  plugin.addCommand = value => { command = value; };
  plugin.refresh = () => { refreshes++; };
  const view = new MarkdownView(); view.containerEl = { clientWidth: 390 };
  plugin.app = { workspace: { on(name, callback) { workspaceEvents.set(name, callback); },
    onLayoutReady(callback) { layoutReady = callback; }, getActiveViewOfType: () => view },
    metadataCache: { on(name, callback) { cacheEvents.set(name, callback); } } };
  await plugin.onload();
  assert.equal(plugin.settings.trackingMode, 'length', 'Fresh installs use the saved v2 tracking');
  for (const trackingMode of ['length', 'equal', 'off', 'position']) {
    plugin.loadData = async () => ({ trackingMode, hideBelowWidth: 0 });
    await plugin.onload();
    assert.equal(plugin.settings.trackingMode, trackingMode, 'Saved tracking choices survive loading');
  }
  layoutReady(); assert.equal(refreshes, 1);
  cacheEvents.get('resolved')(); assert.equal(refreshes, 2);
  workspaceEvents.get('layout-change')(); assert.equal(refreshes, 3);
  const rail = { headings: Array(5), scroller: {}, visibilityReason() {
    return context.module.exports.visibility(plugin.settings, { phone: false, landscape: false, width: 390, headings: this.headings.length });
  } };
  plugin.rails.set(view, rail); command.callback();
  assert.match(notices.at(-1), /5 headings, 390px pane. Rail ready/);
  plugin.settings.hideBelowWidth = 500; command.callback();
  assert.match(notices.at(-1), /pane narrower/);
  plugin.settings.hideBelowWidth = 0; rail.headings = []; command.callback();
  assert.match(notices.at(-1), /fewer headings/);
  console.log('Startup checks passed: late metadata indexing refresh, layout refresh, and phone visibility diagnostics.');
})().catch(error => { console.error(error); process.exitCode = 1; });
