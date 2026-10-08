"use strict";

/*
 * Margin Rail
 *
 * One rail per open markdown pane. Headings come from Obsidian's metadata cache,
 * so the list is always complete even though both editors virtualise their DOM.
 * Scroll position comes from view.currentMode.getScroll(), which reports a line
 * number in BOTH reading mode and live preview -- that is the whole trick, and it
 * is why this needs no per-mode special casing. Physical tracking uses
 * applyScroll(); allocation tracking navigates to the same scroll share it paints.
 *
 * Bar length carries two things at once: heading level (a fixed indent per level)
 * and cursor proximity (a dock-style swell added on top). Both are widths, so they
 * compose rather than competing for the same channel.
 *
 * The rail, not the bar, is the pointer target. Whichever bar's centre is nearest
 * the cursor is the one that highlights, labels and jumps.
 *
 * RailView owns all of that behaviour. DocumentRail binds it to a markdown pane;
 * PreviewRail binds it to a sample in the settings tab, which is why the preview
 * behaves exactly like the real thing rather than approximating it.
 *
 * Appearance is driven by CSS custom properties scoped to each rail and its label by applyStyles().
 * The settings tab also refreshes rail markup when behaviour changes.
 *
 * No build step. Edit this file directly and reload the plugin.
 */

const {
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownView,
  Notice,
  Menu,
  setIcon,
  getIcon,
  Platform,
  resolveSubpath,
} = require("obsidian");

// A heading counts as current once its line reaches just past the viewport top.
const LOOKAHEAD_LINES = 1;

/* The saved v2 setup is the fresh-install default. */
const DEFAULTS = {
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
  markAlignment: "edge", // edge | left | center | right
  progressDirection: "left", // left | right | center

  // Hover
  hoverStyle: "wave", // wave | pill | focus | dot | none
  hitbox: 36,
  waveBoost: 30,
  waveReach: 60,
  waveFocus: 3,
  expandWidth: 30,
  expandHeight: 16,
  showLevel: true,
  animDuration: 220,

  // Current section
  activeMode: "single", // "single" | "visible"
  activeBoost: 4,
  trackingMode: "length", // position | length | equal | off
  lastAtBottom: true,
  activeOpacity: 1,
  passedOpacity: 0.4,
  passedBoost: 0,

  // Colour
  idleOpacity: 0.25,
  hoverOpacity: 0.55,
  colorMode: "neutral", // "neutral" | "accent" | "custom"
  customColor: "#9aa0a6",

  // Labels
  showLabels: true,
  labelOffset: 10,
  labelMotion: "fade", // none | fade | slide
  labelDuration: 120,
  labelMoveMotion: "none", // none | slide; between marks
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
  hierarchyMode: "nearby", // all | nearby
  idleLevels: 6,
  showSectionProgress: false,
};

// Not part of a preset: these describe the preset system and the settings tab
// itself, so copying them between presets would be meaningless.
const SESSION_DEFAULTS = {
  activePreset: "default",
  presets: [], // [{ id, name, values }]
  sourcePresetId: null, // Saved preset being customized; survives Custom (unsaved).
  showAdvanced: false,
  settingsSection: "appearance",
  previewCollapsed: false,
  phoneVisibility: "hidden", // hidden | landscape | always; independent of presets
  placeCursorOnNavigate: false,
  highlightOnNavigate: false,
  macDragHaptics: false,
};

const PRESET_KEYS = Object.keys(DEFAULTS);

const BUILTIN_PRESETS = [
  { id: "default", name: "v2", description: "Default: slim neutral ticks, a focused wave, section-length tracking, and full labels with bookmarks.", values: DEFAULTS },
  { id: "builtin-absolutely", name: "Absolutely", description: "Inspired by Claude’s restrained styling: fine, widely spaced marks on the left, with simple heading labels.", values: {
    ...DEFAULTS, side: "left", edgeOffset: 0, tickWidth: 18, tickHeight: 1,
    tickGap: 20, hoverStyle: "none", activeBoost: 8, hoverOpacity: 0.25, animDuration: 400,
    labelMotion: "slide", labelMoveMotion: "slide",
    showPercent: false, showPreview: false,
  } },
  { id: "builtin-quiet", name: "Quiet", description: "A minimal rail that follows the note, with a gentle hover and title-only labels.", values: {
    ...DEFAULTS, hoverStyle: "none", activeBoost: 0, tickGap: 6,
    trackingMode: "position", idleOpacity: 0.18, passedOpacity: 0.25,
    showPercent: false, showPreview: false, showBookmarkButton: false,
  } },
  { id: "builtin-outline", name: "Outline", description: "Show every heading with depth indentation and H-level pills on hover.", values: {
    ...DEFAULTS, hierarchyMode: "all", levelIndent: 3, tickWidth: 24,
    hoverStyle: "pill", trackingMode: "position", colorMode: "accent",
    showPreview: false,
  } },
  { id: "builtin-progress", name: "Progress", description: "Equal scroll shares, square marks with a hover swell, and section progress filling from right to left.", values: {
    ...DEFAULTS, trackingMode: "equal", showSectionProgress: true,
    colorMode: "accent", tickWidth: 24, tickHeight: 3, tickRadius: 0,
    progressDirection: "right", showPreview: false, labelMotion: "none", labelMoveMotion: "none",
  } },
];

function railVisibilityReason(settings, { phone, landscape, width, headings }) {
  if (phone) {
    const policy = settings.phoneVisibility || "hidden";
    if (policy === "hidden") return "Hidden on phones by your visibility setting.";
    if (policy === "landscape" && !landscape) return "Hidden in portrait; rotate the phone to landscape.";
  } else if (width < settings.hideBelowWidth) {
    return "Hidden: pane narrower than the minimum width.";
  }
  if (headings < settings.minHeadings) return "Hidden: fewer headings than the minimum.";
  return "";
}

const COLOR_SOURCES = {
  neutral: "var(--text-normal)",
  accent: "var(--text-accent)",
};

