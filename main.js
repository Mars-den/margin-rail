/* Generated from src/main.ts by esbuild. Edit src/, not this file. */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ScrollspyRailPlugin
});
module.exports = __toCommonJS(main_exports);

// src/plugin.ts
var import_obsidian4 = require("obsidian");

// src/settings/model.ts
var DEFAULTS = {
  // Position
  side: "right",
  anchor: "middle",
  edgeOffset: 12,
  axisOffset: 0,
  // Bars
  tickWidth: 16,
  tickHeight: 3,
  tickRadius: 1,
  tickGap: 8,
  levelIndent: 0,
  markAlignment: "edge",
  // edge | left | center | right
  progressDirection: "left",
  // left | right | center
  // Hover
  hoverStyle: "wave",
  // wave | pill | focus | dot | none
  hitbox: 36,
  waveBoost: 30,
  waveReach: 60,
  waveFocus: 3,
  expandWidth: 30,
  expandHeight: 16,
  showLevel: true,
  animDuration: 220,
  // Current section
  activeMode: "single",
  // "single" | "visible"
  activeBoost: 4,
  trackingMode: "length",
  // position | length | equal | off
  lastAtBottom: true,
  activeOpacity: 1,
  passedOpacity: 0.4,
  passedBoost: 0,
  // Colour
  idleOpacity: 0.25,
  hoverOpacity: 0.55,
  colorMode: "neutral",
  // "neutral" | "accent" | "custom"
  customColor: "#9aa0a6",
  // Labels
  showLabels: true,
  labelOffset: 10,
  labelMotion: "fade",
  // none | fade | slide
  labelDuration: 120,
  labelMoveMotion: "none",
  // none | slide; between marks
  labelMoveDuration: 120,
  showPercent: true,
  showPreview: true,
  showBookmarkButton: true,
  previewLength: 120,
  // Behaviour
  minHeadings: 4,
  hideBelowWidth: 500,
  markPassed: true,
  dragToScrub: true,
  hierarchyMode: "nearby",
  // all | nearby
  idleLevels: 6,
  showSectionProgress: false,
  idleColorMode: "text",
  idleColor: "#9aa0a6",
  passedColorMode: "text",
  passedColor: "#9aa0a6",
  pointedColorMode: "inherit",
  pointedColor: "#9aa0a6",
  focusColorMode: "accent",
  focusColor: "#9aa0a6",
  pointedOpacity: 1,
  pointedBoost: 0,
  focusOpacity: 1,
  focusBoost: 0,
  labelWidth: 300,
  labelFontSize: 12,
  labelPadding: 9,
  labelRadius: 5,
  labelSurface: "theme"
};
var SESSION_DEFAULTS = {
  activePreset: "default",
  presets: [],
  // [{ id, name, values }]
  sourcePresetId: null,
  // Saved preset being customized; survives Custom (unsaved).
  settingsSection: "appearance",
  phoneVisibility: "hidden",
  // hidden | landscape | always; independent of presets
  placeCursorOnNavigate: false,
  highlightOnNavigate: false,
  macDragHaptics: false,
  settingsState: "current"
};
var PRESET_KEYS = Object.keys(DEFAULTS);
var NUMBER_RULES = {
  tickWidth: [4, 60, 1, "px"],
  tickHeight: [1, 16, 1, "px"],
  tickRadius: [0, 16, 0.5, "px"],
  tickGap: [0, 24, 1, "px"],
  levelIndent: [0, 12, 1, "px"],
  edgeOffset: [0, 80, 1, "px"],
  axisOffset: [-300, 300, 1, "px"],
  activeBoost: [0, 40, 1, "px"],
  passedBoost: [0, 40, 1, "px"],
  pointedBoost: [0, 40, 1, "px"],
  focusBoost: [0, 40, 1, "px"],
  idleOpacity: [0, 1, 0.05, "%"],
  hoverOpacity: [0, 1, 0.05, "%"],
  activeOpacity: [0, 1, 0.05, "%"],
  passedOpacity: [0, 1, 0.05, "%"],
  pointedOpacity: [0, 1, 0.05, "%"],
  focusOpacity: [0, 1, 0.05, "%"],
  waveBoost: [0, 120, 1, "px"],
  waveReach: [10, 240, 1, "px"],
  waveFocus: [1, 8, 0.5, ""],
  hitbox: [0, 120, 1, "px"],
  expandWidth: [12, 80, 1, "px"],
  expandHeight: [6, 32, 1, "px"],
  animDuration: [0, 800, 10, "ms"],
  labelOffset: [0, 40, 1, "px"],
  labelDuration: [0, 800, 10, "ms"],
  labelMoveDuration: [0, 800, 10, "ms"],
  previewLength: [40, 400, 1, ""],
  minHeadings: [1, 10, 1, ""],
  hideBelowWidth: [0, 1200, 1, "px"],
  idleLevels: [1, 6, 1, ""],
  labelWidth: [120, 480, 1, "px"],
  labelFontSize: [10, 24, 1, "px"],
  labelPadding: [0, 24, 1, "px"],
  labelRadius: [0, 24, 1, "px"]
};
var SETTING_OPTIONS = {
  side: { left: "Left", right: "Right" },
  anchor: { top: "Top", middle: "Middle", bottom: "Bottom" },
  markAlignment: {
    edge: "Follow rail side",
    left: "Left",
    center: "Centre",
    right: "Right"
  },
  progressDirection: {
    left: "Left to right",
    right: "Right to left",
    center: "From centre"
  },
  trackingMode: {
    length: "Section length \xB7 Recommended",
    position: "Heading position",
    equal: "Equal scroll steps",
    off: "Off"
  },
  activeMode: { single: "Current heading", visible: "Also on screen" },
  hoverStyle: {
    none: "Still",
    wave: "Swell",
    pill: "Heading badge",
    focus: "Focus",
    dot: "Dot"
  },
  hierarchyMode: { all: "All headings", nearby: "Reveal nearby" },
  colorMode: { neutral: "Text", accent: "Theme accent", custom: "Custom" },
  labelMotion: { none: "Instant", fade: "Fade", slide: "Slide" },
  labelMoveMotion: { none: "Instant", slide: "Slide" },
  labelSurface: { theme: "Theme", flat: "Flat", transparent: "Transparent" },
  phoneVisibility: {
    hidden: "Hidden",
    landscape: "Landscape only",
    always: "Always"
  }
};
for (const state of ["idle", "passed", "pointed", "focus"])
  SETTING_OPTIONS[`${state}ColorMode`] = {
    text: "Text",
    accent: "Theme accent",
    ...state === "idle" ? {} : { inherit: "Inherit" },
    custom: "Custom"
  };
function normalizeLegacySettings(settings) {
  if (settings.labelMoveMotion === "fade") settings.labelMoveMotion = "none";
  if (settings.idleColorMode === "inherit") settings.idleColorMode = "text";
}
var WORKBENCH_GROUPS = {
  appearance: {
    shape: "Shape",
    states: "States",
    headings: "Heading hierarchy"
  },
  tracking: {
    tracking: "Tracking",
    pointer: "Hover",
    target: "Pointer area",
    navigation: "Navigation"
  },
  labels: { content: "Content", appearance: "Appearance", motion: "Motion" },
  placement: { position: "Position", visibility: "Visibility" }
};
var PUBLIC_CSS = {
  tickWidth: "mark-width",
  tickHeight: "mark-height",
  tickRadius: "mark-radius",
  tickGap: "mark-gap",
  levelIndent: "level-indent",
  edgeOffset: "edge-offset",
  axisOffset: "vertical-offset",
  activeBoost: "current-length",
  passedBoost: "passed-length",
  idleOpacity: "idle-opacity",
  activeOpacity: "current-opacity",
  passedOpacity: "passed-opacity",
  pointedOpacity: "hover-opacity",
  labelWidth: "label-width",
  labelFontSize: "label-size",
  labelPadding: "label-padding",
  labelRadius: "label-radius",
  labelOffset: "label-distance"
};
function validatePreset(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Use a version 1 preset with a name and values.");
  const data = input;
  if (data.version !== 1 || typeof data.name !== "string" || !data.name.trim() || data.name.length > 100 || !data.values || typeof data.values !== "object" || Array.isArray(data.values))
    throw Error("Use a version 1 preset with a name and values.");
  const values = { ...DEFAULTS };
  for (const [key, original] of Object.entries(data.values)) {
    const value = key === "idleColorMode" && original === "inherit" ? "text" : original;
    if (!Object.hasOwn(DEFAULTS, key))
      throw Error(`Unknown preset option: ${key}`);
    if (typeof value !== typeof DEFAULTS[key])
      throw Error(`Invalid value for ${key}`);
    const rule = NUMBER_RULES[key];
    if (rule && (typeof value !== "number" || !Number.isFinite(value) || value < rule[0] || value > rule[1]))
      throw Error(`Out of range: ${key}`);
    if (SETTING_OPTIONS[key] && (typeof value !== "string" || !Object.hasOwn(SETTING_OPTIONS[key], value)))
      throw Error(`Unknown choice for ${key}`);
    if (key.toLowerCase().includes("color") && !key.endsWith("Mode") && (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)))
      throw Error(`Use a six-digit hex colour for ${key}`);
    values[key] = value;
  }
  return { name: data.name.trim(), values };
}
var BUILTIN_PRESETS = [
  {
    id: "default",
    name: "v2",
    description: "Default: slim neutral ticks, a focused wave, section-length tracking, and full labels with bookmarks.",
    values: DEFAULTS
  },
  {
    id: "builtin-absolutely",
    name: "Absolutely",
    description: "Inspired by Claude\u2019s restrained styling: fine, widely spaced marks on the left, with simple heading labels.",
    values: {
      ...DEFAULTS,
      side: "left",
      edgeOffset: 0,
      tickWidth: 18,
      tickHeight: 1,
      tickGap: 20,
      hoverStyle: "none",
      activeBoost: 8,
      hoverOpacity: 0.25,
      animDuration: 400,
      labelMotion: "slide",
      labelMoveMotion: "slide",
      showPercent: false,
      showPreview: false
    }
  },
  {
    id: "builtin-quiet",
    name: "Quiet",
    description: "A minimal rail that follows the note, with a gentle hover and title-only labels.",
    values: {
      ...DEFAULTS,
      hoverStyle: "none",
      activeBoost: 0,
      tickGap: 6,
      trackingMode: "position",
      idleOpacity: 0.18,
      passedOpacity: 0.25,
      showPercent: false,
      showPreview: false,
      showBookmarkButton: false
    }
  },
  {
    id: "builtin-outline",
    name: "Outline",
    description: "Show every heading with depth indentation and H-level pills on hover.",
    values: {
      ...DEFAULTS,
      hierarchyMode: "all",
      levelIndent: 3,
      tickWidth: 24,
      hoverStyle: "pill",
      trackingMode: "position",
      colorMode: "accent",
      showPreview: false
    }
  },
  {
    id: "builtin-progress",
    name: "Progress",
    description: "Equal scroll shares, square marks with a hover swell, and section progress filling from right to left.",
    values: {
      ...DEFAULTS,
      trackingMode: "equal",
      showSectionProgress: true,
      colorMode: "accent",
      tickWidth: 24,
      tickHeight: 3,
      tickRadius: 0,
      progressDirection: "right",
      showPreview: false,
      labelMotion: "none",
      labelMoveMotion: "none"
    }
  }
];
function railVisibilityReason(settings, {
  phone,
  landscape,
  width,
  headings
}) {
  if (phone) {
    const policy = settings.phoneVisibility || "hidden";
    if (policy === "hidden")
      return "Hidden on phones by your visibility setting.";
    if (policy === "landscape" && !landscape)
      return "Hidden in portrait; rotate the phone to landscape.";
  } else if (width < settings.hideBelowWidth) {
    return "Hidden: pane narrower than the minimum width.";
  }
  if (headings < settings.minHeadings)
    return "Hidden: fewer headings than the minimum.";
  return "";
}
var COLOR_SOURCES = {
  neutral: "var(--text-normal)",
  accent: "var(--text-accent)"
};

// src/settings/settings-tab.ts
var import_obsidian2 = require("obsidian");

// src/rail/rail-view.ts
var import_obsidian = require("obsidian");

// src/core/hierarchy.ts
function headingBranches(levels, idleLevels) {
  const cutoff = Math.min(6, ...levels) + idleLevels - 1;
  let root = 0;
  return levels.map((level, index) => {
    if (index === 0 || level <= cutoff) root = index;
    return root;
  });
}
function hierarchyVisible(levels, idleLevels, current, expanded) {
  const branches = headingBranches(levels, idleLevels);
  return branches.map(
    (root, index) => root === index || root === expanded || index === current
  );
}

// src/core/tracking.ts
var LOOKAHEAD_LINES = 1;
function headingAllocations(lines, totalLines, mode) {
  const weights = lines.map(
    (line, i) => mode === "equal" ? 1 : Math.max(1, (lines[i + 1] ?? totalLines) - (i === 0 ? 0 : line))
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let used = 0;
  return weights.map((weight) => {
    const start = used / total;
    used += weight;
    return { start, end: used / total };
  });
}
function headingLandingStarts(tops, scrollRange, viewportHeight = 200, bottoms = tops.map((top) => top + 24)) {
  if (scrollRange <= 0) return tops.map(() => 0);
  const starts = tops.map((top) => Math.max(0, Math.ceil(top - 24)));
  let step = Math.min(
    64,
    viewportHeight / 4,
    scrollRange / Math.max(1, tops.length - 1)
  );
  for (let i = 0; i < tops.length; i++) {
    if (i) step = Math.min(step, Math.max(0, tops[i]) / i);
    const remaining = tops.length - 1 - i;
    if (remaining)
      step = Math.min(
        step,
        Math.max(0, scrollRange - Math.max(0, bottoms[i] - viewportHeight)) / remaining
      );
  }
  step = Math.max(0, Math.floor(step));
  for (let i = starts.length - 1; i >= 0; i--) {
    starts[i] = Math.min(
      starts[i],
      i === starts.length - 1 ? scrollRange : starts[i + 1] - step
    );
  }
  for (let i = 0; i < starts.length; i++)
    starts[i] = Math.max(i * step, starts[i]);
  return starts.map((top) => top / scrollRange);
}
function physicalHeadingRanges(starts) {
  return starts.map((start, i) => ({
    start: i === 0 ? 0 : start,
    end: starts[i + 1] ?? 1
  }));
}
function headingNavigationProgress(lines, totalLines, mode, index, landing) {
  if (mode !== "length" && mode !== "equal" || index < 0 || index >= lines.length)
    return null;
  const range = headingAllocations(lines, totalLines, mode)[index];
  if (!landing) return range.start;
  const {
    scrollRange,
    viewportHeight,
    headingTop,
    headingBottom,
    preferredTop,
    lastAtBottom
  } = landing;
  if (scrollRange <= 0) return null;
  let min = Math.ceil(range.start * scrollRange);
  if (min / scrollRange < range.start) min++;
  let max = index === lines.length - 1 ? Math.floor(scrollRange) : Math.ceil(range.end * scrollRange) - 1;
  if (index < lines.length - 1 && max / scrollRange >= range.end) max--;
  if (lastAtBottom && index < lines.length - 1)
    max = Math.min(max, Math.ceil(scrollRange - 2) - 1);
  const preferred = Number.isFinite(headingTop) ? headingTop - 24 : preferredTop;
  let low = min, high = max;
  if (Number.isFinite(headingTop) && Number.isFinite(headingBottom)) {
    const visibleMin = Math.max(min, Math.ceil(headingBottom - viewportHeight));
    const visibleMax = Math.min(max, Math.floor(headingTop));
    if (visibleMin <= visibleMax) {
      low = visibleMin;
      high = visibleMax;
    }
  }
  if (max < min) return range.start;
  return Math.max(low, Math.min(high, Math.round(preferred))) / scrollRange;
}
function resolveCurrent(lines, totalLines, settings, viewport) {
  if (!lines.length) return -1;
  if (settings.lastAtBottom && viewport.scrollable && viewport.atBottom)
    return lines.length - 1;
  if (settings.trackingMode === "off") return -1;
  if (settings.trackingMode === "length" || settings.trackingMode === "equal") {
    const ranges = settings.trackingMode === "length" && viewport.headingStarts ? physicalHeadingRanges(viewport.headingStarts) : headingAllocations(lines, totalLines, settings.trackingMode);
    const progress = Math.max(0, Math.min(1, viewport.progress));
    const index = ranges.findIndex((range) => progress < range.end);
    return index < 0 ? lines.length - 1 : index;
  }
  let current = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] > viewport.first + LOOKAHEAD_LINES) break;
    current = i;
  }
  return current;
}
function resolveActive(lines, settings, viewport, current) {
  const active = new Set(current < 0 ? [] : [current]);
  if (settings.trackingMode !== "off" && settings.activeMode === "visible") {
    lines.forEach((line, index) => {
      if (line >= viewport.first && line <= (viewport.last ?? viewport.first))
        active.add(index);
    });
  }
  return active;
}
function clampProgress(value) {
  return Math.max(0, Math.min(1, value));
}
function sectionProgress(lines, totalLines, settings, viewport, current) {
  if (current < 0 || !lines.length) return 0;
  if (viewport.scrollable && viewport.atBottom) return 1;
  if (settings.trackingMode === "length" || settings.trackingMode === "equal") {
    const range = (settings.trackingMode === "length" && viewport.headingStarts ? physicalHeadingRanges(viewport.headingStarts) : headingAllocations(lines, totalLines, settings.trackingMode))[current];
    return clampProgress(
      (viewport.progress - range.start) / (range.end - range.start)
    );
  }
  const start = lines[current];
  const end = lines[current + 1] ?? totalLines;
  return clampProgress(
    ((viewport.topLine ?? viewport.first) - start) / Math.max(1, end - start)
  );
}

