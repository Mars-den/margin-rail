const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { require: () => ({ Plugin: class {}, PluginSettingTab: class {}, Platform: { isPhone: true } }), module: { exports: {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8') + '\nmodule.exports = {railVisibilityReason, DEFAULTS, SESSION_DEFAULTS, PRESET_KEYS, BUILTIN_PRESETS, DocumentRail};', context);
const {railVisibilityReason, DEFAULTS, SESSION_DEFAULTS, PRESET_KEYS, BUILTIN_PRESETS, DocumentRail} = context.module.exports;
const device = { phone: true, landscape: false, width: 390, headings: 8 };
const settings = { ...DEFAULTS, ...SESSION_DEFAULTS };
assert.match(railVisibilityReason(settings, device), /Hidden on phones/);
assert.match(railVisibilityReason(settings, { ...device, landscape: true, width: 844 }), /Hidden on phones/);
settings.phoneVisibility = 'landscape';
assert.match(railVisibilityReason(settings, device), /Hidden in portrait/);
assert.equal(railVisibilityReason(settings, { ...device, landscape: true, width: 390 }), '');
settings.phoneVisibility = 'always';
assert.equal(railVisibilityReason(settings, device), '');
assert.match(railVisibilityReason(settings, { ...device, headings: 1 }), /fewer headings/);
assert.match(railVisibilityReason(settings, { ...device, phone: false }), /pane narrower/);
assert.equal(railVisibilityReason(settings, { ...device, phone: false, width: 1000 }), '');
assert.equal(PRESET_KEYS.includes('phoneVisibility'), false);
for (const preset of BUILTIN_PRESETS) {
  Object.assign(settings, DEFAULTS, preset.values);
  assert.equal(settings.phoneVisibility, 'always');
}
// Rotation re-evaluates a phone's selected policy through the actual rail method.
const rail = Object.create(DocumentRail.prototype);
rail.plugin = { settings: { ...settings, phoneVisibility: 'landscape' } };
let landscape = false, hidden = false, closes = 0;
rail.host = { ownerDocument: { defaultView: { matchMedia: () => ({ matches: landscape }) } } };
rail.view = { containerEl: { clientWidth: 390 } }; rail.headings = Array(8);
rail.el = { toggleClass(name, value) { hidden = value; } }; rail.onLeave = () => closes++;
rail.fitPane = () => {}; // Layout is covered by navigation checks.
rail.syncWidth(); assert.equal(hidden, true);
landscape = true; rail.syncWidth(); assert.equal(hidden, false);
landscape = false; rail.syncWidth(); assert.equal(hidden, true); assert.equal(closes, 2);
console.log('Visibility checks passed: explicit phone policies, portrait/landscape transitions, desktop/tablet widths, heading minimum, and preset independence.');