// Each allocation covers a positive share of the scroll range. Source lines
// provide stable weights without depending on virtualised DOM measurements.
function headingAllocations(lines, totalLines, mode) {
  const weights = lines.map((line, i) => mode === "equal" ? 1 :
    Math.max(1, (lines[i + 1] ?? totalLines) - (i === 0 ? 0 : line)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let used = 0;
  return weights.map((weight) => {
    const start = used / total;
    used += weight;
    return { start, end: used / total };
  });
}

// Short and trailing sections need a useful scroll interval, not a one-pixel
// turn. Borrow space from the preceding section, bounded by heading visibility.
function headingLandingStarts(tops, scrollRange, viewportHeight = 200, bottoms = tops.map(top => top + 24)) {
  if (scrollRange <= 0) return tops.map(() => 0);
  const starts = tops.map(top => Math.max(0, Math.ceil(top - 24)));
  let step = Math.min(64, viewportHeight / 4, scrollRange / Math.max(1, tops.length - 1));
  for (let i = 0; i < tops.length; i++) {
    // Never move a landing past its heading, or so far back it leaves the screen.
    // Near the start, reduce the preferred 24px inset before sacrificing a
    // heading's entire range (e.g. consecutive H1/H2 lines in the editor).
    if (i) step = Math.min(step, Math.max(0, tops[i]) / i);
    const remaining = tops.length - 1 - i;
    if (remaining) step = Math.min(step, Math.max(0, scrollRange - Math.max(0, bottoms[i] - viewportHeight)) / remaining);
  }
  step = Math.max(0, Math.floor(step));
  for (let i = starts.length - 1; i >= 0; i--) {
    starts[i] = Math.min(starts[i], i === starts.length - 1 ? scrollRange : starts[i + 1] - step);
  }
  for (let i = 0; i < starts.length; i++) starts[i] = Math.max(i * step, starts[i]);
  return starts.map(top => top / scrollRange);
}

function physicalHeadingRanges(starts) {
  return starts.map((start, i) => ({ start: i === 0 ? 0 : start, end: starts[i + 1] ?? 1 }));
}

// Prefer the actual heading, near the top with a little breathing room, while
// staying inside the scroll share that activates its mark. Use integer-safe
// boundaries because browsers round scrollTop to physical CSS pixels.
function headingNavigationProgress(lines, totalLines, mode, index, landing) {
  if ((mode !== "length" && mode !== "equal") || index < 0 || index >= lines.length) return null;
  const range = headingAllocations(lines, totalLines, mode)[index];
  if (!landing) return range.start; // Settings sample: start of the section.
  const { scrollRange, viewportHeight, headingTop, headingBottom, preferredTop, lastAtBottom } = landing;
  if (scrollRange <= 0) return null;
  let min = Math.ceil(range.start * scrollRange);
  if (min / scrollRange < range.start) min++;
  let max = index === lines.length - 1 ? Math.floor(scrollRange)
    : Math.ceil(range.end * scrollRange) - 1;
  if (index < lines.length - 1 && max / scrollRange >= range.end) max--;
  if (lastAtBottom && index < lines.length - 1) max = Math.min(max, Math.ceil(scrollRange - 2) - 1);
  const preferred = Number.isFinite(headingTop) ? headingTop - 24 : preferredTop;
  let low = min, high = max;
  if (Number.isFinite(headingTop) && Number.isFinite(headingBottom)) {
    const visibleMin = Math.max(min, Math.ceil(headingBottom - viewportHeight));
    const visibleMax = Math.min(max, Math.floor(headingTop));
    if (visibleMin <= visibleMax) { low = visibleMin; high = visibleMax; }
  }
  // If there is no heading-visible overlap, choose the closest point in the
  // mark's range rather than skipping to the middle of its section.
  if (max < min) return range.start; // A tiny scroll range may have no distinct pixel for this mark.
  return Math.max(low, Math.min(high, Math.round(preferred))) / scrollRange;
}

function resolveCurrent(lines, totalLines, settings, viewport) {
  if (!lines.length) return -1;
  // No scroll range means there is no meaningful bottom override.
  if (settings.lastAtBottom && viewport.scrollable && viewport.atBottom) return lines.length - 1;
  if (settings.trackingMode === "off") return -1;
  if (settings.trackingMode === "length" || settings.trackingMode === "equal") {
    const ranges = settings.trackingMode === "length" && viewport.headingStarts
      ? physicalHeadingRanges(viewport.headingStarts)
      : headingAllocations(lines, totalLines, settings.trackingMode);
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
      if (line >= viewport.first && line <= viewport.last) active.add(index);
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
    const range = (settings.trackingMode === "length" && viewport.headingStarts
      ? physicalHeadingRanges(viewport.headingStarts)
      : headingAllocations(lines, totalLines, settings.trackingMode))[current];
    return clampProgress((viewport.progress - range.start) / (range.end - range.start));
  }
  const start = lines[current];
  const end = lines[current + 1] ?? totalLines;
  return clampProgress(((viewport.topLine ?? viewport.first) - start) / Math.max(1, end - start));
}

// A branch belongs to the nearest preceding heading shown at rest. Heading
// levels are relative to the shallowest level present, including H2-only notes.
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
  // Retain the current heading even while its branch is folded.
  return branches.map((root, index) => root === index || root === expanded || index === current);
}

function scrubProgress(clientY, start, end) {
  return clampProgress((clientY - start) / Math.max(1, end - start));
}

// Each visible mark owns the pointer band halfway to its neighbours. Map that
// band to the same scroll interval that makes this heading current.
function sectionDragProgress(clientY, centers, ranges, start, end, strength = 1) {
  if (!ranges || centers.some(center => center == null) || centers.length !== ranges.length) {
    return scrubProgress(clientY, start, end);
  }
  let index = centers.findIndex((center, i) => clientY < (center + (centers[i + 1] ?? Infinity)) / 2);
  if (index < 0) index = centers.length - 1;
  const low = index ? (centers[index - 1] + centers[index]) / 2 : start;
  const high = index + 1 < centers.length ? (centers[index] + centers[index + 1]) / 2 : end;
  const fraction = scrubProgress(clientY, low, high);
  // Briefly hold the heading's landing at the entrance to its band. This gives
  // each crossing a small detent without delaying or animating the scroll.
  const hold = 0.15 * strength;
  const within = fraction < hold ? 0 : (fraction - hold) / (1 - hold);
  return ranges[index].start + (ranges[index].end - ranges[index].start) * within;
}

// Speeds are measured in marks per second, independent of rail spacing.
function dragSnapStrength(speed) {
  const blend = clampProgress((speed - 2) / 6);
  return 1 - blend * blend * (3 - 2 * blend);
}

function sampleDragSpeed(motion, position, time) {
  const elapsed = Math.max(1, time - motion.time);
  const speed = Math.abs(position - motion.position) * 1000 / elapsed;
  // Respond promptly to acceleration; restore detents more gently on slowing.
  const blend = 1 - Math.exp(-elapsed / (speed > motion.speed ? 60 : 180));
  motion.speed += (speed - motion.speed) * blend;
  motion.position = position;
  motion.time = time;
  return dragSnapStrength(motion.speed);
}

// Match the heading subpath used by Obsidian's own heading bookmarks.
function headingSubpath(title) {
  return "#" + title.replace(/([:#|^\\\r\n]|%%|\[\[|]])/g, " ").replace(/\s+/g, " ").trim();
}

function findHeadingBookmark(items, path, subpath) {
  for (const item of items || []) {
    if (item.type === "file" && item.path === path && item.subpath === subpath) return item;
    if (item.type === "group" && Array.isArray(item.items)) {
      const found = findHeadingBookmark(item.items, path, subpath);
      if (found) return found;
    }
  }
  return null;
}

function bookmarksCore(app) {
  // Bookmarks has no public API. Guard the enabled core plugin and its current
  // addItem/items shape; never write bookmarks.json directly.
  const core = app.internalPlugins?.getEnabledPluginById?.("bookmarks");
  return core && typeof core.addItem === "function" && typeof core.removeItem === "function" && Array.isArray(core.items) ? core : null;
}

/* ========================================================== shared rail === */

let nextRailId = 0;

// A small, fixed JXA program accesses AppKit through macOS's own runtime.
// It receives only tick bytes, never note text, paths, or executable commands.
const MAC_HAPTIC_SCRIPT = String.raw`
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

class MacDragHaptics {
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
      const child = this.child = this.spawn("/usr/bin/osascript", ["-l", "JavaScript", "-e", MAC_HAPTIC_SCRIPT],
        { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
      let output = "";
      child.stdout.on("data", data => {
        if (this.child !== child) return;
        output += data.toString();
        if (output.includes("ready\n")) {
          this.ready = true;
          clearTimeout(this.startupTimer);
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
      this.startupTimer = setTimeout(fail, 2000);
    } catch (_) {
      this.failed = true;
      this.end();
    }
  }

  tick(owner) {
    if (owner !== this.owner || !this.ready || !this.child?.stdin.writable) return;
    const now = this.now();
    if (now - this.lastTick < 80 || this.child.stdin.writableLength) return;
    this.lastTick = now;
    try { this.child.stdin.write("t"); }
    catch (_) { this.failed = true; this.end(); }
  }

  end(owner) {
    if (owner && owner !== this.owner) return;
    clearTimeout(this.startupTimer);
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
}

class RailView {
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
    // Obsidian's mobile gesture recognizer honours this on ancestors.
    this.el.dataset.ignoreSwipe = "true";
    this.el.tabIndex = 0;
    this.el.setAttribute("role", "listbox");
    // Obsidian turns aria-label into a pointer tooltip. A referenced name keeps
    // the listbox accessible without competing with our heading flyout.
    this.accessibleLabel = hostEl.createSpan({ text: "Note headings" });
    this.accessibleLabel.id = `${this.railId}-label`;
    this.accessibleLabel.hidden = true;
    this.el.setAttribute("aria-labelledby", this.accessibleLabel.id);
    this.el.setAttribute("aria-orientation", "vertical");
    this.el.setAttribute("aria-description", "Arrow keys select a heading, Home and End select the first and last. Enter jumps. Escape dismisses. Scroll to browse long outlines.");
    // Focus can arrive after touch release on WebKit. Only a real keyboard
    // Tab should turn a touch-focused list into an expanded keyboard outline.
    this.onKeyboardIntent = event => {
      if (event.key === "Tab") this.setInputMode("keyboard");
    };
    hostEl.ownerDocument.addEventListener("keydown", this.onKeyboardIntent, true);
    this.el.addEventListener("focus", () => {
      if (this.touch || this.drag?.pointerType === "touch" || this.inputMode === "touch") return;
      this.setInputMode("keyboard");
      this.cancelLeave();
      this.flyoutPointerFocus = false;
      this.keyboardFocused = true;
      this.selectKeyboard(Math.max(0, this.activeIndex));
    });
    this.el.addEventListener("blur", (event) => {
      if (!this.flyout.contains(event.relatedTarget)) this.dismissKeyboard();
    });
    this.el.addEventListener("keydown", event => this.onKeyDown(event));
    this.el.addEventListener("wheel", event => {
      if (this.dense) event.stopPropagation();
      if (this.drag) event.preventDefault();
    }, { passive: false });
    this.el.addEventListener("scroll", () => {
      this.centers = [];
      if (this.touch) this.touch.moved = true;
      if (this.drag?.moved) { this.updateDragFeedback(this.dragSectionIndex()); return; }
      if (this.keyboardFocused && this.keyboardIndex >= 0) this.showFlyout(this.keyboardIndex);
      else { this.setHovered(-1); this.hideFlyout(); }
    });

    // The label lives outside the rail so the rail never needs a background of
    // its own -- the hover chrome belongs to the label, not to the bars.
    this.flyout = hostEl.createDiv({ cls: "scrollspy-flyout" });
    this.flyout.dataset.ignoreSwipe = "true";
    this.flyoutHead = this.flyout.createDiv({ cls: "scrollspy-flyout-head" });
    this.flyoutTitle = this.flyoutHead.createSpan({ cls: "scrollspy-flyout-title" });
    this.flyoutPercent = this.flyoutHead.createSpan({
      cls: "scrollspy-flyout-percent",
    });
    this.flyoutBookmark = this.flyoutHead.createEl("button", {
      cls: "scrollspy-bookmark-button clickable-icon", type: "button",
    });
    this.flyoutBookmark.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      if (this.bookmarkBusy || this.flyoutIndex < 0) return;
      const index = this.flyoutIndex;
      this.bookmarkBusy = true;
      // Native disabled blurs a focused button synchronously. That dismisses
      // the flyout and clears its heading before the bookmark can be written.
      this.updateBookmarkButton();
      try { await this.bookmarkHeading(index); }
      catch (error) { new Notice("Could not bookmark this heading. Try again from Obsidian’s Bookmarks."); }
      finally { this.bookmarkBusy = false; this.paintBookmarks(); this.updateBookmarkButton(); }
    });
    this.flyout.addEventListener("pointerdown", evt => {
      this.flyoutPointerFocus = true;
      // WebKit can blur the rail to the page instead of focusing a clicked
      // button. Keep focus in place so blur cannot dismiss it before click.
      if (evt.target.closest?.(".scrollspy-bookmark-button")) evt.preventDefault();
    });
    this.flyout.addEventListener("pointerenter", () => { this.overFlyout = true; this.cancelHoverFrame(); this.cancelLeave(); });
    this.flyout.addEventListener("pointerleave", () => { this.overFlyout = false; this.scheduleLeave(); });
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
    this.flyoutPreview = this.flyout.createDiv({ cls: "scrollspy-flyout-preview" });

    // Every pointer interaction is resolved against the whole rail rather than
    // against individual bars. A 5px bar is a bad target; the band around it is
    // a good one, and nearest-centre makes the gaps between bars live too.
    this.el.addEventListener("click", (evt) => {
      // Touch activation belongs exclusively to pointerup. Compatibility clicks
      // can arrive after another tap, when a one-click suppression flag is reset.
      if (this.inputMode === "touch" || evt.pointerType === "touch" || evt.sourceCapabilities?.firesTouchEvents) return;
      if (this.suppressClick) { this.suppressClick = false; return; }
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
    this.el.addEventListener("pointermove", (evt) => this.onPointerMove(evt));
    this.el.addEventListener("pointerleave", (evt) => { if (evt.pointerType !== "touch" && !this.drag) this.scheduleLeave(); });
    this.el.addEventListener("pointerdown", (evt) => this.startDrag(evt));
    this.el.addEventListener("pointerup", (evt) => this.endDrag(evt));
    this.el.addEventListener("pointercancel", (evt) => this.endDrag(evt, true));
    this.el.addEventListener("lostpointercapture", (evt) => {
      if (this.drag || this.touch) this.endDrag(evt, true);
    });
    this.plugin.applyStyles(this);
  }

  destroy() {
    this.host.ownerDocument.removeEventListener("keydown", this.onKeyboardIntent, true);
    this.plugin.endDragHaptics?.(this);
    this.dragSnapAnimation?.cancel();
    this.cancelLabelMotion();
    if (this.ownsHostClass) this.host.classList.remove("margin-rail-host");
    this.cancelLeave();
    if (this.waveFrame) cancelAnimationFrame(this.waveFrame);
    if (this.drag && this.el.hasPointerCapture(this.drag.id)) this.el.releasePointerCapture(this.drag.id);
    this.el.remove();
    this.accessibleLabel.remove();
    this.flyout.remove();
  }

  get settings() {
    return this.plugin.settings;
  }

  // Subclasses say what a click does and what the label says.
  activate() {}
  scrubTo() {}
  labelFor() {
    return null;
  }

  bookmarkState() { return { available: false, saved: false }; }
  async bookmarkHeading() {}

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
    if (this.overFlyout || (!this.flyoutPointerFocus &&
      (this.keyboardFocused || this.flyout.contains(this.host.ownerDocument?.activeElement)))) return;
    const leave = () => this.flyoutPointerFocus ? this.dismissKeyboard() : this.onLeave();
    if (this.settings.showBookmarkButton && this.settings.showLabels) {
      // Leave time to cross the gap between a tick and its actionable label.
      this.leaveTimer = setTimeout(() => { this.leaveTimer = 0; leave(); }, 250);
    } else leave();
  }

  setInputMode(mode) {
    if (this.inputMode === mode) return;
    this.inputMode = mode;
    if (this.flyoutBookmark) this.updateBookmarkButton();
  }

  updateBookmarkButton() {
    // Touch labels describe the drag target and close on release. Pointer and
    // keyboard labels stay actionable, including on hybrid tablets.
    const visible = this.settings.showBookmarkButton && this.inputMode !== "touch";
    this.flyoutBookmark.toggleClass("is-hidden", !visible);
    this.flyout.toggleClass("has-bookmark-button", visible);
    if (!visible) return;
    const state = this.bookmarkState(this.flyoutIndex);
    const title = state.saved ? "Remove heading bookmark" : state.available
      ? "Bookmark this heading" : "Enable Obsidian’s Bookmarks core plugin to bookmark headings";
    // Mobile and desktop Obsidian can ship different Lucide icon versions.
    const candidates = state.saved ? ["bookmark-check", "bookmark-minus", "bookmark"] : ["bookmark-plus", "bookmark"];
    const icon = typeof getIcon === "function" ? candidates.find(name => getIcon(name)) : candidates[0];
    this.flyoutBookmark.replaceChildren?.();
    setIcon(this.flyoutBookmark, icon || "bookmark");
    // Keep the action visible even when the installed icon registry lacks all
    // variants. This fixed outline uses the same stroke and size as Lucide.
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
      const outline = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      outline.setAttribute("d", "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z");
      svg.append(outline);
      const symbol = doc.createElementNS("http://www.w3.org/2000/svg", "path");
      symbol.setAttribute("d", state.saved ? "m9 10 2 2 4-4" : "M12 7v6m-3-3h6");
      svg.append(symbol);
      this.flyoutBookmark.replaceChildren(svg);
    }
    // aria-label supplies Obsidian’s tooltip; title would add a second native one.
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
    const offset = s.anchor === "top" ? Math.max(0, Math.min(s.axisOffset, travel))
      : s.anchor === "bottom" ? Math.max(-travel, Math.min(s.axisOffset, 0))
      : Math.max(-travel / 2, Math.min(s.axisOffset, travel / 2));
    const used = s.anchor === "middle" ? 2 * Math.abs(offset) : Math.abs(offset);
    const available = Math.max(0, height - 32 - used);
    const count = Array.from(this.el.children).filter(tick => !tick.hidden).length;
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
    this.updateHierarchy(); // All nested headings are available while focused.
    const tick = this.el.children[this.keyboardIndex];
    this.el.setAttribute("aria-activedescendant", tick.id);
    Array.from(this.el.children).forEach((item, i) => item.setAttribute("aria-selected", String(i === this.keyboardIndex)));
    // Scroll only the outline, never its note or workspace ancestors.
    const box = tick.getBoundingClientRect(), rail = this.el.getBoundingClientRect();
    if (box.top < rail.top + 10) this.el.scrollTop -= rail.top + 10 - box.top;
    else if (box.bottom > rail.bottom - 10) this.el.scrollTop += box.bottom - rail.bottom + 10;
    this.centers = [];
    this.setHovered(this.keyboardIndex);
    this.showFlyout(this.keyboardIndex);
  }

  dismissKeyboard() {
    this.keyboardFocused = false;
    this.keyboardIndex = -1;
    this.el.removeAttribute("aria-activedescendant");
    Array.from(this.el.children).forEach(tick => tick.setAttribute("aria-selected", "false"));
    this.onLeave();
  }

  onKeyDown(event) {
    this.setInputMode("keyboard");
    const key = event.key;
    if (!["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (key === "Escape") { this.dismissKeyboard(); return; }
    if (key === "Enter") {
      if (this.keyboardIndex >= 0) this.activate(this.keyboardIndex);
      return;
    }
    this.keyboardFocused = true;
    const start = this.keyboardIndex >= 0 ? this.keyboardIndex : Math.max(0, this.activeIndex);
    this.selectKeyboard(key === "Home" ? 0 : key === "End" ? this.levels.length - 1 : start + (key === "ArrowDown" ? 1 : -1));
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
      this.centers.push(box.height && (!rail || (box.top + box.height / 2 >= rail.top && box.top + box.height / 2 <= rail.bottom))
        ? box.top + box.height / 2 : null);
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
      if (this.touch?.id === evt.pointerId &&
          Math.hypot(evt.clientX - this.touch.x, evt.clientY - this.touch.y) > 8) this.touch.moved = true;
      return;
    }
    if (this.drag && evt.pointerId !== this.drag.id) return;
    const dx = evt.clientX - this.lastPointerX;
    const dy = evt.clientY - this.lastPointerY;
    this.lastPointerX = evt.clientX;
    this.lastPointerY = evt.clientY;
    // Keep the heading stable while crossing sideways to its bookmark button.
    const towardLabel = this.settings.side === "left" ? dx > 0 : dx < 0;
    if (!this.drag && this.settings.showBookmarkButton && this.flyoutIndex >= 0 &&
        towardLabel && Math.abs(dx) > Math.abs(dy)) {
      this.cancelHoverFrame();
      return;
    }
    this.pointerY = evt.clientY;
    if (this.waveFrame) return;
    this.waveFrame = requestAnimationFrame(() => {
      this.waveFrame = 0;
      if (this.drag) {
        if (Math.abs(this.pointerY - this.drag.y) > (this.drag.slop ?? 3)) this.drag.moved = true;
        if (this.drag.moved) this.scrubDragTo(this.dragProgressAt(this.pointerY));
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
      // Cancel synthetic mouse/focus events, without cancelling native touch
      // scrolling (which is governed by touch-action and touchmove).
      evt.preventDefault();
      this.cancelLeave();
      this.cancelHoverFrame();
      this.measure();
      this.touch = { id: evt.pointerId, x: evt.clientX, y: evt.clientY,
        index: this.nearestIndex(evt.clientY), moved: false };
    }
    // Let a finger browse a dense outline using native scrolling; mouse and
    // pen drags still scrub the entire note across the bounded track.
    if (!this.settings.dragToScrub || evt.button !== 0 || this.drag ||
        (this.dense && evt.pointerType === "touch")) return;
    this.suppressClick = false;
    if (evt.pointerType !== "touch") this.revealAt(evt.clientY);
    this.measure();
    const centers = this.centers.filter(value => value != null);
    if (!centers.length) return;
    const box = this.el.getBoundingClientRect();
    this.drag = { id: evt.pointerId, pointerType: evt.pointerType, slop: evt.pointerType === "touch" ? 8 : 3,
      y: evt.clientY, moved: false, index: this.touch?.index ?? this.nearestIndex(evt.clientY),
      startedAt: this.dragNow(), strength: 1,
      start: !this.dense && centers.length > 1 ? centers[0] : box.top,
      end: !this.dense && centers.length > 1 ? centers.at(-1) : box.bottom };
    this.touch = null;
    this.drag.hapticIndex = this.dragSectionIndex();
    this.plugin.beginDragHaptics?.(this);
    this.el.setPointerCapture(evt.pointerId);
    this.el.addClass("is-dragging");
    evt.preventDefault();
  }

  dragNow() { return this.host?.ownerDocument.defaultView.performance?.now?.() ?? Date.now(); }

  dragRanges() { return null; }

  prepareDragTrack() {
    if (!this.drag || this.drag.prepared) return;
    this.drag.prepared = true;
    this.cancelLabelMotion();
    this.flyout?.addClass("is-scrubbing");
    const selected = this.el.children[this.drag.index];
    const before = selected?.getBoundingClientRect();
    // Folded headings must have a mark while they can become a drag target.
    Array.from(this.el.children).forEach(tick => tick.hidden = false);
    this.fitPane();
    if (before && selected) {
      const after = selected.getBoundingClientRect();
      if (this.dense) this.el.scrollTop += after.top - before.top;
      else {
        const existing = Number(this.el.style.getPropertyValue("--ss-reveal-shift")) || 0;
        let shift = existing + before.top - after.top;
        if (this.host) {
          const host = this.host.getBoundingClientRect(), box = this.el.getBoundingClientRect();
          shift = Math.max(existing + host.top + 16 - box.top, Math.min(shift, existing + host.bottom - 16 - box.bottom));
        }
        this.el.style.setProperty("--ss-reveal-shift", String(shift));
        this.el.style.translate = `0 ${shift}px`;
      }
    }
    this.measure();
    const centers = this.centers.filter(center => center != null), box = this.el.getBoundingClientRect();
    this.drag.start = !this.dense && centers.length > 1 ? centers[0] : box.top;
    this.drag.end = !this.dense && centers.length > 1 ? centers.at(-1) : box.bottom;
    this.drag.centers = [...this.centers];
    this.drag.motion = { position: scrubProgress(this.drag.y, this.drag.start, this.drag.end) * Math.max(1, this.levels.length - 1),
      time: this.drag.startedAt, speed: 0 };
  }

  dragProgressAt(clientY) {
    this.pointerY = clientY;
    this.prepareDragTrack();
    const position = scrubProgress(clientY, this.drag.start, this.drag.end) * Math.max(1, this.levels.length - 1);
    const direction = Math.sign(position - this.drag.motion.position);
    this.drag.strength = sampleDragSpeed(this.drag.motion, position, this.dragNow());
    let progress = this.dense ? scrubProgress(clientY, this.drag.start, this.drag.end)
      : sectionDragProgress(clientY, this.drag.centers, this.dragRanges(), this.drag.start, this.drag.end, this.drag.strength);
    // Changing the hold strength must never pull the note against the pointer
    // direction, or move it when the user pauses/releases the drag.
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
      const target = Math.max(box.top + 12, Math.min(box.bottom - 12, this.pointerY));
      this.el.scrollTop += mark.top + mark.height / 2 - target;
      this.centers = [];
    }
    if (this.hoveredIndex === index) this.showFlyout(index);
    else this.setHovered(index);
    if (crossed) {
      this.dragSnapAnimation?.cancel();
      this.dragSnapAnimation = null;
      const mark = tick.firstElementChild;
      const reduced = this.host?.ownerDocument.defaultView.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const strength = this.drag?.strength ?? 1;
      if (!reduced && strength > 0.2 && mark?.animate) {
        this.dragSnapAnimation = mark.animate([
          { transform: `scale(${1 + 0.16 * strength}, ${1 + 0.3 * strength})` }, { transform: "scale(1)" },
        ], { duration: 140, easing: "ease-out" });
      }
    }
  }

  dragSectionIndex() { return this.activeIndex; }

  scrubDragTo(progress) {
    this.scrubTo(progress);
    const index = this.dragSectionIndex();
    const crossed = this.drag && index >= 0 && this.drag.hapticIndex >= 0 && index !== this.drag.hapticIndex;
    if (crossed && (this.drag.strength ?? 1) > 0.25) this.plugin.tickDragHaptics?.(this);
    if (this.drag) {
      this.drag.hapticIndex = index;
      this.updateDragFeedback(index, crossed);
    }
  }

  endDrag(evt, cancelled = false) {
    if (this.touch?.id === evt.pointerId) {
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
    if (this.waveFrame) { cancelAnimationFrame(this.waveFrame); this.waveFrame = 0; }
    if (Math.abs(evt.clientY - drag.y) > (drag.slop ?? 3)) drag.moved = true;
    if (!cancelled && drag.moved) this.scrubDragTo(this.dragProgressAt(evt.clientY));
    this.plugin.endDragHaptics?.(this);
    this.suppressClick = true; // Handle a short press here before folding changes hit targets.
    this.drag = null;
    this.el.removeClass("is-dragging");
    this.flyout?.removeClass("is-scrubbing");
    this.dragSnapAnimation?.cancel();
    this.dragSnapAnimation = null;
    if (this.el.hasPointerCapture(evt.pointerId)) this.el.releasePointerCapture(evt.pointerId);
    this.onLeave();
    if (!cancelled && !drag.moved) this.activate(drag.index);
  }

  updateHierarchy() {
    if (this.drag || this.touch) return; // Keep pressed targets stable as the current heading changes.
    const visible = !this.keyboardFocused && this.settings.hierarchyMode === "nearby"
      ? hierarchyVisible(this.levels, this.settings.idleLevels, this.activeIndex, this.expandedBranch)
      : this.levels.map(() => true);
    Array.from(this.el.children).forEach((tick, index) => tick.hidden = !visible[index]);
    this.fitPane();
    this.centers = [];
  }

  revealAt(clientY) {
    if (this.drag || this.touch || this.keyboardFocused || this.settings.hierarchyMode !== "nearby") return;
    const index = this.nearestIndex(clientY);
    if (index < 0) return;
    const root = headingBranches(this.levels, this.settings.idleLevels)[index];
    if (root === this.expandedBranch) return;
    const tick = this.el.children[index];
    if (this.dense) {
      const before = tick.getBoundingClientRect().top;
      this.expandedBranch = root;
      this.updateHierarchy();
      this.el.scrollTop += tick.getBoundingClientRect().top - before;
      this.measure();
      return;
    }
    // Measure against the resting branch root, never the previous hover shift.
    // Otherwise traversing branches repeatedly can walk the rail down the pane.
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
        shift = Math.max(host.top + 16 - rail.top, Math.min(shift, host.bottom - 16 - rail.bottom));
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
      tick.style.setProperty("--ss-section-progress", `${(fraction * 100).toFixed(2)}%`);
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
      const waveY = this.drag?.moved ? (this.centers[this.dragSectionIndex()] ?? this.pointerY) : this.pointerY;
      const distance = Math.abs(this.centers[i] - waveY) / reach;

      // Raised cosine, then sharpened by the focus exponent. Focus 1 is a broad
      // swell across neighbours; higher values pull the growth onto the bar
      // under the cursor and leave the rest nearly flat. Either way it reaches
      // exactly zero at the configured distance, so nothing snaps.
      const falloff =
        distance >= 1 ? 0 : Math.cos((distance * Math.PI) / 2) ** (2 * waveFocus);

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

    const switching = !this.drag?.moved && settings.labelMoveMotion === "slide" && this.flyoutIndex >= 0 &&
      this.flyoutIndex !== index && this.flyout.classList.contains("is-visible");
    // Retarget from the on-screen position when moving quickly between marks.
    const fromTop = switching ? this.flyout.ownerDocument.defaultView.getComputedStyle(this.flyout).top : null;
    if (switching) this.cancelLabelMotion();
    this.flyoutIndex = index;
    this.updateBookmarkButton();
    this.flyoutTitle.setText(label.title);

    this.flyoutPercent.setText(settings.showPercent && label.percent != null ? `${label.percent}%` : "");
    this.flyoutPercent.toggleClass("is-hidden", !settings.showPercent);

    const preview = settings.showPreview ? label.preview : "";
    this.flyoutPreview.setText(preview);
    this.flyoutPreview.toggleClass("is-hidden", !preview);

    // Vertically centred on the hovered bar, horizontally on the rail's inner
    // side so it opens over the content rather than off the edge.
    const host = this.host.getBoundingClientRect();
    const box = tick.getBoundingClientRect();
    const center = box.top - host.top + box.height / 2;
    this.flyout.toggleClass("is-visible", true);
    const half = this.flyout.getBoundingClientRect().height / 2;
    const top = `${Math.max(half, Math.min(host.height - half, center))}px`;
    this.flyout.style.top = top;
    const reduced = this.flyout.ownerDocument.defaultView.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (switching && !reduced && settings.labelMoveDuration > 0 && this.flyout.animate) {
      const timing = { duration: settings.labelMoveDuration, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };
      this.labelAnimations = [this.flyout.animate([{ top: fromTop }, { top }], timing)];
    }
  }

  cancelLabelMotion() {
    for (const animation of this.labelAnimations || []) animation.cancel();
    this.labelAnimations = [];
  }

  hideFlyout() {
    // Start hiding where the moving label currently is, without snapping to
    // its previous destination when a glide is interrupted.
    const top = this.labelAnimations?.length
      ? this.flyout.ownerDocument.defaultView.getComputedStyle(this.flyout).top : null;
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
    // Only pill markup changes require replacing ticks; sliders reuse them.
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

    // Indent relative to the shallowest heading present, so a note whose top
    // level is H2 still starts flush rather than pre-indented.
    const topLevel = Math.min(6, ...levels);

    levels.forEach((level, index) => {
      const tick = this.el.createDiv({ cls: "scrollspy-tick" });
      tick.id = `${this.railId}-heading-${index}`;
      tick.setAttribute("role", "option");
      tick.setAttribute("aria-label", `Heading level ${level}: ${this.labelFor(index)?.title || `Heading ${index + 1}`}`);
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
    if (this.keyboardFocused) this.selectKeyboard(Math.max(0, this.keyboardIndex));
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
    if (this.drag?.moved && current >= 0 && current !== this.hoveredIndex) this.updateDragFeedback(current);
  }
}

/* ======================================================== document rail === */

class DocumentRail extends RailView {
  constructor(plugin, view) {
    super(plugin, view.containerEl);
    this.view = view;
    this.headings = [];
    this.lines = [];
    this.scroller = null;
    this.bookmarksPlugin = null;
    this.onBookmarksChanged = () => { this.paintBookmarks(); this.updateBookmarkButton(); };

    this.scrollFrame = 0;
    this.onScroll = () => {
      if (this.navigationHighlight && Math.abs(this.scroller.scrollTop - this.navigationHighlightScrollTop) > 1) this.clearNavigationHighlight();
      this.scheduleActive();
    };
    this.onNavigationInput = () => this.cancelHeadingNavigation();

    // Reevaluate both pane width and phone orientation when the pane resizes.
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
    // Already measured headings can go straight to their final destination.
    // A native reveal followed by our correction causes a visible double jump.
    const bounds = allocated && this.headingBounds(index);
    if (bounds && bounds.measured !== false &&
        (this.settings.trackingMode !== "length" || this.headingLandingStarts())) {
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
        const position = cm.state.doc.line(Math.min(cm.state.doc.lines, line + 1)).from;
        // Selection without scrollIntoView preserves the section landing rule.
        cm.dispatch({ selection: { anchor: position } });
        cm.contentDOM?.focus?.({ preventScroll: true });
      } else if (this.view.editor?.setCursor) {
        this.view.editor.setCursor({ line, ch: 0 });
      }
    }
    if (["length", "equal"].includes(this.settings.trackingMode)) this.landAtHeading(index);
    else this.syncActive();
    if (feedback && this.settings.highlightOnNavigate) this.showNavigationHighlight(index);
  }

  clearNavigationHighlight() {
    if (this.navigationHighlightTimer) clearTimeout(this.navigationHighlightTimer);
    this.navigationHighlightTimer = null;
    this.navigationHighlight?.remove();
    this.navigationHighlight = null;
  }

  showNavigationHighlight(index) {
    this.clearNavigationHighlight();
    const bounds = this.headingBounds(index), el = this.scroller;
    if (!bounds || !el) return;
    const frame = el.getBoundingClientRect();
    const top = Math.max(frame.top, frame.top + el.clientTop + bounds.top - el.scrollTop);
    const bottom = Math.min(frame.bottom, frame.top + el.clientTop + bounds.bottom - el.scrollTop);
    if (bottom <= top) return;
    const highlight = this.navigationHighlight = el.ownerDocument.createElement("div");
    highlight.className = "scrollspy-heading-flash";
    highlight.setAttribute("aria-hidden", "true");
    Object.assign(highlight.style, { top: `${top}px`, left: `${frame.left + el.clientLeft}px`,
      width: `${el.clientWidth}px`, height: `${bottom - top}px` });
    el.ownerDocument.body.appendChild(highlight);
    this.navigationHighlightScrollTop = el.scrollTop;
    this.navigationHighlightTimer = setTimeout(() => this.clearNavigationHighlight(), 1400);
  }

  cancelHeadingNavigation() {
    this.pendingNavigation = null;
    if (this.navigationFrame) this.navigationWindow.cancelAnimationFrame(this.navigationFrame);
    this.navigationFrame = 0;
  }

  queueHeadingNavigation(line, feedback = false) {
    this.cancelHeadingNavigation();
    const request = this.pendingNavigation = { line, file: this.view.file, mode: this.view.currentMode, ready: false, feedback };
    const win = this.navigationWindow = this.host.ownerDocument.defaultView;
    const schedule = () => {
      if (this.pendingNavigation !== request) return;
      if (this.navigationFrame) win.cancelAnimationFrame(this.navigationFrame);
      // Let Obsidian finish its own line jump and CodeMirror/rendered layout.
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
    if (typeof renderer?.onRendered === "function") renderer.onRendered(schedule);
    else schedule();
  }

  applyPendingNavigation() {
    const request = this.pendingNavigation;
    if (!request?.ready) return false;
    if (request.file !== this.view.file || request.mode !== this.view.currentMode) {
      this.pendingNavigation = null; return false;
    }
    if (!this.sourceReady) return false; // refreshSource will retry after cachedRead.
    this.pendingNavigation = null;
    this.attachScroller();
    const index = this.headings.findIndex(heading => heading.position.start.line === request.line);
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
      const position = cm.state.doc.line(Math.min(cm.state.doc.lines, line + 1)).from;
      const block = cm.lineBlockAt(position);
      const top = block.top + (cm.contentDOM?.offsetTop || 0);
      return { top, bottom: top + block.height, measured: true };
    }
    for (const section of mode?.renderer?.sections || []) {
      if (section.lineStart > line || section.lineEnd < line) continue;
      const nodes = Array.from(section.el?.querySelectorAll?.("h1,h2,h3,h4,h5,h6") || []);
      const node = section.lineStart === line ? nodes[0] : nodes.find(node =>
        node.getAttribute("data-heading") === heading.heading || node.textContent.trim() === heading.heading);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      if (!box.height) continue;
      const offset = this.scroller.scrollTop - this.scroller.getBoundingClientRect().top - this.scroller.clientTop;
      return { top: box.top + offset, bottom: box.bottom + offset, measured: true };
    }
    // Unmounted reading sections retain a layout box. Estimate within that
    // section until its actual heading DOM becomes available.
    for (const section of mode?.renderer?.sections || []) {
      if (section.lineStart > line || section.lineEnd < line || !section.el) continue;
      const fraction = (line - section.lineStart) / Math.max(1, section.lineEnd - section.lineStart + 1);
      const renderer = mode.renderer;
      if (typeof renderer.getSectionTop === "function" && Number.isFinite(section.height)) {
        const offset = renderer.getSectionTop(section);
        if (offset >= 0) {
          const top = offset + (renderer.topSpace || 0) + fraction * section.height;
          return { top, bottom: top, measured: false };
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
    const bounds = this.headings.map((_, index) => this.headingBounds(index));
    const tops = bounds.map(bounds => bounds?.top);
    // Missing virtualized headings use their renderer section's layout estimate
    // in headingBounds; if unavailable, keep native source-position tracking.
    if (tops.some(top => !Number.isFinite(top))) return null;
    return headingLandingStarts(tops, Math.max(0, el.scrollHeight - el.clientHeight), el.clientHeight, bounds.map(bounds => bounds.bottom));
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
    const progress = headingNavigationProgress(this.headings.map(item => item.position.start.line),
      this.lines.length, this.settings.trackingMode, index, {
        scrollRange: Math.max(0, el.scrollHeight - el.clientHeight), viewportHeight: el.clientHeight,
        headingTop: bounds?.top, headingBottom: bounds?.bottom,
        preferredTop: el.scrollTop, lastAtBottom: this.settings.lastAtBottom,
      });
    if (progress !== null) this.scrubTo(progress, true);
  }

  dragRanges() {
    if (this.settings.trackingMode === "length") {
      const starts = this.headingLandingStarts();
      return starts ? physicalHeadingRanges(starts) : null;
    }
    if (this.settings.trackingMode === "equal") {
      return headingAllocations(this.headings.map(heading => heading.position.start.line), this.lines.length, "equal");
    }
    return null;
  }

  dragSectionIndex() {
    if (this.settings.trackingMode !== "off") return this.activeIndex;
    const starts = this.headingLandingStarts();
    const el = this.scroller;
    const range = el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
    return resolveCurrent(this.headings.map(heading => heading.position.start.line), this.lines.length,
      { ...this.settings, trackingMode: starts ? "length" : "position", lastAtBottom: false },
      { headingStarts: starts, first: this.scrollTopLine(), progress: range ? el.scrollTop / range : 0 });
  }

  scrubTo(progress, alignToPixel = false) {
    const el = this.scroller;
    if (!el) return;
    const previous = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    const top = clampProgress(progress) * Math.max(0, el.scrollHeight - el.clientHeight);
    // A normalized integer landing can multiply back to e.g. 17.999999999.
    // WebKit floors that to 17, leaving the previous mark active.
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
      preview: this.previewAt(index),
    };
  }

  bookmarkState(index) {
    const core = bookmarksCore(this.view.app);
    const file = this.view.file;
    const heading = this.headings[index];
    return {
      available: !!(core && file && heading),
      saved: !!(core && file && heading && findHeadingBookmark(core.items, file.path, headingSubpath(heading.heading))),
    };
  }

  async bookmarkHeading(index) {
    const core = bookmarksCore(this.view.app);
    const file = this.view.file;
    const heading = this.headings[index];
    if (!core || !file || !heading) return;
    const subpath = headingSubpath(heading.heading);
    const existing = findHeadingBookmark(core.items, file.path, subpath);
    if (existing) { await core.removeItem(existing); return; }
    await core.addItem({ type: "file", path: file.path, subpath, ctime: Date.now() });
  }

  // How far into the document this heading sits, by line. Lines rather than
  // pixels because that is the unit the rest of the plugin already works in,
  // and it does not change with window width or folded sections.
  percentAt(index) {
    if ((this.headings.at(-1)?.position.start.line ?? -1) >= this.lines.length) return null;
    const span = Math.max(1, this.lines.length - 1);
    const line = this.headings[index].position.start.line;
    return Math.min(100, Math.round((line / span) * 100));
  }

  // The body between this heading and the next, flattened to one line. Markdown
  // is stripped roughly -- this is a glance, not a render.
  previewAt(index) {
    if (!this.settings.showPreview) return "";

    const start = this.headings[index].position.start.line + 1;
    const next = this.headings[index + 1];
    const end = next ? next.position.start.line : this.lines.length;

    const text = this.lines
      .slice(start, end)
      .map((line) =>
        line
          .replace(/^\s*>\s?/, "")
          .replace(/^\s*[-*+]\s+/, "")
          .replace(/^\s*\d+\.\s+/, "")
          .replace(/^\s*\|/, "")
      )
      .join(" ")
      .replace(/!?\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`~]/g, "")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!text) return "";
    const limit = this.settings.previewLength;
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
  }

  // The scroll container differs per mode and is replaced when the mode changes,
  // so re-resolve it on every rebuild rather than caching it once.
  attachScroller() {
    const mode = this.view.currentMode;
    const reading = (mode && mode === this.view.previewMode) || mode?.type === "preview" ||
      this.view.getMode?.() === "preview";
    // Both mode containers can remain in the pane. Document-order selection
    // can bind to the hidden editor, whose scrollTop never changes while reading.
    const next = reading
      ? mode?.renderer?.previewEl || this.view.containerEl.querySelector(
          ".markdown-reading-view .markdown-preview-view")
      : mode?.cm?.scrollDOM || this.view.editor?.cm?.scrollDOM ||
        this.view.containerEl.querySelector(".markdown-source-view .cm-scroller");
    if (next === this.scroller) return;
    this.detachScroller();
    this.scroller = next;
    if (this.scroller) {
      this.scroller.addEventListener("scroll", this.onScroll, { passive: true });
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        this.scroller.addEventListener(event, this.onNavigationInput, { passive: true });
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
    if (this.scrollFrame) this.scrollWindow.cancelAnimationFrame(this.scrollFrame);
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
      phone: !!Platform?.isPhone,
      landscape: !!win?.matchMedia?.("(orientation: landscape)").matches,
      width: this.view.containerEl.clientWidth,
      headings: this.headings.length,
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
    return JSON.stringify(this.view.file
      ? this.view.app.metadataCache.getFileCache(this.view.file)?.headings || [] : []);
  }

  refresh(force = false, checkMetadata = false) {
    this.syncBookmarks();
    if (force || this.file !== this.view.file || this.filePath !== this.view.file?.path ||
        (checkMetadata && this.cachedMetadataKey !== this.metadataKey())) {
      this.rebuild();
      return;
    }
    // A rail may be created before the view has received its note content.
    if (!this.sourceReady) this.refreshSource();
    // Mode or renderer replacement needs rebinding, not a note read or new ticks.
    this.attachScroller();
    this.syncWidth();
    this.scheduleActive();
  }

  updateSettings() {
    super.updateSettings();
    this.el.toggleClass("is-hidden", this.headings.length < this.settings.minHeadings);
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
    this.headings = (cache && cache.headings) || [];

    // Cached here rather than read on hover: rebuild already runs on every
    // metadata change, so this stays as fresh as the heading list itself.
    // Always needed now -- the visible-range calculation counts lines too.
    this.refreshSource();

    this.render(this.headings.map((heading) => heading.level));
    this.el.toggleClass("is-hidden", this.headings.length < settings.minHeadings);

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
    // Metadata can arrive before reading mode receives its text. Read the same
    // file once, keeping navigation/file changes from accepting an old result.
    this.view.app.vault.cachedRead(file).then(text => {
      if (this.sourceEpoch !== epoch || this.view.file !== file) return;
      this.lines = text.split("\n");
      this.sourceReady = this.lines.length > lastHeading;
      this.syncActive();
      if (this.flyoutIndex >= 0) this.showFlyout(this.flyoutIndex);
    }).catch(() => {}); // A later layout/metadata refresh can retry a failed read.
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

    // Editing and live preview: CodeMirror maps viewport coordinates to
    // document positions directly, including for lines it has not rendered.
    const mode = this.view.currentMode;
    const reading = (mode && mode === this.view.previewMode) || mode?.type === "preview" ||
      this.view.getMode?.() === "preview";
    const cm = !reading && (mode?.cm || this.view.editor?.cm);
    if (cm && typeof cm.posAtCoords === "function" && cm.scrollDOM) {
      const box = cm.scrollDOM.getBoundingClientRect();
      const x = box.left + 8;
      const head = cm.posAtCoords({ x, y: box.top + 2 }, false);
      const foot = cm.posAtCoords({ x, y: box.bottom - 2 }, false);
      if (head != null && foot != null) {
        return [
          cm.state.doc.lineAt(head).number - 1,
          cm.state.doc.lineAt(foot).number - 1,
        ];
      }
    }

    // Reading mode: the renderer tracks which source lines each laid-out
    // section covers. Undocumented, hence the guards and the fallback below.
    const sections =
      reading && mode?.renderer?.sections;

    if (sections && sections.length && this.scroller) {
      const frame = this.scroller.getBoundingClientRect();
      let first = Infinity;
      let last = -Infinity;

      for (const section of sections) {
        if (!section || !section.el || typeof section.lineStart !== "number") continue;
        const box = section.el.getBoundingClientRect();
        if (!box.height || box.bottom < frame.top || box.top > frame.bottom) continue;
        first = Math.min(first, section.lineStart);
        last = Math.max(last, section.lineEnd);
      }

      if (last >= first) return [first, last];
    }

    // Last resort, with the flaw described above.
    const el = this.scroller;
    const span =
      el && el.scrollHeight
        ? Math.max(1, this.lines.length * (el.clientHeight / el.scrollHeight))
        : 0;
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
      first, last, topLine,
      progress: scrollRange > 0 ? el.scrollTop / scrollRange : 0,
      scrollable: scrollRange > 2,
      atBottom: this.atBottom(),
      headingStarts: this.settings.trackingMode === "length" ? this.headingLandingStarts() : null,
    };
    const lines = this.headings.map((heading) => heading.position.start.line);
    if (this.settings.trackingMode === "length" && !viewport.headingStarts) {
      // Do not assign unrelated percentage ranges while layout is unavailable.
      const current = resolveCurrent(lines, this.lines.length, { ...this.settings, trackingMode: "position" }, viewport);
      this.paintActive(resolveActive(lines, this.settings, viewport, current), current);
      this.paintProgress(sectionProgress(lines, this.lines.length, { ...this.settings, trackingMode: "position" }, viewport, current));
      return;
    }
    const current = resolveCurrent(lines, this.lines.length, this.settings, viewport);
    const active = resolveActive(lines, this.settings, viewport, current);

    this.paintActive(active, current);
    this.paintProgress(sectionProgress(lines, this.lines.length, this.settings, viewport, current));
  }
}