// src/core/drag.ts
function scrubProgress(clientY, start, end) {
  return clampProgress((clientY - start) / Math.max(1, end - start));
}
function sectionDragProgress(clientY, centers, ranges, start, end, strength = 1) {
  if (!ranges || centers.some((center) => center == null) || centers.length !== ranges.length) {
    return scrubProgress(clientY, start, end);
  }
  let index = centers.findIndex(
    (center, i) => clientY < (center + (centers[i + 1] ?? Infinity)) / 2
  );
  if (index < 0) index = centers.length - 1;
  const low = index ? (centers[index - 1] + centers[index]) / 2 : start;
  const high = index + 1 < centers.length ? (centers[index] + centers[index + 1]) / 2 : end;
  const fraction = scrubProgress(clientY, low, high);
  const hold = 0.15 * strength;
  const within = fraction < hold ? 0 : (fraction - hold) / (1 - hold);
  return ranges[index].start + (ranges[index].end - ranges[index].start) * within;
}
function dragSnapStrength(speed) {
  const blend = clampProgress((speed - 2) / 6);
  return 1 - blend * blend * (3 - 2 * blend);
}
function sampleDragSpeed(motion, position, time) {
  const elapsed = Math.max(1, time - motion.time);
  const speed = Math.abs(position - motion.position) * 1e3 / elapsed;
  const blend = 1 - Math.exp(-elapsed / (speed > motion.speed ? 60 : 180));
  motion.speed += (speed - motion.speed) * blend;
  motion.position = position;
  motion.time = time;
  return dragSnapStrength(motion.speed);
}

