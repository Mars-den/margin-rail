const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = {
  require: () => ({ Plugin: class {}, PluginSettingTab: class {} }),
  module: { exports: {} },
};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(require("node:path").join(__dirname, "../main.js"), "utf8") +
    "\nmodule.exports={validatePreset,DEFAULTS,PRESET_KEYS,WORKBENCH_GROUPS,SETTING_OPTIONS,normalizeLegacySettings};",
  context,
);
const {
  validatePreset,
  DEFAULTS,
  PRESET_KEYS,
  SETTING_OPTIONS,
  normalizeLegacySettings,
} = context.module.exports;
const valid = validatePreset({
  version: 1,
  name: "  My rail  ",
  values: { tickWidth: 32, trackingMode: "equal", idleColor: "#123abc" },
});
assert.equal(valid.name, "My rail");
assert.equal(valid.values.tickWidth, 32);
assert.equal(valid.values.tickHeight, DEFAULTS.tickHeight);
assert.equal(Object.hasOwn(SETTING_OPTIONS.idleColorMode, "inherit"), false);
assert.equal(
  validatePreset({
    version: 1,
    name: "Legacy idle",
    values: { idleColorMode: "inherit" },
  }).values.idleColorMode,
  "text",
);
const legacy = { idleColorMode: "inherit", labelMoveMotion: "fade" };
normalizeLegacySettings(legacy);
assert.deepEqual(legacy, { idleColorMode: "text", labelMoveMotion: "none" });
for (const values of [
  { tickWidth: 900 },
  { tickWidth: "24" },
  { tickWidth: NaN },
  { trackingMode: "surprise" },
  { customColor: "not a color" },
  { phoneVisibility: "always" },
  { unexpected: 1 },
])
  assert.throws(() => validatePreset({ version: 1, name: "Bad", values }));
for (const input of [
  null,
  [],
  {},
  { version: 2, name: "Wrong", values: {} },
  { version: 1, name: "", values: {} },
  { version: 1, name: "Wrong", values: [] },
])
  assert.throws(() => validatePreset(input));
assert.ok(!PRESET_KEYS.includes("phoneVisibility"));
assert.equal(
  Object.keys(
    validatePreset({ version: 1, name: "Default", values: DEFAULTS }).values,
  ).length,
  PRESET_KEYS.length,
);
console.log(
  "Preset checks passed: versioned JSON, defaults, types, ranges, enums, colours, unknown options and device isolation.",
);