/* ========================================================= preview rail === */

const SAMPLE = [
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
  { level: 2, title: "Known limits", percent: 93 },
];

const SAMPLE_BODY =
  "Bar length carries heading depth and cursor proximity at once, because both are widths and simply add together.";

class PreviewRail extends RailView {
  constructor(plugin, hostEl) {
    super(plugin, hostEl);
    // Settings may first render while hidden. Re-measure once visible, and when
    // bar spacing/thickness changes, so anchoring always has room to move.
    this.sampleBookmarks = plugin.previewBookmarks || (plugin.previewBookmarks = new Set());
    this.sceneObserver = new ResizeObserver(() => this.fitScene());
    this.sceneObserver.observe(this.el);
  }

  fitScene() {
    const s = this.settings;
    const height = this.levels.length * (s.tickHeight + 6) +
      Math.max(0, this.levels.length - 1) * Math.max(0, s.tickGap - 6) + 20;
    this.host.style.height = `${Math.min(200, Math.max(160, height + 64))}px`;
    this.fitPane();
  }

  destroy() {
    this.sceneObserver.disconnect();
    super.destroy();
  }

  activate(index) {
    if (index < 0) return;
    const mode = this.settings.trackingMode;
    if (!SAMPLE[index]) return;
    const allocated = mode === "length" ? headingLandingStarts(SAMPLE.map(item => item.percent * 10), 750, 250)[index]
      : headingNavigationProgress(SAMPLE.map(item => item.percent), 100, mode, index);
    this.progress = allocated ?? Math.min(1, SAMPLE[index].percent / 75);
    this.rebuild();
    if (this.onProgress) this.onProgress(this.progress);
  }