// src/rail/rail-view.ts
var nextRailId = 0;
var RailView = class {
  constructor(plugin, hostEl) {
    this.plugin = plugin;
    this.host = hostEl;
    this.levels = [];
    this.centers = [];
    this.activeIndex = -1;
    this.activeKey = "";
    this.hoveredIndex = -1;
    this.waveFrame = 0;
    this.pointerY = 0;
    this.expandedBranch = -1;
    this.drag = null;
    this.suppressClick = false;
    this.sectionFraction = 0;
    this.leaveTimer = 0;
    this.flyoutIndex = -1;
    this.bookmarkBusy = false;
    this.overFlyout = false;
    this.flyoutPointerFocus = false;
    this.keyboardFocused = false;
    this.keyboardIndex = -1;
    this.railId = `margin-rail-${++nextRailId}`;
    this.ownsHostClass = !hostEl.classList.contains("margin-rail-host");
    hostEl.classList.add("margin-rail-host");
    this.el = hostEl.createDiv({ cls: "scrollspy-rail" });
    this.el.dataset.ignoreSwipe = "true";
    this.el.tabIndex = 0;
    this.el.setAttribute("role", "listbox");
    this.accessibleLabel = hostEl.createSpan({ text: "Note headings" });
    this.accessibleLabel.id = `${this.railId}-label`;
    this.accessibleLabel.hidden = true;
    this.el.setAttribute("aria-labelledby", this.accessibleLabel.id);
    this.el.setAttribute("aria-orientation", "vertical");
    this.el.setAttribute(
      "aria-description",
      "Arrow keys select a heading, Home and End select the first and last. Enter jumps. Escape dismisses. Scroll to browse long outlines."
    );
    this.onKeyboardIntent = (event) => {
      if (event.key === "Tab") this.setInputMode("keyboard");
    };
    hostEl.ownerDocument.addEventListener(
      "keydown",
      this.onKeyboardIntent,
      true
    );
    this.el.addEventListener("focus", () => {
      if (this.touch || this.drag?.pointerType === "touch" || this.inputMode === "touch")
        return;
      this.setInputMode("keyboard");
      this.cancelLeave();
      this.flyoutPointerFocus = false;
      this.keyboardFocused = true;
      this.selectKeyboard(Math.max(0, this.activeIndex));
    });
    this.el.addEventListener("blur", (event) => {
      if (!this.flyout.contains(event.relatedTarget)) this.dismissKeyboard();
    });
    this.el.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.el.addEventListener(
      "wheel",
      (event) => {
        if (this.dense) event.stopPropagation();
        if (this.drag) event.preventDefault();
      },
      { passive: false }
    );
    this.el.addEventListener("scroll", () => {
      this.centers = [];
      if (this.touch) this.touch.moved = true;
      if (this.drag?.moved) {
        this.updateDragFeedback(this.dragSectionIndex());
        return;
      }
      if (this.keyboardFocused && this.keyboardIndex >= 0)
        this.showFlyout(this.keyboardIndex);
      else {
        this.setHovered(-1);
        this.hideFlyout();
      }
    });
    this.flyout = hostEl.createDiv({ cls: "scrollspy-flyout" });
    this.flyout.dataset.ignoreSwipe = "true";
    this.flyoutHead = this.flyout.createDiv({ cls: "scrollspy-flyout-head" });
    this.flyoutTitle = this.flyoutHead.createSpan({
      cls: "scrollspy-flyout-title"
    });
    this.flyoutPercent = this.flyoutHead.createSpan({
      cls: "scrollspy-flyout-percent"
    });
    this.flyoutBookmark = this.flyoutHead.createEl("button", {
      cls: "scrollspy-bookmark-button clickable-icon",
      type: "button"
    });
    this.flyoutBookmark.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      if (this.bookmarkBusy || this.flyoutIndex < 0) return;
      const index = this.flyoutIndex;
      this.bookmarkBusy = true;
      this.updateBookmarkButton();
      try {
        await this.bookmarkHeading(index);
      } catch (error) {
        new import_obsidian.Notice(
          "Could not bookmark this heading. Try again from Obsidian\u2019s Bookmarks."
        );
      } finally {
        this.bookmarkBusy = false;
        this.paintBookmarks();
        this.updateBookmarkButton();
      }
    });
    this.flyout.addEventListener("pointerdown", (evt) => {
      this.flyoutPointerFocus = true;
      if (evt.target.closest?.(".scrollspy-bookmark-button"))
        evt.preventDefault();
    });
    this.flyout.addEventListener("pointerenter", () => {
      this.overFlyout = true;
      this.cancelHoverFrame();
      this.cancelLeave();
    });
    this.flyout.addEventListener("pointerleave", () => {
      this.overFlyout = false;
      this.scheduleLeave();
    });
    this.flyout.addEventListener("focusin", () => this.cancelLeave());
    this.flyout.addEventListener("focusout", (evt) => {
      if (!this.flyout.contains(evt.relatedTarget) && evt.relatedTarget !== this.el) {
        this.dismissKeyboard();
        this.scheduleLeave();
      }
    });
    this.flyout.addEventListener("keydown", (event) => {
      this.cancelLeave();
      this.flyoutPointerFocus = false;
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.el.focus();
      this.dismissKeyboard();
    });
    this.flyoutPreview = this.flyout.createDiv({
      cls: "scrollspy-flyout-preview"
    });
    this.el.addEventListener("click", (evt) => {
      if (this.inputMode === "touch" || evt.pointerType === "touch" || evt.sourceCapabilities?.firesTouchEvents)
        return;
      if (this.suppressClick) {
        this.suppressClick = false;
        return;
      }
      this.activate(this.nearestIndex(evt.clientY));
    });
    this.el.addEventListener("pointerenter", (evt) => {
      if (evt.pointerType === "touch") return;
      this.setInputMode(evt.pointerType || "mouse");
      this.cancelLeave();
      this.lastPointerX = evt.clientX;
      this.lastPointerY = evt.clientY;
      this.measure();
      this.revealAt(evt.clientY);
    });
    this.el.addEventListener(
      "pointermove",
      (evt) => this.onPointerMove(evt)
    );
    this.el.addEventListener("pointerleave", (evt) => {
      if (evt.pointerType !== "touch" && !this.drag) this.scheduleLeave();
    });
    this.el.addEventListener("pointerdown", (evt) => this.startDrag(evt));
    this.el.addEventListener("pointerup", (evt) => this.endDrag(evt));
    this.el.addEventListener(
      "pointercancel",
      (evt) => this.endDrag(evt, true)
    );
    this.el.addEventListener("lostpointercapture", (evt) => {
      if (this.drag || this.touch) this.endDrag(evt, true);
    });
    this.plugin.applyStyles(this);
  }
  destroy() {
    this.host.ownerDocument.removeEventListener(
      "keydown",
      this.onKeyboardIntent,
      true
    );
    this.plugin.endDragHaptics?.(this);
    this.dragSnapAnimation?.cancel();
    this.cancelLabelMotion();
    if (this.ownsHostClass) this.host.classList.remove("margin-rail-host");
    this.cancelLeave();
    if (this.waveFrame) cancelAnimationFrame(this.waveFrame);
    if (this.drag && this.el.hasPointerCapture(this.drag.id))
      this.el.releasePointerCapture(this.drag.id);
    this.el.remove();
    this.accessibleLabel.remove();
    this.flyout.remove();
  }
  get settings() {
    return this.effectiveSettings || this.plugin.settings;
  }
  // Subclasses say what a click does and what the label says.
  activate(_index) {
  }
  scrubTo(_progress) {
  }
  labelFor(_index) {
    return null;
  }
  bookmarkState(_index) {
    return { available: false, saved: false };
  }
  async bookmarkHeading(_index) {
  }
  cancelLeave() {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
  }
  cancelHoverFrame() {
    if (this.waveFrame) cancelAnimationFrame(this.waveFrame);
    this.waveFrame = 0;
  }
  paintBookmarks() {
    Array.from(this.el.children).forEach((tick, index) => {
      tick.classList.toggle("is-bookmarked", this.bookmarkState(index).saved);
    });
  }
  scheduleLeave() {
    this.cancelHoverFrame();
    this.cancelLeave();
    if (this.overFlyout || !this.flyoutPointerFocus && (this.keyboardFocused || this.flyout.contains(this.host.ownerDocument?.activeElement)))
      return;
    const leave = () => this.flyoutPointerFocus ? this.dismissKeyboard() : this.onLeave();
    if (this.settings.showBookmarkButton && this.settings.showLabels) {
      this.leaveTimer = setTimeout(() => {
        this.leaveTimer = 0;
        leave();
      }, 250);
    } else leave();
  }
  setInputMode(mode) {
    if (this.simulateTouch) mode = "touch";
    if (this.inputMode === mode) return;
    this.inputMode = mode;
    if (this.flyoutBookmark) this.updateBookmarkButton();
  }
  updateBookmarkButton() {
    const visible = this.settings.showBookmarkButton && this.inputMode !== "touch";
    this.flyoutBookmark.toggleClass("is-hidden", !visible);
    this.flyout.toggleClass("has-bookmark-button", visible);
    if (!visible) return;
    const state = this.bookmarkState(this.flyoutIndex);
    const title = state.saved ? "Remove heading bookmark" : state.available ? "Bookmark this heading" : "Enable Obsidian\u2019s Bookmarks core plugin to bookmark headings";
    const candidates = state.saved ? ["bookmark-check", "bookmark-minus", "bookmark"] : ["bookmark-plus", "bookmark"];
    const icon = typeof import_obsidian.getIcon === "function" ? candidates.find((name) => (0, import_obsidian.getIcon)(name)) : candidates[0];
    const iconKey = `${icon || "bookmark"}:${state.saved ? "saved" : "unsaved"}`;
    if (this.bookmarkIconKey !== iconKey || !this.flyoutBookmark.querySelector?.("svg")) {
      this.flyoutBookmark.replaceChildren?.();
      (0, import_obsidian.setIcon)(this.flyoutBookmark, icon || "bookmark");
      if (!this.flyoutBookmark.querySelector?.("svg") && this.flyoutBookmark.ownerDocument?.createElementNS) {
        const doc = this.flyoutBookmark.ownerDocument;
        const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        const outline = doc.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        outline.setAttribute(
          "d",
          "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
        );
        svg.append(outline);
        const symbol = doc.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        symbol.setAttribute(
          "d",
          state.saved ? "m9 10 2 2 4-4" : "M12 7v6m-3-3h6"
        );
        svg.append(symbol);
        this.flyoutBookmark.replaceChildren(svg);
      }
      this.bookmarkIconKey = iconKey;
    }
    this.flyoutBookmark.removeAttribute("title");
    this.flyoutBookmark.setAttribute("aria-label", title);
    this.flyoutBookmark.disabled = !state.available;
    this.flyoutBookmark.setAttribute("aria-busy", String(this.bookmarkBusy));
    this.flyoutBookmark.toggleClass("is-bookmarked", state.saved);
  }
  onLeave() {
    this.hideFlyout();
    this.clearWave();
    this.setHovered(-1);
    this.expandedBranch = -1;
    this.el.style.translate = "";
    this.el.style.removeProperty("--ss-reveal-shift");
    this.updateHierarchy();
  }
  // A bounded scroll strip preserves target sizes instead of compressing hundreds
  // of headings into a few pixels. Reserve horizontal room for expanded marks.
  fitPane() {
    if (!this.host) return;
    const s = this.settings;
    const height = this.host.clientHeight || this.host.getBoundingClientRect().height;
    const travel = Math.max(0, height - 56);
    const offset = s.anchor === "top" ? Math.max(0, Math.min(s.axisOffset, travel)) : s.anchor === "bottom" ? Math.max(-travel, Math.min(s.axisOffset, 0)) : Math.max(-travel / 2, Math.min(s.axisOffset, travel / 2));
    const used = s.anchor === "middle" ? 2 * Math.abs(offset) : Math.abs(offset);
    const available = Math.max(0, height - 32 - used);
    const count = Array.from(this.el.children).filter(
      (tick) => !tick.hidden
    ).length;
    const swell = ["pill", "dot"].includes(s.hoverStyle) ? Math.max(0, s.expandHeight - s.tickHeight) : 0;
    const natural = 20 + swell + count * (s.tickHeight + 6) + Math.max(0, count - 1) * Math.max(0, s.tickGap - 6);
    this.dense = natural > available;
    this.el.toggleClass("is-dense", this.dense);
    this.el.style.setProperty("--ss-pane-height", `${available}px`);
    this.el.style.setProperty("--ss-axis-offset", `${offset}px`);
    if (this.dense) {
      this.el.style.translate = "";
      this.el.style.removeProperty("--ss-reveal-shift");
    }
    this.centers = [];
  }
  selectKeyboard(index) {
    if (!this.levels.length) return;
    this.keyboardIndex = Math.max(0, Math.min(index, this.levels.length - 1));
    this.updateHierarchy();
    const tick = this.el.children[this.keyboardIndex];
    this.el.setAttribute("aria-activedescendant", tick.id);
    Array.from(this.el.children).forEach(
      (item, i) => item.setAttribute("aria-selected", String(i === this.keyboardIndex))
    );
    const box = tick.getBoundingClientRect(), rail = this.el.getBoundingClientRect();
    if (box.top < rail.top + 10) this.el.scrollTop -= rail.top + 10 - box.top;
    else if (box.bottom > rail.bottom - 10)
      this.el.scrollTop += box.bottom - rail.bottom + 10;
    this.centers = [];
    this.setHovered(this.keyboardIndex);
    this.showFlyout(this.keyboardIndex);
  }
  dismissKeyboard() {
    this.keyboardFocused = false;
    this.keyboardIndex = -1;
    this.el.removeAttribute("aria-activedescendant");
    Array.from(this.el.children).forEach(
      (tick) => tick.setAttribute("aria-selected", "false")
    );
    this.onLeave();
  }
  onKeyDown(event) {
    this.setInputMode("keyboard");
    const key = event.key;
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"].includes(key))
      return;
    event.preventDefault();
    event.stopPropagation();
    if (key === "Escape") {
      this.dismissKeyboard();
      return;
    }
    if (key === "Enter") {
      if (this.keyboardIndex >= 0) this.activate(this.keyboardIndex);
      return;
    }
    this.keyboardFocused = true;
    const start = this.keyboardIndex >= 0 ? this.keyboardIndex : Math.max(0, this.activeIndex);
    this.selectKeyboard(
      key === "Home" ? 0 : key === "End" ? this.levels.length - 1 : start + (key === "ArrowDown" ? 1 : -1)
    );
  }
  /* ------------------------------------------------------------- pointer -- */
  // Bar centres move on rebuild, outline scrolling, or resize, never
  // while a bar is growing. Measuring once on entry keeps the per-frame work to
  // arithmetic instead of a layout read per bar.
  measure() {
    const ticks = this.el.children;
    const rail = this.dense ? this.el.getBoundingClientRect() : null;
    this.centers = [];
    for (let i = 0; i < ticks.length; i++) {
      const box = ticks[i].getBoundingClientRect();
      this.centers.push(
        box.height && (!rail || box.top + box.height / 2 >= rail.top && box.top + box.height / 2 <= rail.bottom) ? box.top + box.height / 2 : null
      );
    }
  }
  nearestIndex(clientY) {
    if (this.centers.length !== this.el.children.length) this.measure();
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < this.centers.length; i++) {
      if (this.centers[i] == null) continue;
      const distance = Math.abs(this.centers[i] - clientY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }
  onPointerMove(evt) {
    if (evt.pointerType) this.setInputMode(evt.pointerType);
    if (evt.pointerType === "touch" && !this.drag) {
      if (this.touch && this.touch.id === evt.pointerId && Math.hypot(evt.clientX - this.touch.x, evt.clientY - this.touch.y) > 8)
        this.touch.moved = true;
      return;
    }
    if (this.drag && evt.pointerId !== this.drag.id) return;
    const dx = evt.clientX - this.lastPointerX;
    const dy = evt.clientY - this.lastPointerY;
    this.lastPointerX = evt.clientX;
    this.lastPointerY = evt.clientY;
    const towardLabel = this.settings.side === "left" ? dx > 0 : dx < 0;
    if (!this.drag && this.settings.showBookmarkButton && this.flyoutIndex >= 0 && towardLabel && Math.abs(dx) > Math.abs(dy)) {
      this.cancelHoverFrame();
      return;
    }
    this.pointerY = evt.clientY;
    if (this.waveFrame) return;
    this.waveFrame = requestAnimationFrame(() => {
      this.waveFrame = 0;
      if (this.drag) {
        if (Math.abs(this.pointerY - this.drag.y) > (this.drag.slop ?? 3))
          this.drag.moved = true;
        if (this.drag.moved)
          this.scrubDragTo(this.dragProgressAt(this.pointerY));
      } else {
        this.revealAt(this.pointerY);
        this.setHovered(this.nearestIndex(this.pointerY));
      }
      if (this.settings.hoverStyle === "wave") this.applyWave();
    });
  }
  startDrag(evt) {
    this.setInputMode(evt.pointerType || "mouse");
    if (evt.pointerType !== "touch") this.touch = null;
    if (evt.pointerType === "touch" && this.touch && evt.pointerId !== this.touch.id) {
      this.touch.moved = true;
      return;
    }
    if (!this.drag) this.suppressClick = false;
    if (evt.pointerType === "touch" && evt.button === 0 && !this.drag) {
      evt.preventDefault();
      this.cancelLeave();
      this.cancelHoverFrame();
      this.measure();
      this.touch = {
        id: evt.pointerId,
        x: evt.clientX,
        y: evt.clientY,
        index: this.nearestIndex(evt.clientY),
        moved: false
      };
    }
    if (!this.settings.dragToScrub || evt.button !== 0 || this.drag || this.dense && evt.pointerType === "touch")
      return;
    this.suppressClick = false;
    if (evt.pointerType !== "touch") this.revealAt(evt.clientY);
    this.measure();
    const centers = this.centers.filter((value) => value != null);
    if (!centers.length) return;
    const box = this.el.getBoundingClientRect();
    this.drag = {
      id: evt.pointerId,
      pointerType: evt.pointerType,
      slop: evt.pointerType === "touch" ? 8 : 3,
      y: evt.clientY,
      moved: false,
      index: this.touch?.index ?? this.nearestIndex(evt.clientY),
      startedAt: this.dragNow(),
      strength: 1,
      start: !this.dense && centers.length > 1 ? centers[0] : box.top,
      end: !this.dense && centers.length > 1 ? centers.at(-1) : box.bottom
    };
    this.touch = null;
    this.drag.hapticIndex = this.dragSectionIndex();
    this.plugin.beginDragHaptics?.(this);
    this.el.setPointerCapture(evt.pointerId);
    this.el.addClass("is-dragging");
    evt.preventDefault();
  }
  dragNow() {
    return this.host?.ownerDocument.defaultView.performance?.now?.() ?? Date.now();
  }
  dragRanges() {
    return null;
  }
  prepareDragTrack() {
    if (!this.drag || this.drag.prepared) return;
    this.drag.prepared = true;
    this.cancelLabelMotion();
    this.flyout?.addClass("is-scrubbing");
    const selected = this.el.children[this.drag.index];
    const before = selected?.getBoundingClientRect();
    Array.from(this.el.children).forEach((tick) => tick.hidden = false);
    this.fitPane();
    if (before && selected) {
      const after = selected.getBoundingClientRect();
      if (this.dense) this.el.scrollTop += after.top - before.top;
      else {
        const existing = Number(this.el.style.getPropertyValue("--ss-reveal-shift")) || 0;
        let shift = existing + before.top - after.top;
        if (this.host) {
          const host = this.host.getBoundingClientRect(), box2 = this.el.getBoundingClientRect();
          shift = Math.max(
            existing + host.top + 16 - box2.top,
            Math.min(shift, existing + host.bottom - 16 - box2.bottom)
          );
        }
        this.el.style.setProperty("--ss-reveal-shift", String(shift));
        this.el.style.translate = `0 ${shift}px`;
      }
    }
    this.measure();
    const centers = this.centers.filter((center) => center != null), box = this.el.getBoundingClientRect();
    this.drag.start = !this.dense && centers.length > 1 ? centers[0] : box.top;
    this.drag.end = !this.dense && centers.length > 1 ? centers.at(-1) : box.bottom;
    this.drag.centers = [...this.centers];
    this.drag.motion = {
      position: scrubProgress(this.drag.y, this.drag.start, this.drag.end) * Math.max(1, this.levels.length - 1),
      time: this.drag.startedAt,
      speed: 0
    };
  }
  dragProgressAt(clientY) {
    this.pointerY = clientY;
    this.prepareDragTrack();
    if (!this.drag?.motion || !this.drag.centers) return 0;
    const position = scrubProgress(clientY, this.drag.start, this.drag.end) * Math.max(1, this.levels.length - 1);
    const direction = Math.sign(position - this.drag.motion.position);
    this.drag.strength = sampleDragSpeed(
      this.drag.motion,
      position,
      this.dragNow()
    );
    let progress = this.dense ? scrubProgress(clientY, this.drag.start, this.drag.end) : sectionDragProgress(
      clientY,
      this.drag.centers,
      this.dragRanges(),
      this.drag.start,
      this.drag.end,
      this.drag.strength
    );
    if (this.drag.progress != null) {
      if (direction > 0) progress = Math.max(progress, this.drag.progress);
      else if (direction < 0) progress = Math.min(progress, this.drag.progress);
      else progress = this.drag.progress;
    }
    this.drag.progress = progress;
    return progress;
  }
  updateDragFeedback(index, crossed = false) {
    if (index < 0 || !this.el?.children[index]) return;
    const tick = this.el.children[index];
    if (this.dense && this.drag?.moved) {
      const box = this.el.getBoundingClientRect(), mark = tick.getBoundingClientRect();
      const target = Math.max(
        box.top + 12,
        Math.min(box.bottom - 12, this.pointerY)
      );
      this.el.scrollTop += mark.top + mark.height / 2 - target;
      this.centers = [];
    }
    if (this.hoveredIndex === index) this.showFlyout(index);
    else this.setHovered(index);
    if (crossed) {
      this.dragSnapAnimation?.cancel();
      this.dragSnapAnimation = null;
      const mark = tick.firstElementChild;
      const reduced = this.host?.ownerDocument.defaultView.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const strength = this.drag?.strength ?? 1;
      if (!reduced && strength > 0.2 && mark?.animate) {
        this.dragSnapAnimation = mark.animate(
          [
            {
              transform: `scale(${1 + 0.16 * strength}, ${1 + 0.3 * strength})`
            },
            { transform: "scale(1)" }
          ],
          { duration: 140, easing: "ease-out" }
        );
      }
    }
  }
  dragSectionIndex() {
    return this.activeIndex;
  }
  scrubDragTo(progress) {
    this.scrubTo(progress);
    const index = this.dragSectionIndex();
    const crossed = this.drag && index >= 0 && (this.drag.hapticIndex ?? -1) >= 0 && index !== this.drag.hapticIndex;
    if (crossed && (this.drag.strength ?? 1) > 0.25)
      this.plugin.tickDragHaptics?.(this);
    if (this.drag) {
      this.drag.hapticIndex = index;
      this.updateDragFeedback(index, crossed);
    }
  }
  endDrag(evt, cancelled = false) {
    if (this.touch && this.touch.id === evt.pointerId) {
      const touch = this.touch;
      this.touch = null;
      this.suppressClick = true;
      if (!cancelled && !touch.moved && Math.hypot(evt.clientX - touch.x, evt.clientY - touch.y) <= 8)
        this.activate(touch.index);
      this.onLeave();
      return;
    }
    if (!this.drag || evt.pointerId !== this.drag.id) return;
    const drag = this.drag;
    if (this.waveFrame) {
      cancelAnimationFrame(this.waveFrame);
      this.waveFrame = 0;
    }
    if (Math.abs(evt.clientY - drag.y) > (drag.slop ?? 3)) drag.moved = true;
    if (!cancelled && drag.moved)
      this.scrubDragTo(this.dragProgressAt(evt.clientY));
    this.plugin.endDragHaptics?.(this);
    this.suppressClick = true;
    this.drag = null;
    this.el.removeClass("is-dragging");
    this.flyout?.removeClass("is-scrubbing");
    this.dragSnapAnimation?.cancel();
    this.dragSnapAnimation = null;
    if (this.el.hasPointerCapture(evt.pointerId))
      this.el.releasePointerCapture(evt.pointerId);
    this.onLeave();
    if (!cancelled && !drag.moved) this.activate(drag.index);
  }
  updateHierarchy() {
    if (this.drag || this.touch) return;
    const visible = !this.keyboardFocused && this.settings.hierarchyMode === "nearby" ? hierarchyVisible(
      this.levels,
      this.settings.idleLevels,
      this.activeIndex,
      this.expandedBranch
    ) : this.levels.map(() => true);
    Array.from(this.el.children).forEach(
      (tick, index) => tick.hidden = !visible[index]
    );
    this.fitPane();
    this.centers = [];
  }
  revealAt(clientY) {
    if (this.drag || this.touch || this.keyboardFocused || this.settings.hierarchyMode !== "nearby")
      return;
    const index = this.nearestIndex(clientY);
    if (index < 0) return;
    const root = headingBranches(this.levels, this.settings.idleLevels)[index];
    if (root === this.expandedBranch) return;
    const tick = this.el.children[index];
    if (this.dense) {
      const before2 = tick.getBoundingClientRect().top;
      this.expandedBranch = root;
      this.updateHierarchy();
      this.el.scrollTop += tick.getBoundingClientRect().top - before2;
      this.measure();
      return;
    }
    this.expandedBranch = -1;
    this.el.style.translate = "";
    this.el.style.removeProperty("--ss-reveal-shift");
    this.updateHierarchy();
    const branchTick = this.el.children[root];
    const before = branchTick.getBoundingClientRect().top;
    this.expandedBranch = root;
    this.updateHierarchy();
    if (this.dense) {
      this.el.scrollTop += branchTick.getBoundingClientRect().top - before;
    } else {
      let shift = before - branchTick.getBoundingClientRect().top;
      if (this.host) {
        const host = this.host.getBoundingClientRect(), rail = this.el.getBoundingClientRect();
        shift = Math.max(
          host.top + 16 - rail.top,
          Math.min(shift, host.bottom - 16 - rail.bottom)
        );
      }
      this.el.style.setProperty("--ss-reveal-shift", String(shift));
      this.el.style.translate = `0 ${shift}px`;
    }
    this.measure();
  }
  paintProgress(fraction) {
    this.sectionFraction = fraction;
    Array.from(this.el.children).forEach((tick, index) => {
      tick.classList.toggle("is-current", index === this.activeIndex);
      tick.style.setProperty(
        "--ss-section-progress",
        `${(fraction * 100).toFixed(2)}%`
      );
    });
  }
  // Hover is a class the plugin assigns, not CSS :hover, because the bar being
  // pointed at is whichever is nearest -- not necessarily one under the cursor.
  setHovered(index) {
    if (index === this.hoveredIndex) return;
    this.hoveredIndex = index;
    this.el.toggleClass("is-pointing", index >= 0);
    const ticks = this.el.children;
    for (let i = 0; i < ticks.length; i++) {
      ticks[i].classList.toggle("is-hover", i === index);
    }
    if (index < 0) this.hideFlyout();
    else this.showFlyout(index);
  }
  applyWave() {
    const { waveBoost, waveReach, waveFocus } = this.settings;
    const ticks = this.el.children;
    if (this.centers.length !== ticks.length) this.measure();
    const reach = Math.max(1, waveReach);
    for (let i = 0; i < ticks.length; i++) {
      if (this.centers[i] == null) continue;
      const waveY = this.drag?.moved ? this.centers[this.dragSectionIndex()] ?? this.pointerY : this.pointerY;
      const distance = Math.abs(this.centers[i] - waveY) / reach;
      const falloff = distance >= 1 ? 0 : Math.cos(distance * Math.PI / 2) ** (2 * waveFocus);
      ticks[i].style.setProperty(
        "--ss-boost",
        `${(waveBoost * falloff).toFixed(2)}px`
      );
    }
  }
  clearWave() {
    const ticks = this.el.children;
    for (let i = 0; i < ticks.length; i++) {
      ticks[i].style.setProperty("--ss-boost", "0px");
    }
  }
  /* --------------------------------------------------------------- label -- */
  showFlyout(index) {
    const settings = this.settings;
    if (!settings.showLabels && !this.keyboardFocused) return;
    const label = this.labelFor(index);
    const tick = this.el.children[index];
    if (!label || !tick) return;
    const switching = !this.drag?.moved && settings.labelMoveMotion === "slide" && this.flyoutIndex >= 0 && this.flyoutIndex !== index && this.flyout.classList.contains("is-visible");
    const fromTop = switching ? this.flyout.ownerDocument.defaultView.getComputedStyle(this.flyout).top : null;
    if (switching) this.cancelLabelMotion();
    this.flyoutIndex = index;
    this.updateBookmarkButton();
    this.flyoutTitle.setText(label.title);
    this.flyoutPercent.setText(
      settings.showPercent && label.percent != null ? `${label.percent}%` : ""
    );
    this.flyoutPercent.toggleClass("is-hidden", !settings.showPercent);
    const preview = settings.showPreview ? label.preview : "";
    this.flyoutPreview.setText(preview);
    this.flyoutPreview.toggleClass("is-hidden", !preview);
    const host = this.host.getBoundingClientRect();
    const box = tick.getBoundingClientRect();
    const center = box.top - host.top + box.height / 2;
    this.flyout.toggleClass("is-visible", true);
    const half = this.flyout.getBoundingClientRect().height / 2;
    const top = `${Math.max(half, Math.min(host.height - half, center))}px`;
    this.flyout.style.top = top;
    const reduced = this.forceReducedMotion || this.flyout.ownerDocument.defaultView.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (switching && !reduced && settings.labelMoveDuration > 0 && this.flyout.animate) {
      const timing = {
        duration: settings.labelMoveDuration,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      };
      this.labelAnimations = [
        this.flyout.animate([{ top: fromTop }, { top }], timing)
      ];
    }
  }
  cancelLabelMotion() {
    for (const animation of this.labelAnimations || []) animation.cancel();
    this.labelAnimations = [];
  }
  hideFlyout() {
    const top = this.labelAnimations?.length ? this.flyout.ownerDocument.defaultView.getComputedStyle(this.flyout).top : null;
    this.cancelLabelMotion();
    if (top) this.flyout.style.top = top;
    this.cancelLeave();
    this.flyoutIndex = -1;
    this.overFlyout = false;
    this.flyout.toggleClass("is-visible", false);
  }
  /* --------------------------------------------------------------- build -- */
  updatePresentation() {
    const settings = this.settings;
    this.el.toggleClass("is-left", settings.side === "left");
    this.el.toggleClass("is-right", settings.side !== "left");
    this.el.toggleClass("anchor-top", settings.anchor === "top");
    this.el.toggleClass("anchor-middle", settings.anchor === "middle");
    this.el.toggleClass("anchor-bottom", settings.anchor === "bottom");
    this.flyout.toggleClass("is-left", settings.side === "left");
    this.flyout.toggleClass("is-right", settings.side !== "left");
    this.flyout.dataset.labelMotion = settings.labelMotion || "fade";
    this.el.toggleClass("can-scrub", settings.dragToScrub);
    this.el.toggleClass("has-section-progress", settings.showSectionProgress);
    this.el.dataset.markAlignment = settings.markAlignment || "edge";
    this.el.dataset.progressDirection = settings.progressDirection || "left";
    this.el.toggleClass("hover-wave", settings.hoverStyle === "wave");
    this.el.toggleClass("hover-pill", settings.hoverStyle === "pill");
    this.el.toggleClass("hover-focus", settings.hoverStyle === "focus");
    this.el.toggleClass("hover-dot", settings.hoverStyle === "dot");
    this.el.toggleClass("is-pointing", this.hoveredIndex >= 0);
  }
  updateSettings() {
    this.plugin.applyStyles(this);
    if (this.markStyle !== `${this.settings.showLevel}|${this.settings.hoverStyle}`) {
      this.render(this.levels);
    } else {
      this.updatePresentation();
      this.centers = [];
      this.onLeave();
    }
    this.activeKey = "";
  }
  // levels is an array of heading levels, one per bar. Everything visual is
  // derived from it plus the settings.
  render(levels) {
    const settings = this.settings;
    this.levels = levels;
    this.el.empty();
    this.centers = [];
    this.hoveredIndex = -1;
    this.expandedBranch = -1;
    this.el.style.translate = "";
    this.el.style.removeProperty("--ss-reveal-shift");
    this.hideFlyout();
    this.updatePresentation();
    this.markStyle = `${settings.showLevel}|${settings.hoverStyle}`;
    const topLevel = Math.min(6, ...levels);
    levels.forEach((level, index) => {
      const tick = this.el.createDiv({ cls: "scrollspy-tick" });
      tick.dataset.level = String(level);
      tick.id = `${this.railId}-heading-${index}`;
      tick.setAttribute("role", "option");
      tick.setAttribute(
        "aria-label",
        `Heading level ${level}: ${this.labelFor(index)?.title || `Heading ${index + 1}`}`
      );
      tick.setAttribute("aria-selected", "false");
      tick.style.setProperty("--ss-depth", String(level - topLevel));
      tick.style.setProperty("--ss-boost", "0px");
      const mark = tick.createDiv({ cls: "scrollspy-mark" });
      if (settings.showLevel && settings.hoverStyle === "pill") {
        mark.createSpan({ cls: "scrollspy-level", text: `H${level}` });
      }
    });
    this.paintBookmarks();
    this.updateHierarchy();
    if (this.keyboardFocused)
      this.selectKeyboard(Math.max(0, this.keyboardIndex));
    else this.el.removeAttribute("aria-activedescendant");
  }
  // active is a Set, because "everything on screen" can light several bars at
  // once. current is still a single index: it decides what counts as passed,
  // which stays meaningful however many bars are lit.
  paintActive(active, current) {
    const key = `${current}|${Array.from(active).join(",")}`;
    if (key === this.activeKey) return;
    this.activeKey = key;
    this.activeIndex = current;
    this.updateHierarchy();
    const markPassed = this.settings.markPassed;
    const ticks = this.el.children;
    for (let i = 0; i < ticks.length; i++) {
      const isActive = active.has(i);
      ticks[i].classList.toggle("is-active", isActive);
      ticks[i].classList.toggle(
        "is-passed",
        markPassed && !isActive && i < current
      );
    }
    if (this.drag?.moved && current >= 0 && current !== this.hoveredIndex)
      this.updateDragFeedback(current);
  }
};

// src/rail/preview-rail.ts
var SAMPLE = [
  { level: 1, title: "Margin Rail", percent: 0 },
  { level: 2, title: "What it does", percent: 8 },
  { level: 3, title: "Bars and levels", percent: 16 },
  { level: 3, title: "The swell", percent: 27 },
  { level: 2, title: "Pointing at it", percent: 38 },
  { level: 3, title: "Hit target", percent: 47 },
  { level: 3, title: "Labels", percent: 55 },
  { level: 2, title: "Presets", percent: 66 },
  { level: 3, title: "Saving your own", percent: 74 },
  { level: 1, title: "Notes", percent: 85 },
  { level: 2, title: "Known limits", percent: 93 }
];
var SAMPLE_BODY = "Bar length carries heading depth and cursor proximity at once, because both are widths and simply add together.";
var PreviewRail = class extends RailView {
  constructor(plugin, hostEl) {
    super(plugin, hostEl);
    this.scroller = hostEl.querySelector(
      ".scrollspy-preview-note"
    );
    this.sections = Array.from(
      this.scroller.querySelectorAll(".scrollspy-sample-section")
    );
    this.sampleBookmarks = plugin.previewBookmarks || (plugin.previewBookmarks = /* @__PURE__ */ new Set());
    this.onScroll = () => {
      this.progress = this.scroller.scrollTop / this.scrollRange();
      this.syncActive();
      this.onProgress?.(this.progress);
    };
    this.scroller.addEventListener("scroll", this.onScroll, { passive: true });
    this.onWheel = (event) => {
      if (!this.scroller.contains(event.target) && !this.dense) {
        event.preventDefault();
        this.scroller.scrollTop += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.scroller.clientHeight : 1);
      }
    };
    hostEl.addEventListener("wheel", this.onWheel, { passive: false });
    this.sceneObserver = new ResizeObserver(() => this.fitScene());
    this.sceneObserver.observe(hostEl);
  }
  scrollRange() {
    return Math.max(1, this.scroller.scrollHeight - this.scroller.clientHeight);
  }
  tops() {
    return this.sections.map((section) => section.offsetTop);
  }
  starts() {
    return headingLandingStarts(
      this.tops(),
      this.scrollRange(),
      this.scroller.clientHeight,
      this.tops().map((top) => top + 24)
    );
  }
  fitScene() {
    const s = this.settings;
    const width = Math.max(
      s.tickWidth + (s.hoverStyle === "wave" ? s.waveBoost : 0) + Math.max(s.activeBoost, s.passedBoost) + Math.max(s.pointedBoost, s.focusBoost),
      s.hoverStyle === "pill" ? s.expandWidth : 0,
      s.hoverStyle === "dot" ? s.expandHeight : 0
    );
    const inset = Math.max(18, s.edgeOffset + width + 14);
    this.scroller.style.paddingLeft = `${s.side === "left" ? inset : 18}px`;
    this.scroller.style.paddingRight = `${s.side === "left" ? 18 : inset}px`;
    this.fitPane();
    this.syncActive();
  }
  destroy() {
    this.sceneObserver.disconnect();
    this.scroller.removeEventListener("scroll", this.onScroll);
    this.host.removeEventListener("wheel", this.onWheel);
    super.destroy();
  }
  activate(index) {
    if (!SAMPLE[index]) return;
    const mode = this.settings.trackingMode;
    const progress = mode === "length" ? this.starts()[index] : mode === "equal" ? headingNavigationProgress(
      SAMPLE.map((item) => item.percent),
      100,
      mode,
      index,
      {
        scrollRange: this.scrollRange(),
        viewportHeight: this.scroller.clientHeight,
        headingTop: this.tops()[index],
        headingBottom: this.tops()[index] + 24,
        preferredTop: this.tops()[index],
        lastAtBottom: this.settings.lastAtBottom
      }
    ) : this.tops()[index] / this.scrollRange();
    this.scrubTo(progress ?? 0);
  }
  bookmarkState(index) {
    return {
      available: !!SAMPLE[index],
      saved: this.sampleBookmarks.has(index)
    };
  }
  async bookmarkHeading(index) {
    if (!SAMPLE[index]) return;
    if (this.sampleBookmarks.has(index)) this.sampleBookmarks.delete(index);
    else this.sampleBookmarks.add(index);
  }
  labelFor(index) {
    const item = SAMPLE[index];
    return item ? { title: item.title, percent: item.percent, preview: SAMPLE_BODY } : null;
  }
  rebuild() {
    if (this.progress == null) this.progress = 0.4;
    this.render(SAMPLE.map((item) => item.level));
    this.scroller.scrollTop = this.progress * this.scrollRange();
    this.activeKey = "";
    this.syncActive();
    this.fitScene();
  }
  dragRanges() {
    if (this.settings.trackingMode === "length")
      return physicalHeadingRanges(this.starts());
    if (this.settings.trackingMode === "equal")
      return headingAllocations(
        SAMPLE.map((item) => item.percent),
        100,
        "equal"
      );
    return null;
  }
  scrubTo(progress) {
    this.scroller.scrollTop = clampProgress(progress) * this.scrollRange();
    this.onScroll();
  }
  syncActive() {
    if (!this.scroller) return;
    this.progress = this.scroller.scrollTop / this.scrollRange();
    const tops = this.tops(), lineAt = (y) => {
      let i = tops.findIndex((_top, j) => y < (tops[j + 1] ?? Infinity));
      if (i < 0) i = tops.length - 1;
      return SAMPLE[i].percent + (y - tops[i]) / Math.max(
        1,
        (tops[i + 1] ?? this.scroller.scrollHeight) - tops[i]
      ) * ((SAMPLE[i + 1]?.percent ?? 100) - SAMPLE[i].percent);
    };
    const lines = SAMPLE.map((item) => item.percent), viewport = {
      first: lineAt(this.scroller.scrollTop),
      last: lineAt(this.scroller.scrollTop + this.scroller.clientHeight),
      progress: this.progress,
      scrollable: true,
      atBottom: this.scroller.scrollTop >= this.scrollRange() - 1,
      headingStarts: this.settings.trackingMode === "length" ? this.starts() : null
    };
    const current = resolveCurrent(lines, 100, this.settings, viewport);
    this.paintActive(
      resolveActive(lines, this.settings, viewport, current),
      current
    );
    this.paintProgress(
      sectionProgress(lines, 100, this.settings, viewport, current)
    );
    if (this.showSampleLabel && current >= 0 && this.hoveredIndex < 0)
      this.showFlyout(current);
  }
};