  bookmarkState(index) {
    return { available: !!SAMPLE[index], saved: this.sampleBookmarks.has(index) };
  }

  async bookmarkHeading(index) {
    if (!SAMPLE[index]) return;
    if (this.sampleBookmarks.has(index)) this.sampleBookmarks.delete(index);
    else this.sampleBookmarks.add(index);
  }

  labelFor(index) {
    const item = SAMPLE[index];
    if (!item) return null;
    return { title: item.title, percent: item.percent, preview: SAMPLE_BODY };
  }

  rebuild() {
    if (this.progress == null) this.progress = 0.4;
    this.render(SAMPLE.map((item) => item.level));
    this.activeKey = "";
    this.syncActive();
    this.fitScene();
  }

  dragRanges() {
    if (this.settings.trackingMode === "length") {
      return physicalHeadingRanges(headingLandingStarts(SAMPLE.map(item => item.percent * 10), 750, 250));
    }
    if (this.settings.trackingMode === "equal") return headingAllocations(SAMPLE.map(item => item.percent), 100, "equal");
    return null;
  }

  scrubTo(progress) {
    this.progress = clampProgress(progress);
    this.syncActive();
    if (this.onProgress) this.onProgress(this.progress);
  }

  syncActive() {
    const lines = SAMPLE.map(item => item.percent);
    const viewport = { first: this.progress * 75, last: this.progress * 75 + 25,
      progress: this.progress, scrollable: true, atBottom: this.progress >= 1,
      headingStarts: this.settings.trackingMode === "length" ? headingLandingStarts(SAMPLE.map(item => item.percent * 10), 750, 250) : null };
    const current = resolveCurrent(lines, 100, this.settings, viewport);
    this.paintActive(resolveActive(lines, this.settings, viewport, current), current);
    this.paintProgress(sectionProgress(lines, 100, this.settings, viewport, current));
  }

}

/* =============================================================== settings = */

class ScrollspySettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.draftName = "";
    this.updateTargetId = plugin.settings.activePreset === "custom"
      ? plugin.settings.sourcePresetId : plugin.settings.activePreset;
    this.preview = null;
    this.previewProgress = 0.4;
    this.sectionScroll = {};
  }

  hide() {
    if (this.preview) {
      this.previewProgress = this.preview.progress;
      this.preview.destroy();
      this.preview = null;
    }
  }

  // Update the sample immediately; settings persistence is debounced separately.
  save(render) {
    this.plugin.saveSettings();
    if (this.preview) {
      this.preview.updateSettings();
      this.preview.syncActive();
      this.preview.fitScene();
    }
    if (this.updateSimulation) this.updateSimulation();
    if (this.presetDrop) {
      const customOptions = Array.from(this.presetDrop.selectEl.options).filter(option => option.value === "custom");
      const unsaved = this.plugin.settings.activePreset === "custom";
      // Obsidian's addOption always appends, including on every slider event.
      for (const [index, option] of customOptions.entries()) {
        if (!unsaved || index > 0) option.remove();
      }
      if (unsaved && !customOptions.length) this.presetDrop.addOption("custom", "Custom (unsaved)");
      this.presetDrop.setValue(this.plugin.settings.activePreset);
    }
    if (this.presetUpdateEl) this.renderPresetUpdate();
    if (render) this.display();
  }

  // Touching anything a preset captures means you are no longer on that preset.
  // Saying so beats leaving a stale name at the top of the tab.
  edited(key) {
    if (PRESET_KEYS.includes(key)) {
      const active = this.plugin.settings.activePreset;
      if (active !== "custom") this.plugin.settings.sourcePresetId = active;
      this.plugin.settings.activePreset = "custom";
    }
  }

  capture() {
    const values = {};
    for (const key of PRESET_KEYS) values[key] = this.plugin.settings[key];
    return values;
  }

  currentPreset() {
    return this.plugin.settings.presets.find(
      (preset) => preset.id === this.plugin.settings.activePreset
    );
  }

  /* ---------------------------------------------------------------- rows -- */

  heading(text, desc) {
    const setting = new Setting(this.sectionEl || this.containerEl).setName(text).setHeading();
    if (desc) setting.setDesc(desc);
    return this.sectionEl || this.containerEl;
  }

  toggle(parent, name, desc, key, render) {
    new Setting(parent)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key]).onChange((value) => {
          this.plugin.settings[key] = value;
          this.edited(key);
          this.save(render);
        })
      );
  }

  slider(parent, name, desc, key, min, max, step, unit) {
    const setting = new Setting(parent).setName(name).setDesc(desc);

    // Obsidian's slider only shows its value mid-drag. A standing readout
    // matters more than usual here, because most of these are pixel counts.
    const format = value => key.endsWith("Opacity")
      ? `${Math.round(value * 100)}%` : `${Number(value.toFixed(2))}${unit || ""}`;
    const readout = setting.controlEl.createSpan({
      cls: "scrollspy-readout",
      text: format(this.plugin.settings[key]),
    });

    // Native inputs let dragging and exact entry share one value. Keep the
    // formatted readout for units and opacity percentages.
    const input = setting.controlEl.createEl("input", { type: "range" });
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.plugin.settings[key]);
    const number = setting.controlEl.createEl("input", { type: "number", cls: "scrollspy-number" });
    number.min = String(min); number.max = String(max); number.step = String(step);
    number.value = String(this.plugin.settings[key]);
    number.setAttribute("aria-label", `${name} value`);
    number.addEventListener("change", () => {
      const value = Number(number.value);
      if (!number.value || !Number.isFinite(value) || value < min || value > max) {
        number.value = String(this.plugin.settings[key]); return;
      }
      this.plugin.settings[key] = value;
      input.value = String(value);
      readout.setText(format(value));
      input.setAttribute("aria-valuetext", format(value));
      this.edited(key); this.save(false);
    });
    setting.controlEl.appendChild(readout);
    input.setAttribute("aria-label", name);
    input.setAttribute("aria-valuetext", format(this.plugin.settings[key]));
    input.addEventListener("input", () => {
      const value = Number(input.value);
      readout.setText(format(value));
      number.value = String(value);
      input.setAttribute("aria-valuetext", format(value));
      this.plugin.settings[key] = value;
      this.edited(key);
      this.save(false);
    });
  }

  dropdown(parent, name, desc, key, options, render) {
    new Setting(parent)
      .setName(name)
      .setDesc(desc)
      .addDropdown((drop) =>
        drop
          .addOptions(options)
          .setValue(this.plugin.settings[key])
          .onChange((value) => {
            this.plugin.settings[key] = value;
            this.edited(key);
            this.save(render);
          })
      );
  }

  normalChoice(parent, name, desc, id, options) {
    const s = this.plugin.settings;
    const matches = values => Object.entries(values).every(([key, value]) => s[key] === value);
    const selected = Object.keys(options).find(key => matches(options[key][1]));
    new Setting(parent).setName(name).setDesc(desc).addDropdown(drop => {
      drop.selectEl.dataset.setting = id;
      for (const [key, [label]] of Object.entries(options)) drop.addOption(key, label);
      if (!selected) {
        drop.addOption("custom", "Custom");
        drop.selectEl.querySelector('option[value="custom"]').disabled = true;
      }
      drop.setValue(selected || "custom").onChange(value => {
        const choice = options[value];
        if (!choice) return;
        for (const [key, setting] of Object.entries(choice[1])) {
          s[key] = setting;
          this.edited(key);
        }
        this.save(true);
        this.containerEl.querySelector(`select[data-setting="${id}"]`)?.focus({ preventScroll: true });
      });
    });
  }

  renderEditorMode() {
    const row = this.containerEl.createDiv({ cls: "scrollspy-editor-mode" });
    row.createSpan({ text: "Customize" });
    const group = row.createDiv({ cls: "scrollspy-mode-buttons" });
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Customization mode");
    for (const [advanced, label] of [[false, "Normal"], [true, "Advanced"]]) {
      const button = group.createEl("button", { text: label, type: "button" });
      button.setAttribute("aria-pressed", String(!!this.plugin.settings.showAdvanced === advanced));
      button.addEventListener("click", () => {
        this.plugin.settings.showAdvanced = advanced;
        this.save(true);
        this.containerEl.querySelector(`.scrollspy-mode-buttons button[aria-pressed="true"]`)?.focus({ preventScroll: true });
      });
    }
    if (this.plugin.settings.showAdvanced) row.createSpan({ cls: "setting-item-description", text: "Fine-tune every value." });
  }

  renderNormalAppearance(s) {
    const shape = this.heading("Marks");
    this.normalChoice(shape, "Length", "How far each resting mark reaches into the note.", "markLength", {
      short: ["Short", { tickWidth: 12 }], standard: ["Standard", { tickWidth: 16 }],
      extended: ["Extended", { tickWidth: 18 }], long: ["Long", { tickWidth: 24 }],
    });
    this.normalChoice(shape, "Shape", "", "markShape", {
      fine: ["Hairline", { tickHeight: 1, tickRadius: 1 }],
      bar: ["Bar", { tickHeight: 3, tickRadius: 1 }],
      square: ["Square", { tickHeight: 3, tickRadius: 0 }],
      rounded: ["Rounded", { tickHeight: 4, tickRadius: 2 }],
    });
    this.normalChoice(shape, "Spacing", "Space between neighbouring marks.", "markSpacing", {
      compact: ["Compact", { tickGap: 4 }], standard: ["Standard", { tickGap: 8 }],
      open: ["Open", { tickGap: 14 }], airy: ["Airy", { tickGap: 20 }],
    });
    this.normalChoice(shape, "Heading depth", "Shorten nested headings to suggest an outline.", "headingDepth", {
      flat: ["Uniform", { levelIndent: 0 }], subtle: ["Subtle", { levelIndent: 2 }], outline: ["Outline", { levelIndent: 4 }],
    });
    this.renderMarkAlignment(shape);
    const visibility = this.heading("Emphasis");
    this.normalChoice(visibility, "Visibility", "Idle, passed and current heading visibility.", "visibility", {
      subtle: ["Subtle", { idleOpacity: 0.15, passedOpacity: 0.25, activeOpacity: 0.8 }],
      balanced: ["Balanced", { idleOpacity: 0.25, passedOpacity: 0.4, activeOpacity: 1 }],
      prominent: ["Prominent", { idleOpacity: 0.5, passedOpacity: 0.65, activeOpacity: 1 }],
    });
    this.normalChoice(visibility, "Pointer nearby", "Visibility of the rail while you point at it.", "pointerVisibility", {
      quiet: ["Subtle", { hoverOpacity: 0.25 }], balanced: ["Balanced", { hoverOpacity: 0.55 }], full: ["Full", { hoverOpacity: 1 }],
    });
    this.normalChoice(visibility, "Current mark", "Extra length for the current heading.", "currentEmphasis", {
      none: ["Same length", { activeBoost: 0 }], subtle: ["Slightly longer", { activeBoost: 4 }], strong: ["Longer", { activeBoost: 8 }],
    });
    this.toggle(visibility, "Distinguish passed headings", "Use the passed visibility for earlier headings.", "markPassed", false);
    this.renderHeadingChoices(s);
    this.renderColour(s);
  }

  renderMarkAlignment(parent) {
    this.choices(parent, "Mark alignment", "Align marks of different lengths within the rail.", "markAlignment", {
      edge: ["Follow rail side", "Align with the side of the note."],
      left: ["Left", "Line up the left ends."], center: ["Centre", "Centre every mark."], right: ["Right", "Line up the right ends."],
    });
  }

  renderHeadingChoices(s) {
    const hierarchy = this.heading("Headings");
    this.choices(hierarchy, "Which headings to show", "The current heading stays visible in either mode.", "hierarchyMode", {
      all: ["All headings", "Keep every heading visible."],
      nearby: ["Reveal nearby", "Hover a heading to reveal the deeper headings in its branch."],
    });
    if (s.hierarchyMode !== "nearby") return;
    if (s.showAdvanced) this.slider(hierarchy, "Levels shown at rest", "Relative to the note’s shallowest heading. Deeper headings appear near your pointer.", "idleLevels", 1, 6, 1);
    else this.normalChoice(hierarchy, "Levels shown at rest", "Deeper headings appear near your pointer.", "headingLevels", {
      main: ["Main headings", { idleLevels: 1 }], two: ["Two levels", { idleLevels: 2 }], all: ["All levels", { idleLevels: 6 }],
    });
  }

  renderColour(s) {
    const colour = this.heading("Current heading colour");
    this.dropdown(colour, "Colour", "", "colorMode", { neutral: "Neutral text", accent: "Theme accent", custom: "Custom colour" }, true);
    if (s.colorMode === "custom") new Setting(colour).setName("Custom colour").addColorPicker(picker =>
      picker.setValue(s.customColor).onChange(value => {
        s.customColor = value; this.edited("customColor"); this.save(false);
      }));
  }

  /* ------------------------------------------------------------- display -- */

  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;

    const previousPanel = this.containerEl.querySelector(".scrollspy-panel");
    if (previousPanel && this.displayedSection) {
      this.sectionScroll[this.displayedSection] = this.containerEl.scrollTop;
    }
    const managerOpen = this.containerEl.querySelector(".scrollspy-preset-manager")?.open;
    this.hide();
    this.presetDrop = null;
    this.sectionEl = null;
    containerEl.empty();
    containerEl.addClass("scrollspy-settings");

    const header = containerEl.createDiv({ cls: "scrollspy-settings-header" });
    header.createEl("h2", { text: "Margin Rail" });
    header.createEl("p", { text: "Your rail, with room to breathe." });
    this.renderPresetPicker(header, s);
    this.presetUpdateEl = header.createDiv({ cls: "scrollspy-preset-update" });
    this.renderPresetUpdate();
    const manager = containerEl.createEl("details", { cls: "scrollspy-preset-manager" });
    manager.open = !!managerOpen;
    manager.createEl("summary", { text: "Save as…" });
    const presetBody = manager.createDiv();
    this.sectionEl = presetBody;
    this.renderPresets(s);
    this.sectionEl = null;
    this.renderPreview();
    this.renderEditorMode();
    const nav = containerEl.createDiv({ cls: "scrollspy-nav" });
    nav.setAttribute("role", "tablist");
    const sections = { appearance: "Rail", tracking: "Behaviour", labels: "Labels", placement: "Placement" };
    // Keep the user's previous section when upgrading the six-tab layout.
    if (s.settingsSection === "hover") s.settingsSection = "tracking";
    if (s.settingsSection === "presets") { manager.open = true; s.settingsSection = "appearance"; }
    if (!sections[s.settingsSection]) s.settingsSection = "appearance";
    const panel = containerEl.createDiv({ cls: "scrollspy-panel" });
    panel.id = "scrollspy-settings-panel";
    panel.setAttribute("role", "tabpanel");
    for (const [key, title] of Object.entries(sections)) {
      const button = nav.createEl("button", { text: title, cls: key === s.settingsSection ? "is-selected" : "" });
      button.id = `scrollspy-tab-${key}`;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(key === s.settingsSection));
      button.setAttribute("aria-controls", panel.id);
      button.addEventListener("click", () => {
        s.settingsSection = key; this.save(true);
        this.containerEl.querySelector(`#scrollspy-tab-${key}`).focus({ preventScroll: true });
      });
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const keys = Object.keys(sections);
        const next = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 :
          (keys.indexOf(key) + (event.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
        s.settingsSection = keys[next];
        this.save(true);
        this.containerEl.querySelector(`#scrollspy-tab-${keys[next]}`).focus();
      });
      button.tabIndex = key === s.settingsSection ? 0 : -1;
    }
    panel.setAttribute("aria-labelledby", `scrollspy-tab-${s.settingsSection}`);
    this.sectionEl = panel;
    if (s.settingsSection === "tracking") { this.renderTracking(s); this.renderPointer(s); }
    if (s.settingsSection === "appearance") this.renderAppearance(s);
    if (s.settingsSection === "labels") this.renderLabels(s);
    if (s.settingsSection === "placement") this.renderPlacement(s);
    this.displayedSection = s.settingsSection;
    containerEl.scrollTop = this.sectionScroll[s.settingsSection] || 0;
  }

  renderPreview() {
    this.updateSimulation = null;
    const box = this.containerEl.createDiv({ cls: "scrollspy-preview" });
    const disclosure = box.createEl("details", { cls: "scrollspy-preview-disclosure" });
    disclosure.open = !this.plugin.settings.previewCollapsed;
    disclosure.createEl("summary", { text: "Live preview" });
    disclosure.addEventListener("toggle", () => {
      if (!disclosure.isConnected) return;
      const collapsed = !disclosure.open;
      if (this.plugin.settings.previewCollapsed === collapsed) return;
      this.plugin.settings.previewCollapsed = collapsed;
      // This is a settings-panel preference, not a change to document rails or
      // presets. Keep the sample and simulated progress intact while toggling.
      this.plugin.saveData(this.plugin.settings);
    });
    const stage = disclosure.createDiv({ cls: "scrollspy-stage" });
    stage.createDiv({ cls: "scrollspy-preview-title", text: "Try your rail" });
    for (let i = 0; i < 7; i++) stage.createDiv({ cls: "scrollspy-stage-line" });
    this.preview = new PreviewRail(this.plugin, stage);
    this.preview.progress = this.previewProgress;
    this.preview.rebuild();
    const simulator = disclosure.createDiv({ cls: "scrollspy-simulator" });
    const status = simulator.createDiv({ cls: "scrollspy-simulation-status" });
    const input = simulator.createEl("input", { type: "range" });
    input.min = "0"; input.max = "1000"; input.step = "1";
    input.setAttribute("aria-label", "Simulated scroll progress");
    const details = simulator.createEl("details", { cls: "scrollspy-simulation-details" });
    details.createEl("summary", { text: "Tracking details" });
    const allocations = details.createDiv({ cls: "scrollspy-allocations" });
    allocations.setAttribute("aria-label", "Heading shares of scroll progress");
    const note = details.createDiv({ cls: "setting-item-description" });
    this.updateSimulation = () => {
      if (!this.preview) return;
      const progress = this.preview.progress;
      input.value = String(Math.round(progress * 1000));
      const current = this.preview.activeIndex;
      const sectionRead = this.plugin.settings.showSectionProgress && current >= 0
        ? ` · ${Math.round(this.preview.sectionFraction * 100)}% of section` : "";
      status.setText(`${Math.round(progress * 100)}% scrolled · ${current < 0 ? "No current heading" : SAMPLE[current].title}${sectionRead}`);
      allocations.empty();
      const mode = this.plugin.settings.trackingMode;
      const allocated = mode === "equal" || mode === "length";
      allocations.hidden = !allocated;
      if (allocated) {
        const ranges = mode === "length"
          ? physicalHeadingRanges(headingLandingStarts(SAMPLE.map(item => item.percent * 10), 750, 250))
          : headingAllocations(SAMPLE.map(item => item.percent), 100, mode);
        ranges.forEach((range, i) => {
          const segment = allocations.createEl("button", { text: String(i + 1), cls: i === current ? "is-current" : "" });
          segment.style.flex = String(range.end - range.start);
          const label = `${SAMPLE[i].title}: ${(range.start * 100).toFixed(1)}–${(range.end * 100).toFixed(1)}%`;
          segment.title = label;
          segment.setAttribute("aria-label", label);
          segment.addEventListener("click", () => this.preview.activate(i));
        });
      }
      note.setText(allocated ? "Each numbered block is a heading’s share. Click one or scrub the slider. Section length follows heading landing positions." :
        "Drag the rail or scrub the slider. Hover to reveal headings; click a bar to jump. Sample viewport: 25% of the note.");
    };
    input.addEventListener("input", () => {
      this.preview.progress = Number(input.value) / 1000;
      this.preview.rebuild();
      this.updateSimulation();
    });
    this.preview.onProgress = this.updateSimulation;
    this.updateSimulation();
  }

  choices(parent, name, desc, key, options) {
    const labels = Object.fromEntries(Object.entries(options).map(([value, [title]]) => [value, title]));
    const row = new Setting(parent).setName(name);
    const describe = () => options[this.plugin.settings[key]]?.[1] || desc;
    row.setDesc(describe()).addDropdown(drop => {
      drop.selectEl.dataset.setting = key;
      return drop.addOptions(labels).setValue(this.plugin.settings[key]).onChange(value => {
        this.plugin.settings[key] = value;
        this.edited(key);
        this.save(true);
        this.containerEl.querySelector(`select[data-setting="${key}"]`)?.focus({ preventScroll: true });
      });
    });
  }

  renderTracking(s) {
    const navigation = this.heading("Heading navigation");
    this.toggle(navigation, "Place cursor at heading", "When clicking a mark in editing mode, move the cursor to the start of its heading.", "placeCursorOnNavigate", false);
    this.toggle(navigation, "Briefly highlight heading", "When clicking a mark, highlight its destination and fade it out. Works in reading and editing modes.", "highlightOnNavigate", false);
    if (Platform?.isMacOS && Platform?.isDesktopApp) {
      this.toggle(navigation, "Haptic ticks while dragging", "Feel section boundaries on a Force Touch or Magic Trackpad. No extra feedback on clicks or ordinary scrolling. Mac only.", "macDragHaptics", false);
    }
    const box = this.heading("Scroll tracking");
    this.choices(box, "Tracking rule", "Try each rule with the slider above.", "trackingMode", {
      position: ["Follow the note", "Current when its heading reaches the top."],
      length: ["By section length", "Tracks the rendered sections. Longer sections stay active longer."],
      equal: ["Equal shares", "Every heading gets the same scroll time."],
      off: ["No tracking", "Keep the rail for navigation without a current marker."],
    });
    this.toggle(box, "Show progress within the section", "The current bar fills as you move through its section. Allocation rules use that heading’s scroll share; Follow the note uses source lines.", "showSectionProgress", true);
    if (s.showSectionProgress) this.choices(box, "Fill direction", "How progress grows inside the current mark.", "progressDirection", {
      left: ["Left to right", "Start at the left end."],
      right: ["Right to left", "Start at the right end."],
      center: ["From centre", "Grow outward in both directions."],
    });
    this.toggle(box, "Finish on the last heading", "At the bottom of a scrollable note, make the final heading current. Works with every rule, including no tracking.", "lastAtBottom", false);
    if (s.trackingMode !== "off") this.choices(box, "Highlight", "The chosen heading still determines which sections count as passed.", "activeMode", {
      single: ["Current heading", "Highlight the one chosen by your tracking rule."],
      visible: ["Also on screen", "Highlight visible headings alongside the current one."],
    });
  }


  renderPresetPicker(parent, s) {
    const options = {};
    for (const preset of BUILTIN_PRESETS) options[preset.id] = preset.name + (preset.id === "default" ? " (default)" : "");
    for (const preset of s.presets) options[preset.id] = preset.name +
      (BUILTIN_PRESETS.some(builtin => builtin.name === preset.name) ? " (saved)" : "");
    const builtin = BUILTIN_PRESETS.find(preset => preset.id === s.activePreset);
    if (s.activePreset === "custom") options.custom = "Custom (unsaved)";

    new Setting(parent)
      .setName("Preset")
      .setDesc(builtin ? builtin.description : "Appearance and behaviour from every section.")
      .addDropdown((drop) => {
        this.presetDrop = drop;
        return drop
          .addOptions(options)
          .setValue(s.activePreset)
          .onChange((value) => {
            const preset = BUILTIN_PRESETS.find(item => item.id === value) ||
              s.presets.find(item => item.id === value);
            if (preset) Object.assign(s, DEFAULTS, preset.values);
            if (s.labelMoveMotion === "fade") s.labelMoveMotion = "none";
            s.activePreset = value;
            if (value !== "custom") s.sourcePresetId = value;
            this.updateTargetId = s.sourcePresetId;
            this.save(true);
          });
      });
    const manage = parent.createEl("button", { cls: "scrollspy-preset-menu", text: "…", type: "button" });
    manage.setAttribute("aria-label", "Preset options");
    manage.setAttribute("aria-haspopup", "menu");
    manage.addEventListener("click", event => {
      const menu = new Menu();
      menu.addItem(item => item.setTitle("Reset to v2").onClick(() => {
        Object.assign(s, DEFAULTS);
        s.activePreset = "default"; s.sourcePresetId = null; this.updateTargetId = null;
        this.save(true);
      }));
      const saved = s.presets.find(preset => preset.id === (s.activePreset === "custom" ? s.sourcePresetId : s.activePreset));
      if (saved) menu.addItem(item => item.setTitle(`Delete “${saved.name}”`).onClick(() => {
        s.presets = s.presets.filter(preset => preset.id !== saved.id);
        if (s.activePreset === saved.id) s.activePreset = "custom";
        if (s.sourcePresetId === saved.id) s.sourcePresetId = null;
        this.updateTargetId = null;
        this.save(true);
      }));
      menu.showAtMouseEvent(event);
    });

  }

  updatePreset() {
    const s = this.plugin.settings;
    const source = s.activePreset === "custom" ? s.sourcePresetId : s.activePreset;
    const id = this.updateTargetId || source;
    const builtin = BUILTIN_PRESETS.find(item => item.id === id);
    // Only copies explicitly created from this built-in can be reused.
    // Names are user-editable labels and cannot identify an update target.
    return s.presets.find(item => item.id === id) ||
      (builtin && s.presets.find(item => item.originBuiltinId === builtin.id)) || builtin || null;
  }

  renderPresetUpdate() {
    const group = this.presetUpdateEl;
    group.empty();
    const saved = this.updatePreset();
    group.hidden = this.plugin.settings.activePreset !== "custom" || (!saved && !this.plugin.settings.presets.length);
    if (group.hidden) return;
    const update = group.createEl("button", { text: "Update", type: "button" });
    update.disabled = !saved;
    update.setAttribute("aria-label", saved ? `Update preset “${saved.name}”` : "Update preset");
    update.addEventListener("click", () => {
      let target = this.updatePreset();
      if (!target) return;
      if (!this.plugin.settings.presets.includes(target)) {
        target = { id: `user-${Date.now().toString(36)}`, name: target.name,
          originBuiltinId: target.id, values: {} };
        this.plugin.settings.presets.push(target);
      }
      target.values = this.capture();
      this.plugin.settings.activePreset = target.id;
      this.plugin.settings.sourcePresetId = target.id;
      this.updateTargetId = target.id;
      new Notice(`Updated “${target.name}”.`);
      this.save(true);
      this.presetDrop?.selectEl.focus({ preventScroll: true });
    });
    const destinations = [...this.plugin.settings.presets];
    if (saved && !destinations.includes(saved)) destinations.unshift(saved);
    if (saved && destinations.length === 1) {
      group.createSpan({ cls: "scrollspy-update-target" }).createSpan({ text: saved.name });
      return;
    }
    const picker = group.createEl("button", { cls: "scrollspy-update-target", type: "button" });
    picker.createSpan({ text: saved ? saved.name : "Choose preset" });
    setIcon(picker.createSpan({ cls: "scrollspy-update-chevron" }), "chevron-down");
    picker.setAttribute("aria-label", saved ? `Choose preset to update; currently “${saved.name}”` : "Choose preset to update");
    picker.setAttribute("aria-haspopup", "menu");
    picker.addEventListener("click", event => {
      const menu = new Menu();
      for (const preset of destinations) {
        menu.addItem(item => item.setTitle(preset.name).setChecked(preset.id === saved?.id).onClick(() => {
          // Choosing a destination never loads it over the current edits.
          this.updateTargetId = preset.id;
          this.display();
          this.presetUpdateEl.querySelector("[aria-haspopup]")?.focus({ preventScroll: true });
        }));
      }
      menu.showAtMouseEvent(event);
    });
  }

  renderPresets(s) {
    const box = this.sectionEl || this.containerEl;
    new Setting(box)
      .setName("Save current settings")
      .setDesc("Stores appearance and behaviour from every section under a name.")
      .addText((text) =>
        text
          .setPlaceholder("Preset name")
          .setValue(this.draftName)
          .onChange((value) => {
            this.draftName = value;
          })
      )
      .addButton((button) =>
        button
          .setButtonText("Save")
          .setCta()
          .onClick(() => {
            const name = this.draftName.trim();
            if (!name) {
              new Notice("Give the preset a name first.");
              return;
            }
            const id = `user-${Date.now().toString(36)}`;
            s.presets.push({ id, name, values: this.capture() });
            s.activePreset = id;
            s.sourcePresetId = id;
            this.updateTargetId = id;
            this.draftName = "";
            new Notice(`Saved preset “${name}”.`);
            this.save(true);
          })
      );

  }

  renderAppearance(s) {
    if (!s.showAdvanced) { this.renderNormalAppearance(s); return; }
    const bars = this.heading("Shape");
    this.slider(bars, "Length", "", "tickWidth", 4, 60, 1, "px");
    this.slider(bars, "Thickness", "", "tickHeight", 1, 14, 1, "px");
    this.slider(bars, "Corner radius", "", "tickRadius", 0, 7, 0.5, "px");
    this.slider(bars, "Spacing", "", "tickGap", 0, 24, 1, "px");
    this.slider(bars, "Indent per heading level", "Shorten nested headings. Zero gives every level the same length.", "levelIndent", 0, 12, 1, "px");
    const states = this.heading("Visibility");
    this.slider(states, "Idle", "Headings ahead of you.", "idleOpacity", 0.05, 1, 0.05);
    this.slider(states, "Pointer nearby", "Visibility of the whole rail while you point at it. The pointed bar stays fully visible.", "hoverOpacity", 0.05, 1, 0.05);
    this.slider(states, "Current", "Headings highlighted by your tracking rule.", "activeOpacity", 0.05, 1, 0.05);
    this.slider(states, "Extra length when current", "Added to the resting length and pointer swell.", "activeBoost", 0, 40, 1, "px");
    this.toggle(states, "Distinguish passed headings", "Give headings before the current one their own visibility and length.", "markPassed", true);
    if (s.markPassed) {
      this.slider(states, "Passed visibility", "Lower values fade passed sections.", "passedOpacity", 0.05, 1, 0.05);
      this.slider(states, "Extra length when passed", "Zero keeps their resting length.", "passedBoost", 0, 40, 1, "px");
    }
    this.renderMarkAlignment(bars);
    this.renderHeadingChoices(s);
    this.renderColour(s);
  }

  renderPointer(s) {
    const box = this.heading("Pointer response");
    this.toggle(box, "Drag to scrub", "Hold and drag along the rail to scroll continuously from top to bottom. A click still jumps to a heading.", "dragToScrub", false);
    if (!s.showAdvanced) {
      this.normalChoice(box, "On hover", "Choose how marks respond to your pointer.", "hoverResponse", {
        none: ["Still", { hoverStyle: "none" }],
        wave: ["Swell", { hoverStyle: "wave", waveBoost: 30, waveReach: 60, waveFocus: 3 }],
        pill: ["Heading badge", { hoverStyle: "pill", expandWidth: 30, expandHeight: 16, showLevel: true }],
        focus: ["Focus", { hoverStyle: "focus" }],
        dot: ["Dot", { hoverStyle: "dot", expandHeight: 10 }],
      });
      this.normalChoice(box, "Pointer area", "Invisible padding on each side; wider is easier to hit.", "pointerArea", {
        narrow: ["Narrow", { hitbox: 16 }], standard: ["Standard", { hitbox: 36 }], wide: ["Wide", { hitbox: 60 }],
      });
      this.normalChoice(box, "Motion", "How quickly hover effects respond.", "motion", {
        instant: ["Instant", { animDuration: 0 }], quick: ["Quick", { animDuration: 120 }], smooth: ["Smooth", { animDuration: 220 }], relaxed: ["Relaxed", { animDuration: 400 }],
      });
      return;
    }
    this.choices(box, "On hover", "Choose an effect, then tune it below.", "hoverStyle", {
      wave: ["Swell", "Nearby bars grow toward your pointer."],
      pill: ["Heading badge", "The pointed mark opens into a rounded heading badge."],
      focus: ["Focus", "Frame the pointed mark and dim surrounding marks. The current heading stays visible."],
      dot: ["Dot", "The pointed mark becomes a small circle."],
      none: ["Still", "Highlight and labels without growing bars."],
    });
    this.slider(box, "Pointer area", "Invisible padding on each side of the rail. Wider is easier to hit.", "hitbox", 0, 120, 2, "px");
    if (s.hoverStyle !== "none") this.slider(box, "Animation duration", "Lower is snappier; higher moves more slowly.", "animDuration", 0, 800, 20, "ms");
    if (s.hoverStyle === "wave") {
      this.slider(box, "Extra length at the pointer", "", "waveBoost", 0, 120, 1, "px");
      this.slider(box, "Distance of the swell", "How far neighbours react on either side.", "waveReach", 10, 240, 5, "px");
      this.slider(box, "Focus", "Low spreads growth; high concentrates it on the nearest bar.", "waveFocus", 1, 8, 0.5);
    }
    if (s.hoverStyle === "dot") this.slider(box, "Dot diameter", "Size of the circle on hover.", "expandHeight", 8, 32, 1, "px");
    if (s.hoverStyle === "pill") {
      this.slider(box, "Opened length", "", "expandWidth", 12, 80, 1, "px");
      this.slider(box, "Opened thickness", "", "expandHeight", 8, 32, 1, "px");
      this.toggle(box, "Show heading level", "Print H1–H6 inside the pill.", "showLevel", false);
    }
  }

  renderLabels(s) {
    const box = this.heading("Labels");

    this.toggle(
      box,
      "Show heading on hover",
      "A floating label beside the bar you are pointing at.",
      "showLabels",
      true
    );

    if (!s.showLabels) return;

    this.choices(box, "Show and hide", "How the label appears and disappears. Independent of moving between marks.", "labelMotion", {
      none: ["None", "Show and hide instantly."],
      fade: ["Fade", "Fade in and out without moving."],
      slide: ["Slide", "Fade and slide gently away from the rail."],
    });
    if (s.labelMotion !== "none") {
      if (s.showAdvanced) this.slider(box, "Show and hide duration", "Independent of movement between marks.", "labelDuration", 0, 800, 20, "ms");
      else this.normalChoice(box, "Show and hide speed", "", "labelSpeed", {
        quick: ["Quick", { labelDuration: 120 }], smooth: ["Smooth", { labelDuration: 220 }], relaxed: ["Relaxed", { labelDuration: 400 }],
      });
    }
    this.choices(box, "Between marks", "How a visible label changes as you move to another heading.", "labelMoveMotion", {
      none: ["None", "Jump straight to the next heading."],
      slide: ["Slide", "Glide to the next heading."],
    });
    if (s.labelMoveMotion !== "none") {
      if (s.showAdvanced) this.slider(box, "Between marks duration", "Time to glide to the next heading.", "labelMoveDuration", 0, 800, 20, "ms");
      else this.normalChoice(box, "Between marks speed", "", "labelMoveSpeed", {
        quick: ["Quick", { labelMoveDuration: 120 }], smooth: ["Smooth", { labelMoveDuration: 220 }], relaxed: ["Relaxed", { labelMoveDuration: 400 }],
      });
    }
    this.toggle(box, "Quick bookmark button", "Add or remove a heading bookmark from its hover label. Bookmarked headings have a dot beside their tick. Preview clicks only change the sample.", "showBookmarkButton", false);
    if (s.showAdvanced) this.slider(box, "Label distance", "Space between the rail and label.", "labelOffset", 0, 40, 1, "px");
    else this.normalChoice(box, "Label distance", "", "labelDistance", {
      close: ["Close", { labelOffset: 4 }], standard: ["Standard", { labelOffset: 10 }], far: ["Further", { labelOffset: 20 }],
    });
    this.toggle(
      box,
      "Show how far into the note",
      "Heading position in source lines, independent of the scroll tracking rule.",
      "showPercent",
      false
    );
    this.toggle(
      box,
      "Show a bit of the text",
      "The start of that section, under its heading.",
      "showPreview",
      true
    );
    if (s.showPreview && !s.showAdvanced) this.normalChoice(box, "Excerpt length", "", "excerptLength", {
      brief: ["Brief", { previewLength: 60 }], standard: ["Standard", { previewLength: 120 }], longer: ["Longer", { previewLength: 240 }],
    });
    if (s.showPreview && s.showAdvanced) {
      this.slider(
        box,
        "How much text",
        "Characters of the section to show.",
        "previewLength",
        40,
        400,
        10
      );
    }
  }

  renderPlacement(s) {
    const box = this.heading("Position in the note");
    this.dropdown(box, "Side", "", "side", { left: "Left", right: "Right" }, false);
    this.dropdown(box, "Vertical anchor", "", "anchor", { top: "Top", middle: "Middle", bottom: "Bottom" }, false);
    if (s.showAdvanced) this.slider(box, "Distance from the edge", "", "edgeOffset", 0, 80, 1, "px");
    else this.normalChoice(box, "Edge inset", "", "edgeInset", {
      flush: ["Flush", { edgeOffset: 0 }], standard: ["Slightly inset", { edgeOffset: 12 }], inset: ["Inset", { edgeOffset: 24 }],
    });
    if (s.showAdvanced) this.slider(box, "Nudge up or down", "", "axisOffset", -300, 300, 2, "px");
    if (!s.showAdvanced) this.normalChoice(box, "Vertical offset", "Relative to the anchor.", "verticalOffset", {
      up: ["Up a little", { axisOffset: -40 }], none: ["None", { axisOffset: 0 }], down: ["Down a little", { axisOffset: 40 }],
    });
    const hide = this.heading("When to show the rail");
    if (s.showAdvanced) this.slider(hide, "Minimum headings", "Notes with fewer headings get no rail.", "minHeadings", 1, 10, 1);
    else this.normalChoice(hide, "Minimum headings", "Hide the rail in shorter notes.", "minimumHeadings", {
      one: ["1", { minHeadings: 1 }], four: ["4", { minHeadings: 4 }], six: ["6", { minHeadings: 6 }],
    });
    this.choices(hide, "On phones", "A separate device preference. Presets keep your choice; the settings preview stays available.", "phoneVisibility", {
      hidden: ["Hide on phones", "Keep the small screen clear."],
      landscape: ["Landscape only", "Show the rail when the phone is sideways."],
      always: ["Show on phones", "Show in portrait and landscape."],
    });
    if (s.showAdvanced) this.slider(hide, "Minimum pane width", "For desktops and tablets. Phone visibility is controlled above. Zero shows it at any width.", "hideBelowWidth", 0, 1200, 20, "px");
    else this.normalChoice(hide, "Pane width", "Hide the rail when there is little room.", "paneWidth", {
      any: ["Any width", { hideBelowWidth: 0 }], standard: ["At least 500px", { hideBelowWidth: 500 }], wide: ["At least 700px", { hideBelowWidth: 700 }],
    });
  }

}