// src/settings/settings-tab.ts
var ScrollspySettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.draftName = "";
    this.updateTargetId = plugin.settings.activePreset === "custom" ? plugin.settings.sourcePresetId : plugin.settings.activePreset;
    this.preview = null;
    this.previewProgress = 0.4;
  }
  hide() {
    if (this.preview) {
      this.previewProgress = this.preview.progress;
      this.preview.destroy();
      this.preview = null;
    }
  }
  // Update the sample immediately; settings persistence is debounced separately.
  save(render = false) {
    this.plugin.saveSettings();
    if (this.preview) {
      this.preview.updateSettings();
      this.preview.syncActive();
      this.preview.fitScene();
    }
    if (this.updateSimulation) this.updateSimulation();
    if (this.presetDrop) {
      const customOptions = Array.from(this.presetDrop.selectEl.options).filter(
        (option) => option.value === "custom"
      );
      const unsaved = this.plugin.settings.activePreset === "custom";
      for (const [index, option] of customOptions.entries()) {
        if (!unsaved || index > 0) option.remove();
      }
      if (unsaved && !customOptions.length)
        this.presetDrop.addOption("custom", "Custom (unsaved)");
      this.presetDrop.setValue(this.plugin.settings.activePreset);
    }
    if (this.presetUpdateEl) this.renderPresetUpdate();
    if (render) this.display();
  }
  // Touching anything a preset captures means you are no longer on that preset.
  // Saying so beats leaving a stale name at the top of the tab.
  edited(key) {
    if (Object.hasOwn(DEFAULTS, key)) {
      const active = this.plugin.settings.activePreset;
      if (active !== "custom") this.plugin.settings.sourcePresetId = active;
      this.plugin.settings.activePreset = "custom";
    }
  }
  capture() {
    return Object.fromEntries(
      PRESET_KEYS.map((key) => [key, this.plugin.settings[key]])
    );
  }
  currentPreset() {
    return this.plugin.settings.presets.find(
      (preset) => preset.id === this.plugin.settings.activePreset
    );
  }
  display() {
    const s = this.plugin.settings, container = this.containerEl;
    const managerOpen = container.querySelector(
      ".scrollspy-preset-manager"
    )?.open;
    const previousSection = container.dataset.section;
    const contentScroll = previousSection === s.settingsSection ? container.scrollTop : 0;
    container.dataset.section = s.settingsSection;
    this.hide();
    this.presetDrop = null;
    this.sectionEl = null;
    container.empty();
    container.addClass("scrollspy-settings");
    container.addClass("scrollspy-workbench");
    const header = container.createDiv({ cls: "scrollspy-settings-header" });
    header.createEl("h2", { text: "Margin Rail" });
    this.renderPresetPicker(header, s);
    const manager = header.createEl("details", {
      cls: "scrollspy-preset-manager"
    });
    manager.open = !!managerOpen;
    container.onpointerdown = (event) => {
      if (manager.open && event.target && !manager.contains(event.target))
        manager.open = false;
    };
    container.onkeydown = (event) => {
      if (event.key === "Escape") manager.open = false;
    };
    manager.createEl("summary", { text: "Save as\u2026" });
    this.sectionEl = manager.createDiv({ cls: "scrollspy-preset-form" });
    this.renderPresets(s);
    this.sectionEl = null;
    this.presetUpdateEl = container.createDiv({
      cls: "scrollspy-preset-update"
    });
    this.renderPresetUpdate();
    const sections = {
      appearance: "Rail",
      tracking: "Behaviour",
      labels: "Labels",
      placement: "Placement"
    };
    if (s.settingsSection === "hover") s.settingsSection = "tracking";
    if (!sections[s.settingsSection]) s.settingsSection = "appearance";
    const nav = container.createDiv({ cls: "scrollspy-nav" });
    nav.setAttribute("role", "tablist");
    for (const [key, title] of Object.entries(sections)) {
      const button = nav.createEl("button", { text: title, type: "button" });
      button.id = `scrollspy-tab-${key}`;
      button.setAttribute("role", "tab");
      button.setAttribute(
        "aria-selected",
        String(!this.filesOpen && key === s.settingsSection)
      );
      button.setAttribute("aria-controls", "scrollspy-settings-panel");
      button.tabIndex = key === s.settingsSection ? 0 : -1;
      const choose = (target) => {
        s.settingsSection = target;
        this.filesOpen = false;
        this.save(true);
        this.containerEl.querySelector(`#scrollspy-tab-${target}`)?.focus({ preventScroll: true });
      };
      button.addEventListener("click", () => choose(key));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const keys = Object.keys(sections), index = keys.indexOf(key);
        choose(
          keys[event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length]
        );
      });
    }
    const body = container.createDiv({ cls: "scrollspy-workbench-body" });
    this.renderPreview(body.createDiv({ cls: "scrollspy-preview-column" }));
    const inspector = body.createDiv({ cls: "scrollspy-inspector" });
    inspector.id = "scrollspy-settings-panel";
    inspector.setAttribute("role", "tabpanel");
    inspector.setAttribute(
      "aria-labelledby",
      `scrollspy-tab-${s.settingsSection}`
    );
    const groups = this.filesOpen ? { css: "CSS snippets", json: "Preset JSON" } : WORKBENCH_GROUPS[s.settingsSection];
    for (const [group, title] of Object.entries(groups)) {
      const section = inspector.createEl("section", {
        cls: "scrollspy-settings-section"
      });
      section.dataset.group = group;
      const header2 = section.createDiv({ cls: "scrollspy-section-header" });
      const heading = header2.createEl("h3", { text: title });
      heading.id = `scrollspy-section-${group}`;
      section.setAttribute("aria-labelledby", heading.id);
      const panel = section.createDiv({ cls: "scrollspy-panel" });
      this.sectionEl = panel;
      if (this.filesOpen) this.renderFiles(group);
      else {
        this.renderWorkbenchGroup(s.settingsSection, group);
        const keys = new Set(this.renderedKeys);
        this.iconButton(header2, "rotate-ccw", `Reset ${title}`, () => {
          for (const key of keys) this.resetField(key);
          this.save(true);
        });
        section.addEventListener("focusin", () => {
          this.preview.el.dataset.previewState = group === "states" ? s.settingsState : "";
          this.preview.syncActive();
        });
      }
    }
    this.preview.el.dataset.previewState = "";
    this.preview.showSampleLabel = !this.filesOpen && s.settingsSection === "labels";
    this.preview.syncActive();
    this.sectionEl = null;
    container.scrollTop = contentScroll;
  }
  iconButton(parent, icon, label, action, cls = "") {
    const button = parent.createEl("button", {
      type: "button",
      cls: `scrollspy-icon-button ${cls}`
    });
    button.setAttribute("aria-label", label);
    button.title = label;
    (0, import_obsidian2.setIcon)(button, icon);
    button.addEventListener("click", action);
    return button;
  }
  resetField(key) {
    this.plugin.settings[key] = { ...DEFAULTS, ...SESSION_DEFAULTS }[key];
    this.edited(key);
  }
  field(key, name) {
    const s = this.plugin.settings, parent = this.sectionEl;
    this.renderedKeys.add(key);
    const row = new import_obsidian2.Setting(parent).setName(name);
    row.settingEl.dataset.key = key;
    if (typeof (DEFAULTS[key] ?? SESSION_DEFAULTS[key]) === "boolean")
      row.addToggle((control) => {
        control.toggleEl.dataset.setting = key;
        control.setValue(Boolean(s[key])).onChange((value) => this.changeField(key, value, true));
      });
    else if (SETTING_OPTIONS[key])
      row.addDropdown((control) => {
        control.selectEl.dataset.setting = key;
        control.addOptions(SETTING_OPTIONS[key]).setValue(String(s[key])).onChange((value) => this.changeField(key, value, true));
      });
    else if (NUMBER_RULES[key]) {
      const [min, max, step, unit] = NUMBER_RULES[key], percent = unit === "%", multiplier = percent ? 100 : 1;
      const effective = this.preview?.settings[key] ?? s[key];
      if (effective !== s[key]) {
        const source = row.controlEl.createEl("button", {
          type: "button",
          text: "CSS",
          cls: "scrollspy-css-source"
        });
        source.setAttribute("aria-label", `${name} overridden by CSS`);
        source.title = "This value comes from a CSS snippet";
        source.addEventListener("click", () => {
          this.filesOpen = true;
          this.display();
        });
      }
      const input = row.controlEl.createEl("input", {
        type: "number",
        cls: "scrollspy-number"
      });
      input.min = String(min * multiplier);
      input.max = String(max * multiplier);
      input.step = String(step * multiplier);
      input.value = String(Number((effective * multiplier).toFixed(2)));
      input.disabled = effective !== s[key];
      input.setAttribute("aria-label", name);
      const commit = () => {
        const value = Number(input.value) / multiplier;
        if (!input.value || !Number.isFinite(value) || value < min || value > max) {
          input.value = String(Number(s[key]) * multiplier);
          return;
        }
        this.changeField(key, value, false);
      };
      input.addEventListener("change", commit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
      });
      if (unit) row.controlEl.createSpan({ text: unit, cls: "scrollspy-unit" });
    } else if (key.toLowerCase().includes("color"))
      row.addColorPicker(
        (control) => control.setValue(String(s[key])).onChange((value) => this.changeField(key, value, false))
      );
    return row;
  }
  changeField(key, value, render) {
    this.plugin.settings[key] = value;
    this.edited(key);
    this.save(render);
    if (render) this.focusSetting(key);
  }
  focusSetting(key) {
    this.containerEl.querySelector(`[data-setting="${key}"]`)?.focus({ preventScroll: true });
  }
  renderWorkbenchGroup(section, group) {
    const s = this.plugin.settings;
    this.renderedKeys = /* @__PURE__ */ new Set();
    const fields = (entries) => entries.forEach(([key, label]) => this.field(key, label));
    switch (`${section}/${group}`) {
      case "appearance/shape": {
        const row = new import_obsidian2.Setting(this.sectionEl).setName("Shape"), choices = {
          bar: ["Bar", { tickHeight: 3, tickRadius: 1 }],
          fine: ["Hairline", { tickHeight: 1, tickRadius: 0 }],
          dot: ["Dot", { tickWidth: 6, tickHeight: 6, tickRadius: 16 }],
          capsule: ["Capsule", { tickHeight: 7, tickRadius: 4 }]
        };
        const shapes = row.controlEl.createDiv({ cls: "scrollspy-shapes" });
        shapes.setAttribute("role", "group");
        shapes.setAttribute("aria-label", "Mark shape");
        for (const [id, [label, values]] of Object.entries(choices)) {
          const button = shapes.createEl("button", { type: "button" });
          button.setAttribute("aria-label", label);
          button.title = label;
          button.dataset.shape = id;
          button.setAttribute(
            "aria-pressed",
            String(
              Object.entries(values).every(([key, value]) => s[key] === value)
            )
          );
          button.createSpan({ cls: `scrollspy-shape-icon shape-${id}` });
          button.addEventListener("click", () => {
            for (const [key, value] of Object.entries(values)) {
              s[key] = value;
              this.edited(key);
            }
            this.save(true);
            this.containerEl.querySelector(`[data-shape="${id}"]`)?.focus({ preventScroll: true });
          });
        }
        fields([
          ["tickWidth", "Length"],
          ["tickHeight", "Thickness"],
          ["tickRadius", "Rounding"],
          ["tickGap", "Spacing"],
          ["markAlignment", "Alignment"]
        ]);
        break;
      }
      case "appearance/states": {
        const states = {
          idle: "Idle",
          current: "Current",
          passed: "Passed",
          hover: "Hover",
          focus: "Keyboard focus"
        };
        new import_obsidian2.Setting(this.sectionEl).setName("Editing state").addDropdown((control) => {
          control.selectEl.dataset.setting = "settingsState";
          control.addOptions(states).setValue(s.settingsState).onChange((value) => {
            s.settingsState = value;
            this.save(true);
            this.preview.el.dataset.previewState = value;
            this.preview.syncActive();
            this.focusSetting("settingsState");
          });
        });
        const stateKeys = {
          idle: ["idleOpacity", null, "idleColorMode", "idleColor"],
          current: ["activeOpacity", "activeBoost", "colorMode", "customColor"],
          passed: [
            "passedOpacity",
            "passedBoost",
            "passedColorMode",
            "passedColor"
          ],
          hover: [
            "pointedOpacity",
            "pointedBoost",
            "pointedColorMode",
            "pointedColor"
          ],
          focus: ["focusOpacity", "focusBoost", "focusColorMode", "focusColor"]
        };
        const keys = stateKeys[s.settingsState] || stateKeys.current;
        this.field(keys[0], "Visibility");
        if (keys[1]) this.field(keys[1], "Extra length");
        this.field(keys[2], "Colour");
        if (s[keys[2]] === "custom") this.field(keys[3], "Custom colour");
        if (s.settingsState === "passed")
          this.field("markPassed", "Distinguish passed headings");
        break;
      }
      case "appearance/headings":
        fields([
          ["hierarchyMode", "Show"],
          ["idleLevels", "Levels at rest"],
          ["levelIndent", "Indent per level"]
        ]);
        break;
      case "tracking/tracking":
        fields([
          ["trackingMode", "Tracking"],
          ["showSectionProgress", "Section fill"]
        ]);
        if (s.showSectionProgress)
          this.field("progressDirection", "Fill direction");
        fields([
          ["activeMode", "Highlight"],
          ["lastAtBottom", "Finish on last heading"]
        ]);
        break;
      case "tracking/pointer":
        fields([
          ["hoverStyle", "On hover"],
          ["animDuration", "Duration"]
        ]);
        if (s.hoverStyle === "wave")
          fields([
            ["waveBoost", "Growth"],
            ["waveReach", "Reach"],
            ["waveFocus", "Focus"]
          ]);
        if (s.hoverStyle === "pill")
          fields([
            ["expandWidth", "Badge length"],
            ["expandHeight", "Badge height"],
            ["showLevel", "Heading level"]
          ]);
        if (s.hoverStyle === "dot") this.field("expandHeight", "Dot size");
        break;
      case "tracking/target":
        fields([
          ["hitbox", "Pointer area"],
          ["hoverOpacity", "Nearby visibility"],
          ["dragToScrub", "Drag to scroll"]
        ]);
        break;
      case "tracking/navigation":
        fields([
          ["placeCursorOnNavigate", "Place cursor at heading"],
          ["highlightOnNavigate", "Highlight destination"]
        ]);
        if (import_obsidian2.Platform?.isMacOS && import_obsidian2.Platform?.isDesktopApp)
          this.field("macDragHaptics", "Haptic ticks while dragging");
        break;
      case "labels/content":
        fields([
          ["showLabels", "Heading label"],
          ["showPreview", "Section excerpt"]
        ]);
        if (s.showPreview) this.field("previewLength", "Excerpt length");
        fields([
          ["showPercent", "Heading percentage"],
          ["showBookmarkButton", "Bookmark button"]
        ]);
        break;
      case "labels/appearance":
        fields([
          ["labelWidth", "Width"],
          ["labelFontSize", "Text size"],
          ["labelPadding", "Padding"],
          ["labelRadius", "Rounding"],
          ["labelOffset", "Distance"],
          ["labelSurface", "Surface"]
        ]);
        break;
      case "labels/motion":
        this.field("labelMotion", "Show and hide");
        if (s.labelMotion !== "none") this.field("labelDuration", "Duration");
        this.field("labelMoveMotion", "Between headings");
        if (s.labelMoveMotion !== "none")
          this.field("labelMoveDuration", "Move duration");
        break;
      case "placement/position":
        fields([
          ["side", "Side"],
          ["anchor", "Anchor"],
          ["edgeOffset", "Edge inset"],
          ["axisOffset", "Vertical offset"]
        ]);
        break;
      case "placement/visibility":
        fields([
          ["minHeadings", "Minimum headings"],
          ["hideBelowWidth", "Minimum pane width"],
          ["phoneVisibility", "On phones"]
        ]);
        break;
    }
  }
  renderPreview(parent) {
    const stage = parent.createDiv({ cls: "scrollspy-stage" });
    const note = stage.createDiv({ cls: "scrollspy-preview-note" });
    note.setAttribute("role", "region");
    note.setAttribute("aria-label", "Scrollable sample note");
    note.tabIndex = 0;
    SAMPLE.forEach((item, index) => {
      const section = note.createDiv({ cls: "scrollspy-sample-section" });
      section.createEl(index ? "h3" : "h2", { text: item.title });
      const body = section.createDiv({ cls: "scrollspy-sample-body" });
      body.setAttribute("aria-hidden", "true");
      const widths = [100, 87, 95, 72, 92, 100, 81, 58];
      for (let line = 0; line < (index % 3 === 0 ? 8 : 5); line++) {
        body.createSpan({ cls: "scrollspy-sample-line" }).style.width = `${widths[(line + index) % widths.length]}%`;
      }
    });
    this.preview = new PreviewRail(this.plugin, stage);
    this.preview.progress = this.previewProgress;
    this.preview.rebuild();
    const toolbar = parent.createDiv({ cls: "scrollspy-preview-toolbar" });
    const progress = toolbar.createSpan({ cls: "scrollspy-preview-progress" });
    progress.setAttribute("aria-label", "Note scroll progress");
    this.updateSimulation = () => {
      if (this.preview)
        progress.setText(`${Math.round(this.preview.progress * 100)}%`);
    };
    this.preview.onProgress = this.updateSimulation;
    this.updateSimulation();
    this.iconButton(
      toolbar,
      "sliders-horizontal",
      "Preview options",
      (event) => {
        const menu = new import_obsidian2.Menu();
        menu.addItem(
          (item) => item.setTitle("Touch preview").setChecked(!!this.previewTouch).onClick(() => {
            this.previewTouch = !this.previewTouch;
            this.preview.simulateTouch = this.previewTouch;
            this.preview.setInputMode(this.previewTouch ? "touch" : "mouse");
          })
        );
        menu.addItem(
          (item) => item.setTitle("Reduced motion").setChecked(!!this.previewReduced).onClick(() => {
            this.previewReduced = !this.previewReduced;
            this.preview.forceReducedMotion = this.previewReduced;
            stage.toggleClass("is-reduced-motion", this.previewReduced);
          })
        );
        menu.showAtMouseEvent(event);
      }
    );
    this.preview.simulateTouch = !!this.previewTouch;
    this.preview.forceReducedMotion = !!this.previewReduced;
    stage.toggleClass("is-reduced-motion", !!this.previewReduced);
  }
  renderFiles(group) {
    const parent = this.sectionEl;
    if (group === "css") {
      parent.createEl("p", {
        cls: "setting-item-description",
        text: "Use an Obsidian CSS snippet. Supported pixel variables override the matching controls and apply to both preview and notes."
      });
      const code = parent.createEl("pre");
      code.createEl("code", {
        text: "body {\n  --margin-rail-mark-width: 24px;\n  --margin-rail-mark-height: 4px;\n  --margin-rail-label-radius: 8px;\n}"
      });
      const details = parent.createEl("details");
      details.createEl("summary", { text: "Supported variables" });
      const list = details.createEl("ul");
      for (const [key, token] of Object.entries(PUBLIC_CSS))
        list.createEl("li", {
          text: `--margin-rail-${token} (${NUMBER_RULES[key][3] || "number"})`
        });
      list.createEl("li", { text: "--margin-rail-current-color (CSS colour)" });
      return;
    }
    const input = parent.createEl("textarea", { cls: "scrollspy-preset-json" });
    input.setAttribute("aria-label", "Preset JSON");
    input.spellcheck = false;
    input.value = this.jsonDraft || JSON.stringify(
      {
        version: 1,
        name: this.currentPreset()?.name || "My rail",
        values: this.capture()
      },
      null,
      2
    );
    input.addEventListener("input", () => {
      this.jsonDraft = input.value;
    });
    const actions = parent.createDiv({ cls: "scrollspy-file-actions" });
    const message = parent.createDiv({ cls: "setting-item-description" });
    message.setAttribute("aria-live", "polite");
    const button = (name, action) => actions.createEl("button", { text: name, type: "button" }).addEventListener("click", action);
    button("Load as preset", () => {
      try {
        const preset = validatePreset(JSON.parse(input.value));
        const id = `user-${Date.now().toString(36)}`;
        this.plugin.settings.presets.push({ id, ...preset });
        Object.assign(this.plugin.settings, preset.values);
        Object.assign(this.plugin.settings, {
          activePreset: id,
          sourcePresetId: id
        });
        this.updateTargetId = id;
        this.save(true);
      } catch (error) {
        message.setText(error instanceof Error ? error.message : String(error));
        message.setAttribute("role", "alert");
      }
    });
    button("Show current JSON", () => {
      this.jsonDraft = null;
      this.display();
    });
    button("Download JSON", () => {
      const doc = parent.ownerDocument, win = doc.defaultView;
      const url = win.URL.createObjectURL(
        new win.Blob([input.value], { type: "application/json" })
      );
      const link = doc.createElement("a");
      link.href = url;
      link.download = "margin-rail-preset.json";
      link.click();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1e3);
    });
    const file = parent.createEl("input", { type: "file" });
    file.accept = ".json,application/json";
    file.setAttribute("aria-label", "Open preset JSON file");
    file.addEventListener("change", async () => {
      if (file.files?.[0]) {
        input.value = await file.files[0].text();
        this.jsonDraft = input.value;
      }
    });
  }
  renderPresetPicker(parent, s) {
    const options = {};
    for (const preset of BUILTIN_PRESETS)
      options[preset.id] = preset.name + (preset.id === "default" ? " (default)" : "");
    for (const preset of s.presets)
      options[preset.id] = preset.name + (BUILTIN_PRESETS.some((builtin2) => builtin2.name === preset.name) ? " (saved)" : "");
    const builtin = BUILTIN_PRESETS.find(
      (preset) => preset.id === s.activePreset
    );
    if (s.activePreset === "custom") options.custom = "Custom (unsaved)";
    new import_obsidian2.Setting(parent).setName("Preset").setDesc(
      builtin ? builtin.description : "Appearance and behaviour from every section."
    ).addDropdown((drop) => {
      this.presetDrop = drop;
      drop.selectEl.dataset.setting = "activePreset";
      const chevron = drop.selectEl.parentElement.createSpan({
        cls: "scrollspy-preset-chevron"
      });
      (0, import_obsidian2.setIcon)(chevron, "chevron-down");
      return drop.addOptions(options).setValue(s.activePreset).onChange((value) => {
        const preset = BUILTIN_PRESETS.find((item) => item.id === value) || s.presets.find((item) => item.id === value);
        if (preset) Object.assign(s, DEFAULTS, preset.values);
        normalizeLegacySettings(s);
        s.activePreset = value;
        if (value !== "custom") s.sourcePresetId = value;
        this.updateTargetId = s.sourcePresetId;
        this.save(true);
        this.focusSetting("activePreset");
      });
    });
    const manage = parent.createEl("button", {
      cls: "scrollspy-preset-menu",
      type: "button"
    });
    (0, import_obsidian2.setIcon)(manage, "ellipsis");
    manage.setAttribute("aria-label", "Preset options");
    manage.setAttribute("aria-haspopup", "menu");
    manage.addEventListener("click", (event) => {
      const menu = new import_obsidian2.Menu();
      menu.addItem(
        (item) => item.setTitle("Save preset as\u2026").onClick(() => {
          const manager = this.containerEl.querySelector(
            ".scrollspy-preset-manager"
          );
          manager.open = true;
          manager.querySelector("input")?.focus();
        })
      );
      menu.addItem(
        (item) => item.setTitle("CSS snippets and preset JSON\u2026").onClick(() => {
          this.filesOpen = true;
          this.display();
        })
      );
      menu.addItem(
        (item) => item.setTitle("Reset to v2").onClick(() => {
          Object.assign(s, DEFAULTS);
          s.activePreset = "default";
          s.sourcePresetId = null;
          this.updateTargetId = null;
          this.save(true);
        })
      );
      const saved = s.presets.find(
        (preset) => preset.id === (s.activePreset === "custom" ? s.sourcePresetId : s.activePreset)
      );
      if (saved)
        menu.addItem(
          (item) => item.setTitle(`Delete \u201C${saved.name}\u201D`).onClick(() => {
            s.presets = s.presets.filter((preset) => preset.id !== saved.id);
            if (s.activePreset === saved.id) s.activePreset = "custom";
            if (s.sourcePresetId === saved.id) s.sourcePresetId = null;
            this.updateTargetId = null;
            this.save(true);
          })
        );
      menu.showAtMouseEvent(event);
    });
  }
  updatePreset() {
    const s = this.plugin.settings;
    const source = s.activePreset === "custom" ? s.sourcePresetId : s.activePreset;
    const id = this.updateTargetId || source;
    const builtin = BUILTIN_PRESETS.find((item) => item.id === id);
    return s.presets.find((item) => item.id === id) || builtin && s.presets.find((item) => item.originBuiltinId === builtin.id) || builtin || null;
  }
  renderPresetUpdate() {
    const group = this.presetUpdateEl;
    group.empty();
    const saved = this.updatePreset();
    group.hidden = this.plugin.settings.activePreset !== "custom" || !saved && !this.plugin.settings.presets.length;
    if (group.hidden) return;
    const update = group.createEl("button", { text: "Update", type: "button" });
    update.disabled = !saved;
    update.setAttribute(
      "aria-label",
      saved ? `Update preset \u201C${saved.name}\u201D` : "Update preset"
    );
    update.addEventListener("click", () => {
      let target = this.updatePreset();
      if (!target) return;
      if (!this.plugin.settings.presets.includes(target)) {
        target = {
          id: `user-${Date.now().toString(36)}`,
          name: target.name,
          originBuiltinId: target.id,
          values: {}
        };
        this.plugin.settings.presets.push(target);
      }
      target.values = this.capture();
      this.plugin.settings.activePreset = target.id;
      this.plugin.settings.sourcePresetId = target.id;
      this.updateTargetId = target.id;
      new import_obsidian2.Notice(`Updated \u201C${target.name}\u201D.`);
      this.save(true);
      this.presetDrop?.selectEl.focus({ preventScroll: true });
    });
    const destinations = [...this.plugin.settings.presets];
    if (saved && !destinations.includes(saved)) destinations.unshift(saved);
    if (saved && destinations.length === 1) {
      group.createSpan({ cls: "scrollspy-update-target" }).createSpan({ text: saved.name });
      return;
    }
    const picker = group.createEl("button", {
      cls: "scrollspy-update-target",
      type: "button"
    });
    picker.createSpan({ text: saved ? saved.name : "Choose preset" });
    (0, import_obsidian2.setIcon)(
      picker.createSpan({ cls: "scrollspy-update-chevron" }),
      "chevron-down"
    );
    picker.setAttribute(
      "aria-label",
      saved ? `Choose preset to update; currently \u201C${saved.name}\u201D` : "Choose preset to update"
    );
    picker.setAttribute("aria-haspopup", "menu");
    picker.addEventListener("click", (event) => {
      const menu = new import_obsidian2.Menu();
      for (const preset of destinations) {
        menu.addItem(
          (item) => item.setTitle(preset.name).setChecked(preset.id === saved?.id).onClick(() => {
            this.updateTargetId = preset.id;
            this.display();
            this.presetUpdateEl.querySelector("[aria-haspopup]")?.focus({ preventScroll: true });
          })
        );
      }
      menu.showAtMouseEvent(event);
    });
  }
  renderPresets(s) {
    const box = this.sectionEl || this.containerEl;
    new import_obsidian2.Setting(box).setName("Save current settings").setDesc(
      "Stores appearance and behaviour from every section under a name."
    ).addText(
      (text) => text.setPlaceholder("Preset name").setValue(this.draftName).onChange((value) => {
        this.draftName = value;
      })
    ).addButton(
      (button) => button.setButtonText("Save").setCta().onClick(() => {
        const name = this.draftName.trim();
        if (!name) {
          new import_obsidian2.Notice("Give the preset a name first.");
          return;
        }
        const id = `user-${Date.now().toString(36)}`;
        s.presets.push({ id, name, values: this.capture() });
        s.activePreset = id;
        s.sourcePresetId = id;
        this.updateTargetId = id;
        this.draftName = "";
        const manager = this.containerEl.querySelector(
          ".scrollspy-preset-manager"
        );
        if (manager) manager.open = false;
        new import_obsidian2.Notice(`Saved preset \u201C${name}\u201D.`);
        this.save(true);
      })
    );
  }
};