/* ================================================================= plugin = */

module.exports = class ScrollspyRailPlugin extends Plugin {
  async onload() {
    this.rails = new Map();
    this.settings = Object.assign(
      {},
      DEFAULTS,
      SESSION_DEFAULTS,
      await this.loadData()
    );

    // Between-marks Fade was removed; keep those configurations usable.
    if (this.settings.labelMoveMotion === "fade") this.settings.labelMoveMotion = "none";

    // Promote the saved v2 when it still matches the new built-in.
    // Keep the saved copy, and leave any later customizations untouched.
    const selected = this.settings.presets.find(preset => preset.id === this.settings.activePreset);
    if (selected?.name === "v2" && PRESET_KEYS.every(key => this.settings[key] === DEFAULTS[key])) {
      this.settings.activePreset = "default";
      await this.saveData(this.settings);
    }

    this.refresh = this.refresh.bind(this);
    this.settingTab = new ScrollspySettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.applyStyles(); // Clear body variables left by an older hot-reloaded version.

    // layout-change covers pane splits, closes, and reading/editing mode switches.
    this.registerEvent(this.app.workspace.on("layout-change", this.refresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.refresh));
    this.registerEvent(this.app.workspace.on("file-open", this.refresh));

    // A cold/mobile startup can finish indexing after layout is ready, without
    // emitting a per-file change for notes that were already cached on disk.
    this.registerEvent(this.app.metadataCache.on("resolved", () => this.refresh(false, true)));

    this.addCommand({
      id: "refresh-rail", name: "Refresh rail and show status",
      callback: () => {
        this.refresh(true);
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const rail = this.rails.get(view);
        if (!rail) { new Notice("Margin Rail: open a Markdown note first."); return; }
        const count = rail.headings.length;
        const width = view.containerEl.clientWidth;
        const reason = rail.visibilityReason() ||
          (!rail.scroller ? "Waiting for the note’s scroll container." : "Rail ready.");
        new Notice(`Margin Rail: ${count} headings, ${width}px pane. ${reason}`, 10000);
      },
    });

    // Rebuild only the panes showing the edited file, so typing a heading
    // updates its own rail without touching the others.
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
    if (!this.settings.macDragHaptics || !Platform?.isMacOS || !Platform?.isDesktopApp) return;
    if (!this.dragHaptics) {
      try {
        // Keep Node imports behind the desktop guard so mobile never loads them.
        this.dragHaptics = new MacDragHaptics(require("child_process").spawn);
      } catch (_) { return; }
    }
    this.dragHaptics.begin(rail);
  }

  tickDragHaptics(rail) {
    if (this.settings.macDragHaptics) this.dragHaptics?.tick(rail);
  }

  endDragHaptics(rail) { this.dragHaptics?.end(rail); }

  installHeadingNavigation() {
    const proto = MarkdownView?.prototype;
    const original = proto?.setEphemeralState;
    if (typeof original !== "function" || typeof resolveSubpath !== "function") return;
    const plugin = this;
    let enabled = true;
    function navigate(state, ...args) {
      if (enabled && state && ["subpath", "line", "scroll"].some(key => Object.prototype.hasOwnProperty.call(state, key))) {
        plugin.rails.get(this)?.cancelHeadingNavigation();
      }
      // Preserve native focus, cursor, history and heading resolution first.
      const result = original.call(this, state, ...args);
      if (!enabled || !["length", "equal"].includes(plugin.settings.trackingMode) ||
          typeof state?.subpath !== "string" || !this.file) return result;
      const target = resolveSubpath(this.app.metadataCache.getFileCache(this.file), state.subpath);
      if (target?.type !== "heading") return result;
      plugin.refresh();
      plugin.rails.get(this)?.queueHeadingNavigation(target.start.line);
      return result;
    }
    proto.setEphemeralState = navigate;
    this.register(() => {
      enabled = false;
      // Other plugins may also wrap this method. Never remove their wrapper.
      if (proto.setEphemeralState === navigate) proto.setEphemeralState = original;
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
    // Paint immediately; persist only once a slider has settled.
    for (const rail of this.rails.values()) rail.updateSettings();
    if (this.settingsTimer) clearTimeout(this.settingsTimer);
    this.settingsTimer = setTimeout(() => this.flushSettings(), 250);
  }

  flushSettings() {
    if (!this.settingsTimer) return this.settingsWrite;
    clearTimeout(this.settingsTimer);
    this.settingsTimer = 0;
    const snapshot = JSON.parse(JSON.stringify(this.settings));
    // Serialize writes so an older save cannot overwrite a newer snapshot.
    this.settingsWrite = (this.settingsWrite || Promise.resolve())
      .then(() => this.saveData(snapshot))
      .catch(() => { new Notice("Margin Rail: could not save settings. Try changing the setting again."); });
    return this.settingsWrite;
  }

  // Scope variables to owned elements, including preview rails and popouts.
  applyStyles(rail) {
    const s = this.settings;
    const active =
      s.colorMode === "custom" ? s.customColor : COLOR_SOURCES[s.colorMode];

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
    };

    const doc = rail?.host.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (doc?.body && !(this.cleanedDocuments ||= new WeakSet()).has(doc)) {
      // Migrate the old global scope without touching unrelated inline styles.
      for (const name of Object.keys(vars)) doc.body.style.removeProperty(name);
      this.cleanedDocuments.add(doc);
    }
    if (!rail) return;
    for (const el of [rail.el, rail.flyout]) {
      for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
    }
  }

  refresh(force = false, checkMetadata = false) {
    const live = new Set();

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
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

/* nosourcemap */