// src/rail/document-rail.ts
var import_obsidian3 = require("obsidian");

// src/integrations/bookmarks.ts
function headingSubpath(title) {
  return "#" + title.replace(/([:#|^\\\r\n]|%%|\[\[|]])/g, " ").replace(/\s+/g, " ").trim();
}
function findHeadingBookmark(items, path, subpath) {
  for (const item of items || []) {
    if (item.type === "file" && item.path === path && item.subpath === subpath)
      return item;
    if (item.type === "group" && Array.isArray(item.items)) {
      const found = findHeadingBookmark(item.items, path, subpath);
      if (found) return found;
    }
  }
  return null;
}
function bookmarksCore(app) {
  const core = app.internalPlugins?.getEnabledPluginById?.("bookmarks");
  return core && typeof core.addItem === "function" && typeof core.removeItem === "function" && Array.isArray(core.items) ? core : null;
}

// src/rail/document-rail.ts
var DocumentRail = class extends RailView {
  constructor(plugin, view) {
    super(plugin, view.containerEl);
    this.view = view;
    this.headings = [];
    this.lines = [];
    this.scroller = null;
    this.bookmarksPlugin = null;
    this.onBookmarksChanged = () => {
      this.paintBookmarks();
      this.updateBookmarkButton();
    };
    this.scrollFrame = 0;
    this.onScroll = () => {
      if (this.navigationHighlight && Math.abs(this.scroller.scrollTop - this.navigationHighlightScrollTop) > 1)
        this.clearNavigationHighlight();
      this.scheduleActive();
    };
    this.onNavigationInput = () => this.cancelHeadingNavigation();
    this.resizeObserver = new ResizeObserver(() => {
      this.clearNavigationHighlight();
      this.syncWidth();
      this.scheduleActive();
    });
    this.resizeObserver.observe(view.containerEl);
  }
  destroy() {
    this.clearNavigationHighlight();
    this.cancelHeadingNavigation();
    this.sourceEpoch = (this.sourceEpoch || 0) + 1;
    this.bookmarksPlugin?.off?.("changed", this.onBookmarksChanged);
    this.detachScroller();
    this.resizeObserver.disconnect();
    super.destroy();
  }
  activate(index) {
    this.cancelHeadingNavigation();
    const heading = this.headings[index];
    if (!heading) return;
    const mode = this.view.currentMode;
    const allocated = ["length", "equal"].includes(this.settings.trackingMode);
    const bounds = allocated && this.headingBounds(index);
    if (bounds && bounds.measured !== false && (this.settings.trackingMode !== "length" || this.headingLandingStarts())) {
      this.finishHeadingNavigation(index, true);
      return;
    }
    if (mode && typeof mode.applyScroll === "function") {
      mode.applyScroll(heading.position.start.line);
      if (allocated || this.settings.placeCursorOnNavigate || this.settings.highlightOnNavigate) {
        this.queueHeadingNavigation(heading.position.start.line, true);
      }
    }
  }
  finishHeadingNavigation(index, feedback) {
    const mode = this.view.currentMode;
    const line = this.headings[index].position.start.line;
    if (feedback && this.settings.placeCursorOnNavigate && mode?.type !== "preview" && mode !== this.view.previewMode) {
      const cm = mode?.cm;
      if (cm?.state?.doc && typeof cm.dispatch === "function") {
        const position = cm.state.doc.line(
          Math.min(cm.state.doc.lines, line + 1)
        ).from;
        cm.dispatch({ selection: { anchor: position } });
        cm.contentDOM?.focus?.({ preventScroll: true });
      } else if (this.view.editor?.setCursor) {
        this.view.editor.setCursor({ line, ch: 0 });
      }
    }
    if (["length", "equal"].includes(this.settings.trackingMode))
      this.landAtHeading(index);
    else this.syncActive();
    if (feedback && this.settings.highlightOnNavigate)
      this.showNavigationHighlight(index);
  }
  clearNavigationHighlight() {
    if (this.navigationHighlightTimer)
      clearTimeout(this.navigationHighlightTimer);
    this.navigationHighlightTimer = null;
    this.navigationHighlight?.remove();
    this.navigationHighlight = null;
  }
  showNavigationHighlight(index) {
    this.clearNavigationHighlight();
    const bounds = this.headingBounds(index), el = this.scroller;
    if (!bounds || !el) return;
    const frame = el.getBoundingClientRect();
    const top = Math.max(
      frame.top,
      frame.top + el.clientTop + bounds.top - el.scrollTop
    );
    const bottom = Math.min(
      frame.bottom,
      frame.top + el.clientTop + bounds.bottom - el.scrollTop
    );
    if (bottom <= top) return;
    const highlight = this.navigationHighlight = el.ownerDocument.createElement("div");
    highlight.className = "scrollspy-heading-flash";
    highlight.setAttribute("aria-hidden", "true");
    Object.assign(highlight.style, {
      top: `${top}px`,
      left: `${frame.left + el.clientLeft}px`,
      width: `${el.clientWidth}px`,
      height: `${bottom - top}px`
    });
    el.ownerDocument.body.appendChild(highlight);
    this.navigationHighlightScrollTop = el.scrollTop;
    this.navigationHighlightTimer = setTimeout(
      () => this.clearNavigationHighlight(),
      1400
    );
  }
  cancelHeadingNavigation() {
    this.pendingNavigation = null;
    if (this.navigationFrame)
      this.navigationWindow.cancelAnimationFrame(this.navigationFrame);
    this.navigationFrame = 0;
  }
  queueHeadingNavigation(line, feedback = false) {
    this.cancelHeadingNavigation();
    const request = this.pendingNavigation = {
      line,
      file: this.view.file,
      mode: this.view.currentMode,
      ready: false,
      feedback
    };
    const win = this.navigationWindow = this.host.ownerDocument.defaultView;
    const schedule = () => {
      if (this.pendingNavigation !== request) return;
      if (this.navigationFrame) win.cancelAnimationFrame(this.navigationFrame);
      this.navigationFrame = win.requestAnimationFrame(() => {
        this.navigationFrame = win.requestAnimationFrame(() => {
          this.navigationFrame = 0;
          if (this.pendingNavigation !== request) return;
          request.ready = true;
          this.applyPendingNavigation();
        });
      });
    };
    const renderer = this.view.currentMode?.renderer;
    if (typeof renderer?.onRendered === "function")
      renderer.onRendered(schedule);
    else schedule();
  }
  applyPendingNavigation() {
    const request = this.pendingNavigation;
    if (!request?.ready) return false;
    if (request.file !== this.view.file || request.mode !== this.view.currentMode) {
      this.pendingNavigation = null;
      return false;
    }
    if (!this.sourceReady) return false;
    this.pendingNavigation = null;
    this.attachScroller();
    const index = this.headings.findIndex(
      (heading) => heading.position.start.line === request.line
    );
    if (index < 0) return false;
    this.finishHeadingNavigation(index, request.feedback);
    return true;
  }
  headingBounds(index) {
    const heading = this.headings[index];
    const line = heading.position.start.line;
    const mode = this.view.currentMode;
    const cm = mode?.cm;
    if (cm?.state?.doc && typeof cm.lineBlockAt === "function") {
      const position = cm.state.doc.line(
        Math.min(cm.state.doc.lines, line + 1)
      ).from;
      const block = cm.lineBlockAt(position);
      const top = block.top + (cm.contentDOM?.offsetTop || 0);
      return { top, bottom: top + block.height, measured: true };
    }
    for (const section of mode?.renderer?.sections || []) {
      if (section.lineStart > line || section.lineEnd < line) continue;
      const nodes = Array.from(
        section.el?.querySelectorAll?.("h1,h2,h3,h4,h5,h6") || []
      );
      const node = section.lineStart === line ? nodes[0] : nodes.find(
        (node2) => node2.getAttribute("data-heading") === heading.heading || node2.textContent.trim() === heading.heading
      );
      if (!node) continue;
      const box = node.getBoundingClientRect();
      if (!box.height) continue;
      const offset = this.scroller.scrollTop - this.scroller.getBoundingClientRect().top - this.scroller.clientTop;
      return {
        top: box.top + offset,
        bottom: box.bottom + offset,
        measured: true
      };
    }
    for (const section of mode?.renderer?.sections || []) {
      if (section.lineStart > line || section.lineEnd < line || !section.el)
        continue;
      const fraction = (line - section.lineStart) / Math.max(1, section.lineEnd - section.lineStart + 1);
      const renderer = mode.renderer;
      if (typeof renderer.getSectionTop === "function" && Number.isFinite(section.height)) {
        const offset = renderer.getSectionTop(section);
        if (offset >= 0) {
          const top2 = offset + (renderer.topSpace || 0) + fraction * section.height;
          return { top: top2, bottom: top2, measured: false };
        }
      }
      const box = section.el.getBoundingClientRect();
      if (!box.height) continue;
      const top = box.top + this.scroller.scrollTop - this.scroller.getBoundingClientRect().top - this.scroller.clientTop + fraction * box.height;
      return { top, bottom: top, measured: false };
    }
    return null;
  }
  headingLandingStarts() {
    const el = this.scroller;
    if (!el) return null;
    const bounds = this.headings.map(
      (_, index) => this.headingBounds(index)
    );
    const tops = bounds.map((bounds2) => bounds2?.top);
    if (tops.some((top) => !Number.isFinite(top))) return null;
    return headingLandingStarts(
      tops,
      Math.max(0, el.scrollHeight - el.clientHeight),
      el.clientHeight,
      bounds.map((bounds2) => bounds2.bottom)
    );
  }
  landAtHeading(index) {
    const el = this.scroller;
    if (!el) return;
    if (this.settings.trackingMode === "length") {
      const starts = this.headingLandingStarts();
      if (starts) this.scrubTo(starts[index], true);
      else this.syncActive();
      return;
    }
    const bounds = this.headingBounds(index);
    const progress = headingNavigationProgress(
      this.headings.map((item) => item.position.start.line),
      this.lines.length,
      this.settings.trackingMode,
      index,
      {
        scrollRange: Math.max(0, el.scrollHeight - el.clientHeight),
        viewportHeight: el.clientHeight,
        headingTop: bounds?.top,
        headingBottom: bounds?.bottom,
        preferredTop: el.scrollTop,
        lastAtBottom: this.settings.lastAtBottom
      }
    );
    if (progress !== null) this.scrubTo(progress, true);
  }
  dragRanges() {
    if (this.settings.trackingMode === "length") {
      const starts = this.headingLandingStarts();
      return starts ? physicalHeadingRanges(starts) : null;
    }
    if (this.settings.trackingMode === "equal") {
      return headingAllocations(
        this.headings.map((heading) => heading.position.start.line),
        this.lines.length,
        "equal"
      );
    }
    return null;
  }
  dragSectionIndex() {
    if (this.settings.trackingMode !== "off") return this.activeIndex;
    const starts = this.headingLandingStarts();
    const el = this.scroller;
    const range = el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
    return resolveCurrent(
      this.headings.map((heading) => heading.position.start.line),
      this.lines.length,
      {
        ...this.settings,
        trackingMode: starts ? "length" : "position",
        lastAtBottom: false
      },
      {
        headingStarts: starts,
        first: this.scrollTopLine(),
        progress: range ? el.scrollTop / range : 0
      }
    );
  }
  scrubTo(progress, alignToPixel = false) {
    const el = this.scroller;
    if (!el) return;
    const previous = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    const top = clampProgress(progress) * Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = alignToPixel ? Math.round(top) : top;
    el.style.scrollBehavior = previous;
    this.syncActive();
  }
  labelFor(index) {
    const heading = this.headings[index];
    if (!heading) return null;
    return {
      title: heading.heading,
      percent: this.percentAt(index),
      preview: this.previewAt(index)
    };
  }
  bookmarkState(index) {
    const core = bookmarksCore(this.view.app);
    const file = this.view.file;
    const heading = this.headings[index];
    return {
      available: !!(core && file && heading),
      saved: !!(core && file && heading && findHeadingBookmark(
        core.items,
        file.path,
        headingSubpath(heading.heading)
      ))
    };
  }
  async bookmarkHeading(index) {
    const core = bookmarksCore(this.view.app);
    const file = this.view.file;
    const heading = this.headings[index];
    if (!core || !file || !heading) return;
    const subpath = headingSubpath(heading.heading);
    const existing = findHeadingBookmark(core.items, file.path, subpath);
    if (existing) {
      await core.removeItem(existing);
      return;
    }
    await core.addItem({
      type: "file",
      path: file.path,
      subpath,
      ctime: Date.now()
    });
  }
  // How far into the document this heading sits, by line. Lines rather than
  // pixels because that is the unit the rest of the plugin already works in,
  // and it does not change with window width or folded sections.
  percentAt(index) {
    if ((this.headings.at(-1)?.position.start.line ?? -1) >= this.lines.length)
      return null;
    const span = Math.max(1, this.lines.length - 1);
    const line = this.headings[index].position.start.line;
    return Math.min(100, Math.round(line / span * 100));
  }
  // The body between this heading and the next, flattened to one line. Markdown
  // is stripped roughly -- this is a glance, not a render.
  previewAt(index) {
    if (!this.settings.showPreview) return "";
    const start = this.headings[index].position.start.line + 1;
    const next = this.headings[index + 1];
    const end = next ? next.position.start.line : this.lines.length;
    const text = this.lines.slice(start, end).map(
      (line) => line.replace(/^\s*>\s?/, "").replace(/^\s*[-*+]\s+/, "").replace(/^\s*\d+\.\s+/, "").replace(/^\s*\|/, "")
    ).join(" ").replace(/!?\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~]/g, "").replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const limit = this.settings.previewLength;
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}\u2026` : text;
  }
  // The scroll container differs per mode and is replaced when the mode changes,
  // so re-resolve it on every rebuild rather than caching it once.
  attachScroller() {
    const mode = this.view.currentMode;
    const reading = mode && mode === this.view.previewMode || mode?.type === "preview" || this.view.getMode?.() === "preview";
    const next = reading ? mode?.renderer?.previewEl || this.view.containerEl.querySelector(
      ".markdown-reading-view .markdown-preview-view"
    ) : mode?.cm?.scrollDOM || this.view.editor?.cm?.scrollDOM || this.view.containerEl.querySelector(
      ".markdown-source-view .cm-scroller"
    );
    if (next === this.scroller) return;
    this.detachScroller();
    this.scroller = next;
    if (this.scroller) {
      this.scroller.addEventListener("scroll", this.onScroll, {
        passive: true
      });
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        this.scroller.addEventListener(event, this.onNavigationInput, {
          passive: true
        });
      }
    }
  }
  scheduleActive() {
    if (this.scrollFrame) return;
    const win = this.host.ownerDocument.defaultView;
    this.scrollWindow = win;
    this.scrollFrame = win.requestAnimationFrame(() => {
      this.scrollFrame = 0;
      this.scrollWindow = null;
      this.syncActive();
    });
  }
  cancelActiveFrame() {
    if (this.scrollFrame)
      this.scrollWindow.cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = 0;
    this.scrollWindow = null;
  }
  detachScroller() {
    this.cancelActiveFrame();
    if (this.scroller) {
      this.scroller.removeEventListener("scroll", this.onScroll);
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        this.scroller.removeEventListener(event, this.onNavigationInput);
      }
    }
    this.scroller = null;
  }
  visibilityReason() {
    const win = this.host.ownerDocument?.defaultView;
    return railVisibilityReason(this.settings, {
      phone: !!import_obsidian3.Platform?.isPhone,
      landscape: !!win?.matchMedia?.("(orientation: landscape)").matches,
      width: this.view.containerEl.clientWidth,
      headings: this.headings.length
    });
  }
  syncWidth() {
    this.fitPane();
    const hidden = !!this.visibilityReason();
    this.el.toggleClass("is-cramped", hidden);
    if (hidden) this.onLeave();
    this.centers = [];
  }
  syncBookmarks() {
    const core = bookmarksCore(this.view.app);
    if (core !== this.bookmarksPlugin) {
      this.bookmarksPlugin?.off?.("changed", this.onBookmarksChanged);
      this.bookmarksPlugin = core;
      core?.on?.("changed", this.onBookmarksChanged);
      this.paintBookmarks();
      this.updateBookmarkButton();
    }
  }
  metadataKey() {
    return JSON.stringify(
      this.view.file ? this.view.app.metadataCache.getFileCache(this.view.file)?.headings || [] : []
    );
  }
  refresh(force = false, checkMetadata = false) {
    this.syncBookmarks();
    if (force || this.file !== this.view.file || this.filePath !== this.view.file?.path || checkMetadata && this.cachedMetadataKey !== this.metadataKey()) {
      this.rebuild();
      return;
    }
    if (!this.sourceReady) this.refreshSource();
    this.attachScroller();
    this.syncWidth();
    this.scheduleActive();
  }
  updateSettings() {
    super.updateSettings();
    this.el.toggleClass(
      "is-hidden",
      this.headings.length < this.settings.minHeadings
    );
    this.syncWidth();
    this.syncActive();
  }
  rebuild() {
    this.syncBookmarks();
    const settings = this.settings;
    const file = this.view.file;
    this.file = file;
    this.filePath = file?.path;
    this.cachedMetadataKey = this.metadataKey();
    const cache = file ? this.view.app.metadataCache.getFileCache(file) : null;
    this.headings = cache && cache.headings || [];
    this.refreshSource();
    this.render(this.headings.map((heading) => heading.level));
    this.el.toggleClass(
      "is-hidden",
      this.headings.length < settings.minHeadings
    );
    this.activeIndex = -1;
    this.activeKey = "";
    this.attachScroller();
    this.syncWidth();
    this.syncActive();
  }
  refreshSource() {
    const epoch = this.sourceEpoch = (this.sourceEpoch || 0) + 1;
    const file = this.view.file;
    const lines = this.view.getViewData().split("\n");
    const lastHeading = this.headings.at(-1)?.position.start.line ?? -1;
    this.sourceReady = lines.length > lastHeading;
    this.lines = lines;
    if (this.sourceReady || !file || !this.view.app.vault?.cachedRead) return;
    this.view.app.vault.cachedRead(file).then((text) => {
      if (this.sourceEpoch !== epoch || this.view.file !== file) return;
      this.lines = text.split("\n");
      this.sourceReady = this.lines.length > lastHeading;
      this.syncActive();
      if (this.flyoutIndex >= 0) this.showFlyout(this.flyoutIndex);
    }).catch(() => {
    });
  }
  scrollTopLine() {
    const mode = this.view.currentMode;
    return (mode && typeof mode.getScroll === "function" ? mode.getScroll() : 0) || 0;
  }
  atBottom() {
    const el = this.scroller;
    if (!el) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 2;
  }
  /*
   * Which source lines are actually on screen.
   *
   * The obvious proportional guess -- total lines times the fraction of the
   * scroll range on screen -- assumes every line renders to the same height.
   * It does not: a screenful of headings and list items covers far more lines
   * than a screenful of a table or a code block, so the guess overshoots badly
   * exactly where headings are dense. Both editors can answer properly, so ask
   * them, and keep the guess only as a last resort.
   */
  visibleRange() {
    const top = this.scrollTopLine();
    const mode = this.view.currentMode;
    const reading = mode && mode === this.view.previewMode || mode?.type === "preview" || this.view.getMode?.() === "preview";
    const cm = !reading && (mode?.cm || this.view.editor?.cm);
    if (cm && typeof cm.posAtCoords === "function" && cm.scrollDOM) {
      const box = cm.scrollDOM.getBoundingClientRect();
      const x = box.left + 8;
      const head = cm.posAtCoords({ x, y: box.top + 2 }, false);
      const foot = cm.posAtCoords({ x, y: box.bottom - 2 }, false);
      if (head != null && foot != null) {
        return [
          cm.state.doc.lineAt(head).number - 1,
          cm.state.doc.lineAt(foot).number - 1
        ];
      }
    }
    const sections = reading && mode?.renderer?.sections;
    if (sections && sections.length && this.scroller) {
      const frame = this.scroller.getBoundingClientRect();
      let first = Infinity;
      let last = -Infinity;
      for (const section of sections) {
        if (!section || !section.el || typeof section.lineStart !== "number")
          continue;
        const box = section.el.getBoundingClientRect();
        if (!box.height || box.bottom < frame.top || box.top > frame.bottom)
          continue;
        first = Math.min(first, section.lineStart);
        last = Math.max(last, section.lineEnd);
      }
      if (last >= first) return [first, last];
    }
    const el = this.scroller;
    const span = el && el.scrollHeight ? Math.max(1, this.lines.length * (el.clientHeight / el.scrollHeight)) : 0;
    return [top, top + span];
  }
  syncActive() {
    if (this.applyPendingNavigation()) return;
    if (!this.headings.length) return;
    const needsRange = this.settings.trackingMode === "position" || this.settings.activeMode === "visible";
    const topLine = this.scrollTopLine();
    const [first, last] = needsRange ? this.visibleRange() : [topLine, topLine];
    const el = this.scroller;
    const scrollRange = el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
    const viewport = {
      first,
      last,
      topLine,
      progress: scrollRange > 0 ? el.scrollTop / scrollRange : 0,
      scrollable: scrollRange > 2,
      atBottom: this.atBottom(),
      headingStarts: this.settings.trackingMode === "length" ? this.headingLandingStarts() : null
    };
    const lines = this.headings.map(
      (heading) => heading.position.start.line
    );
    if (this.settings.trackingMode === "length" && !viewport.headingStarts) {
      const current2 = resolveCurrent(
        lines,
        this.lines.length,
        { ...this.settings, trackingMode: "position" },
        viewport
      );
      this.paintActive(
        resolveActive(lines, this.settings, viewport, current2),
        current2
      );
      this.paintProgress(
        sectionProgress(
          lines,
          this.lines.length,
          { ...this.settings, trackingMode: "position" },
          viewport,
          current2
        )
      );
      return;
    }
    const current = resolveCurrent(
      lines,
      this.lines.length,
      this.settings,
      viewport
    );
    const active = resolveActive(lines, this.settings, viewport, current);
    this.paintActive(active, current);
    this.paintProgress(
      sectionProgress(
        lines,
        this.lines.length,
        this.settings,
        viewport,
        current
      )
    );
  }
};

// src/integrations/haptics.ts
var MAC_HAPTIC_SCRIPT = String.raw`
ObjC.import("AppKit");
var input = $.NSFileHandle.fileHandleWithStandardInput;
var output = $.NSFileHandle.fileHandleWithStandardOutput;
output.writeData($("ready\n").dataUsingEncoding($.NSUTF8StringEncoding));
while (true) {
  var data = input.readDataOfLength(1);
  if (!data.length) break;
  $.NSHapticFeedbackManager.defaultPerformer.performFeedbackPatternPerformanceTime(
    $.NSHapticFeedbackPatternAlignment, $.NSHapticFeedbackPerformanceTimeNow);
}
`;
var MacDragHaptics = class {
  constructor(spawn, now = () => Date.now()) {
    this.spawn = spawn;
    this.now = now;
    this.child = null;
    this.owner = null;
    this.failed = false;
  }
  begin(owner) {
    this.end();
    if (this.failed) return;
    this.owner = owner;
    this.ready = false;
    this.lastTick = -Infinity;
    try {
      const child = this.child = this.spawn(
        "/usr/bin/osascript",
        ["-l", "JavaScript", "-e", MAC_HAPTIC_SCRIPT],
        { stdio: ["pipe", "pipe", "ignore"], windowsHide: true }
      );
      let output = "";
      child.stdout.on("data", (data) => {
        if (this.child !== child) return;
        output += data.toString();
        if (output.includes("ready\n")) {
          this.ready = true;
          if (this.startupTimer) clearTimeout(this.startupTimer);
          this.startupTimer = null;
        }
      });
      const fail = () => {
        if (this.child !== child) return;
        this.failed = true;
        this.end();
      };
      child.on("error", fail);
      child.on("exit", fail);
      child.stdin.on("error", fail);
      this.startupTimer = setTimeout(fail, 2e3);
    } catch (_) {
      this.failed = true;
      this.end();
    }
  }
  tick(owner) {
    if (owner !== this.owner || !this.ready || !this.child?.stdin.writable)
      return;
    const now = this.now();
    if (now - this.lastTick < 80 || this.child.stdin.writableLength) return;
    this.lastTick = now;
    try {
      this.child.stdin.write("t");
    } catch (_) {
      this.failed = true;
      this.end();
    }
  }
  end(owner) {
    if (owner && owner !== this.owner) return;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    const child = this.child;
    this.child = null;
    this.owner = null;
    this.ready = false;
    if (child) {
      child.stdin.destroy();
      child.kill();
    }
  }
};

// src/plugin.ts
var ScrollspyRailPlugin = class extends import_obsidian4.Plugin {
  async onload() {
    this.rails = /* @__PURE__ */ new Map();
    this.settings = Object.assign(
      {},
      DEFAULTS,
      SESSION_DEFAULTS,
      await this.loadData()
    );
    normalizeLegacySettings(this.settings);
    const selected = this.settings.presets.find(
      (preset) => preset.id === this.settings.activePreset
    );
    if (selected?.name === "v2" && PRESET_KEYS.every((key) => this.settings[key] === DEFAULTS[key])) {
      this.settings.activePreset = "default";
      await this.saveData(this.settings);
    }
    this.refresh = this.refresh.bind(this);
    this.settingTab = new ScrollspySettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.applyStyles();
    this.registerEvent(this.app.workspace.on("layout-change", this.refresh));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", this.refresh)
    );
    this.registerEvent(this.app.workspace.on("file-open", this.refresh));
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        for (const rail of this.rails.values()) rail.updateSettings();
        if (this.settingTab?.preview) this.settingTab.display();
      })
    );
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => this.refresh(false, true))
    );
    this.addCommand({
      id: "refresh-rail",
      name: "Refresh rail and show status",
      callback: () => {
        this.refresh(true);
        const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
        const rail = view ? this.rails.get(view) : null;
        if (!view || !rail) {
          new import_obsidian4.Notice("Margin Rail: open a Markdown note first.");
          return;
        }
        const count = rail.headings.length;
        const width = view.containerEl.clientWidth;
        const reason = rail.visibilityReason() || (!rail.scroller ? "Waiting for the note\u2019s scroll container." : "Rail ready.");
        new import_obsidian4.Notice(
          `Margin Rail: ${count} headings, ${width}px pane. ${reason}`,
          1e4
        );
      }
    });
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        for (const [view, rail] of this.rails) {
          if (view.file?.path === file.path) rail.rebuild();
        }
      })
    );
    this.installHeadingNavigation();
    this.app.workspace.onLayoutReady(this.refresh);
  }
  beginDragHaptics(rail) {
    if (!this.settings.macDragHaptics || !import_obsidian4.Platform?.isMacOS || !import_obsidian4.Platform?.isDesktopApp)
      return;
    if (!this.dragHaptics) {
      try {
        this.dragHaptics = new MacDragHaptics(require("child_process").spawn);
      } catch (_) {
        return;
      }
    }
    this.dragHaptics.begin(rail);
  }
  tickDragHaptics(rail) {
    if (this.settings.macDragHaptics) this.dragHaptics?.tick(rail);
  }
  endDragHaptics(rail) {
    this.dragHaptics?.end(rail);
  }
  installHeadingNavigation() {
    const proto = import_obsidian4.MarkdownView?.prototype;
    const original = proto?.setEphemeralState;
    if (typeof original !== "function" || typeof import_obsidian4.resolveSubpath !== "function")
      return;
    const plugin = this;
    let enabled = true;
    function navigate(state, ...args) {
      if (enabled && state && ["subpath", "line", "scroll"].some(
        (key) => Object.prototype.hasOwnProperty.call(state, key)
      )) {
        plugin.rails.get(this)?.cancelHeadingNavigation();
      }
      const result = Reflect.apply(original, this, [state, ...args]);
      if (!enabled || !["length", "equal"].includes(plugin.settings.trackingMode) || typeof state?.subpath !== "string" || !this.file)
        return result;
      const cache = this.app.metadataCache.getFileCache(this.file);
      if (!cache) return result;
      const target = (0, import_obsidian4.resolveSubpath)(cache, state.subpath);
      if (target?.type !== "heading") return result;
      plugin.refresh();
      plugin.rails.get(this)?.queueHeadingNavigation(target.start.line);
      return result;
    }
    proto.setEphemeralState = navigate;
    this.register(() => {
      enabled = false;
      if (proto.setEphemeralState === navigate)
        proto.setEphemeralState = original;
    });
  }
  onunload() {
    this.dragHaptics?.end();
    this.flushSettings();
    this.settingTab?.hide();
    for (const rail of this.rails.values()) rail.destroy();
    this.rails.clear();
  }
  saveSettings() {
    if (!this.settings.macDragHaptics) this.dragHaptics?.end();
    for (const rail of this.rails.values()) rail.updateSettings();
    if (this.settingsTimer) clearTimeout(this.settingsTimer);
    this.settingsTimer = setTimeout(() => this.flushSettings(), 250);
  }
  flushSettings() {
    if (!this.settingsTimer) return this.settingsWrite;
    clearTimeout(this.settingsTimer);
    this.settingsTimer = 0;
    const snapshot = JSON.parse(JSON.stringify(this.settings));
    this.settingsWrite = (this.settingsWrite || Promise.resolve()).then(() => this.saveData(snapshot)).catch(() => {
      new import_obsidian4.Notice(
        "Margin Rail: could not save settings. Try changing the setting again."
      );
    });
    return this.settingsWrite;
  }
  // Scope variables to owned elements, including preview rails and popouts.
  applyStyles(rail) {
    const s = { ...this.settings };
    const win = rail?.host.ownerDocument.defaultView;
    if (rail && typeof win?.getComputedStyle === "function") {
      const css = win.getComputedStyle(rail.el);
      for (const [key, token] of Object.entries(PUBLIC_CSS)) {
        const text = css.getPropertyValue(`--margin-rail-${token}`).trim(), rule = NUMBER_RULES[key];
        const pixel = rule[3] === "px";
        if (!(pixel ? /^-?\d*\.?\d+px$/ : /^\d*\.?\d+$/).test(text)) continue;
        const value = Number.parseFloat(text);
        if (Number.isFinite(value) && value >= rule[0] && value <= rule[1])
          s[key] = value;
      }
      const color = css.getPropertyValue("--margin-rail-current-color").trim();
      if (color && win.CSS?.supports("color", color)) {
        s.colorMode = "custom";
        s.customColor = color;
      }
      rail.effectiveSettings = s;
    }
    const active = s.colorMode === "custom" ? s.customColor : COLOR_SOURCES[s.colorMode];
    const vars = {
      "--ss-edge-offset": `${s.edgeOffset}px`,
      "--ss-axis-offset": `${s.axisOffset}px`,
      "--ss-tick-width": `${s.tickWidth}px`,
      "--ss-tick-height": `${s.tickHeight}px`,
      "--ss-tick-radius": `${s.tickRadius}px`,
      "--ss-tick-gap": `${s.tickGap}px`,
      "--ss-level-indent": `${s.levelIndent}px`,
      "--ss-active-boost": `${s.activeBoost}px`,
      "--ss-passed-boost": `${s.passedBoost}px`,
      "--ss-active-opacity": String(s.activeOpacity),
      "--ss-passed-opacity": String(s.passedOpacity),
      "--ss-hitbox": `${s.hitbox}px`,
      "--ss-wave-boost": `${s.hoverStyle === "wave" ? s.waveBoost : 0}px`,
      "--ss-expand-width": `${s.expandWidth}px`,
      "--ss-expand-height": `${s.expandHeight}px`,
      "--ss-anim": `${s.animDuration}ms`,
      "--ss-idle-opacity": String(s.idleOpacity),
      "--ss-hover-opacity": String(s.hoverOpacity),
      "--ss-label-offset": `${s.labelOffset}px`,
      "--ss-label-duration": `${s.labelDuration ?? 120}ms`,
      "--ss-active-color": active,
      "--ss-pointed-opacity": String(s.pointedOpacity ?? 1),
      "--ss-focus-opacity": String(s.focusOpacity ?? 1),
      "--ss-pointed-boost": `${s.pointedBoost ?? 0}px`,
      "--ss-focus-boost": `${s.focusBoost ?? 0}px`,
      "--ss-label-width": `${s.labelWidth ?? 300}px`,
      "--ss-label-size": `${s.labelFontSize ?? 12}px`,
      "--ss-label-padding": `${s.labelPadding ?? 9}px`,
      "--ss-label-radius": `${s.labelRadius ?? 5}px`
    };
    const doc = rail?.host.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (doc?.body && !(this.cleanedDocuments ||= /* @__PURE__ */ new WeakSet()).has(doc)) {
      for (const name of Object.keys(vars)) doc.body.style.removeProperty(name);
      this.cleanedDocuments.add(doc);
    }
    if (!rail) return;
    for (const state of ["idle", "passed", "pointed", "focus"]) {
      const mode = state === "idle" && s.idleColorMode === "inherit" ? "text" : s[`${state}ColorMode`];
      const color = mode === "custom" ? s[`${state}Color`] : mode === "accent" ? "var(--text-accent)" : mode === "text" ? "var(--text-normal)" : "inherit";
      vars[`--ss-${state}-color`] = color;
      rail.el.dataset[`${state}ColorMode`] = mode || "text";
    }
    rail.flyout.dataset.surface = s.labelSurface || "theme";
    for (const el of [rail.el, rail.flyout]) {
      for (const [name, value] of Object.entries(vars))
        el.style.setProperty(name, value);
    }
  }
  refresh(force = false, checkMetadata = false) {
    const live = /* @__PURE__ */ new Set();
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian4.MarkdownView)) continue;
      live.add(view);
      let rail = this.rails.get(view);
      if (!rail) {
        rail = new DocumentRail(this, view);
        this.rails.set(view, rail);
        rail.rebuild();
      } else rail.refresh(force === true, checkMetadata);
    }
    for (const [view, rail] of this.rails) {
      if (live.has(view)) continue;
      rail.destroy();
      this.rails.delete(view);
    }
  }
};
module.exports = module.exports.default;
