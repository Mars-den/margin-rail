"use strict";

/*
 * Margin
 *
 * One rail per open markdown pane. Headings come from Obsidian's metadata cache,
 * so the list is always complete even though both editors virtualise their DOM.
 * Scroll position comes from view.currentMode.getScroll(), which reports a line
 * number in BOTH reading mode and live preview -- that is the whole trick, and it
 * is why this needs no per-mode special casing. applyScroll() is its inverse, so
 * clicking a bar jumps in either mode too.
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
 * Appearance is driven by CSS custom properties written onto body by applyStyles().
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
  setIcon,
  Platform,
} = require("obsidian");

// A heading counts as current once its line reaches just past the viewport top.
const LOOKAHEAD_LINES = 1;

/* The built-in v1 preset is the user's finished setup and the fresh-install default. */
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

  // Hover
  hoverStyle: "wave", // "wave" | "pill" | "none"
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
  showPercent: true,
  showPreview: true,
  showBookmarkButton: true,
  previewLength: 120,

  // Behaviour
  minHeadings: 3,
  hideBelowWidth: 500,
  markPassed: true,
  dragToScrub: true,
  hierarchyMode: "nearby", // all | nearby
  idleLevels: 2,
  showSectionProgress: false,
};

// Not part of a preset: these describe the preset system and the settings tab
// itself, so copying them between presets would be meaningless.
const SESSION_DEFAULTS = {
  activePreset: "default",
  presets: [], // [{ id, name, values }]
  showAdvanced: false,
  settingsSection: "tracking",
  previewCollapsed: false,
  phoneVisibility: "hidden", // hidden | landscape | always; independent of presets
};

const PRESET_KEYS = Object.keys(DEFAULTS);

const BUILTIN_PRESETS = [
  { id: "default", name: "v1", description: "Default: slim neutral ticks, a focused wave, section-length tracking, and full labels with bookmarks.", values: DEFAULTS },
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
  { id: "builtin-progress", name: "Progress", description: "Every heading gets an equal scroll share. The current tick fills as you read its section.", values: {
    ...DEFAULTS, trackingMode: "equal", showSectionProgress: true,
    colorMode: "accent", tickWidth: 24, tickHeight: 4, tickRadius: 2,
    showPreview: false,
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
  let start = 0;
  return weights.map((weight) => {
    const range = { start, end: start + weight / total };
    start = range.end;
    return range;
  });
}

function resolveCurrent(lines, totalLines, settings, viewport) {
  if (!lines.length) return -1;
  // No scroll range means there is no meaningful bottom override.
  if (settings.lastAtBottom && viewport.scrollable && viewport.atBottom) return lines.length - 1;
  if (settings.trackingMode === "off") return -1;
  if (settings.trackingMode === "length" || settings.trackingMode === "equal") {
    const ranges = headingAllocations(lines, totalLines, settings.trackingMode);
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
    const range = headingAllocations(lines, totalLines, settings.trackingMode)[current];
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

    this.el = hostEl.createDiv({ cls: "scrollspy-rail" });

    // The label lives outside the rail so the rail never needs a background of
    // its own -- the hover chrome belongs to the label, not to the bars.
    this.flyout = hostEl.createDiv({ cls: "scrollspy-flyout" });
    this.flyoutHead = this.flyout.createDiv({ cls: "scrollspy-flyout-head" });
    this.flyoutTitle = this.flyoutHead.createSpan({ cls: "scrollspy-flyout-title" });
    this.flyoutPercent = this.flyoutHead.createSpan({
      cls: "scrollspy-flyout-percent",
    });
    this.flyoutBookmark = this.flyoutHead.createEl("button", {
      cls: "scrollspy-bookmark-button", type: "button",
    });
    this.flyoutBookmark.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      if (this.bookmarkBusy || this.flyoutIndex < 0) return;
      this.bookmarkBusy = true;
      this.flyoutBookmark.disabled = true;
      try { await this.bookmarkHeading(this.flyoutIndex); }
      catch (error) { new Notice("Could not bookmark this heading. Try again from Obsidian’s Bookmarks."); }
      finally { this.bookmarkBusy = false; this.paintBookmarks(); this.updateBookmarkButton(); }
    });
    this.flyout.addEventListener("pointerenter", () => { this.overFlyout = true; this.cancelHoverFrame(); this.cancelLeave(); });
    this.flyout.addEventListener("pointerleave", () => { this.overFlyout = false; this.scheduleLeave(); });
    this.flyout.addEventListener("focusin", () => this.cancelLeave());
    this.flyout.addEventListener("focusout", (evt) => {
      if (!this.flyout.contains(evt.relatedTarget)) this.scheduleLeave();
    });
    this.flyoutPreview = this.flyout.createDiv({ cls: "scrollspy-flyout-preview" });

    // Every pointer interaction is resolved against the whole rail rather than
    // against individual bars. A 5px bar is a bad target; the band around it is
    // a good one, and nearest-centre makes the gaps between bars live too.
    this.el.addEventListener("click", (evt) => {
      if (this.suppressClick) { this.suppressClick = false; return; }
      this.activate(this.nearestIndex(evt.clientY));
    });
    this.el.addEventListener("pointerenter", (evt) => {
      this.cancelLeave();
      this.lastPointerX = evt.clientX;
      this.lastPointerY = evt.clientY;
      this.measure();
      this.revealAt(evt.clientY);
    });
    this.el.addEventListener("pointermove", (evt) => this.onPointerMove(evt));
    this.el.addEventListener("pointerleave", () => { if (!this.drag) this.scheduleLeave(); });
    this.el.addEventListener("pointerdown", (evt) => this.startDrag(evt));
    this.el.addEventListener("pointerup", (evt) => this.endDrag(evt));
    this.el.addEventListener("pointercancel", (evt) => this.endDrag(evt, true));
    this.el.addEventListener("lostpointercapture", (evt) => {
      if (this.drag) this.endDrag(evt, true);
    });
  }

  destroy() {
    this.cancelLeave();
    if (this.waveFrame) cancelAnimationFrame(this.waveFrame);
    if (this.drag && this.el.hasPointerCapture(this.drag.id)) this.el.releasePointerCapture(this.drag.id);
    this.el.remove();
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
    if (this.overFlyout || this.flyout.contains(this.host.ownerDocument?.activeElement)) return;
    if (this.settings.showBookmarkButton && this.settings.showLabels) {
      // Leave time to cross the gap between a tick and its actionable label.
      this.leaveTimer = setTimeout(() => { this.leaveTimer = 0; this.onLeave(); }, 250);
    } else this.onLeave();
  }

  updateBookmarkButton() {
    const visible = this.settings.showBookmarkButton;
    this.flyoutBookmark.toggleClass("is-hidden", !visible);
    this.flyout.toggleClass("has-bookmark-button", visible);
    if (!visible) return;
    const state = this.bookmarkState(this.flyoutIndex);
    const title = state.saved ? "Remove heading bookmark" : state.available
      ? "Bookmark this heading" : "Enable Obsidian’s Bookmarks core plugin to bookmark headings";
    setIcon(this.flyoutBookmark, state.saved ? "bookmark-check" : "bookmark-plus");
    // aria-label supplies Obsidian’s tooltip; title would add a second native one.
    this.flyoutBookmark.removeAttribute("title");
    this.flyoutBookmark.setAttribute("aria-label", title);
    this.flyoutBookmark.disabled = this.bookmarkBusy || !state.available;
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

  /* ------------------------------------------------------------- pointer -- */

  // Bar centres only move when the rail is rebuilt or the host resizes, never
  // while a bar is growing. Measuring once on entry keeps the per-frame work to
  // arithmetic instead of a layout read per bar.
  measure() {
    const ticks = this.el.children;
    this.centers = [];
    for (let i = 0; i < ticks.length; i++) {
      const box = ticks[i].getBoundingClientRect();
      this.centers.push(box.height ? box.top + box.height / 2 : null);
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
        if (Math.abs(this.pointerY - this.drag.y) > 3) this.drag.moved = true;
        if (this.drag.moved) this.scrubTo(scrubProgress(this.pointerY, this.drag.start, this.drag.end));
      } else this.revealAt(this.pointerY);
      this.setHovered(this.nearestIndex(this.pointerY));
      if (this.settings.hoverStyle === "wave") this.applyWave();
    });
  }

  startDrag(evt) {
    if (!this.drag) this.suppressClick = false;
    if (!this.settings.dragToScrub || evt.button !== 0 || this.drag) return;
    this.suppressClick = false;
    this.revealAt(evt.clientY);
    this.measure();
    const centers = this.centers.filter(value => value != null);
    if (!centers.length) return;
    const box = this.el.getBoundingClientRect();
    this.drag = { id: evt.pointerId, y: evt.clientY, moved: false, index: this.nearestIndex(evt.clientY),
      start: centers.length > 1 ? centers[0] : box.top,
      end: centers.length > 1 ? centers.at(-1) : box.bottom };
    this.el.setPointerCapture(evt.pointerId);
    this.el.addClass("is-dragging");
    evt.preventDefault();
  }

  endDrag(evt, cancelled = false) {
    if (!this.drag || evt.pointerId !== this.drag.id) return;
    const drag = this.drag;
    if (this.waveFrame) { cancelAnimationFrame(this.waveFrame); this.waveFrame = 0; }
    if (Math.abs(evt.clientY - drag.y) > 3) drag.moved = true;
    if (!cancelled && drag.moved) this.scrubTo(scrubProgress(evt.clientY, drag.start, drag.end));
    this.suppressClick = true; // Handle a short press here before folding changes hit targets.
    this.drag = null;
    this.el.removeClass("is-dragging");
    if (this.el.hasPointerCapture(evt.pointerId)) this.el.releasePointerCapture(evt.pointerId);
    this.onLeave();
    if (!cancelled && !drag.moved) this.activate(drag.index);
  }

  updateHierarchy() {
    if (this.drag) return; // Keep the drag track stable as the current heading changes.
    const visible = this.settings.hierarchyMode === "nearby"
      ? hierarchyVisible(this.levels, this.settings.idleLevels, this.activeIndex, this.expandedBranch)
      : this.levels.map(() => true);
    Array.from(this.el.children).forEach((tick, index) => tick.hidden = !visible[index]);
    this.centers = [];
  }

  revealAt(clientY) {
    if (this.drag || this.settings.hierarchyMode !== "nearby") return;
    const index = this.nearestIndex(clientY);
    if (index < 0) return;
    const root = headingBranches(this.levels, this.settings.idleLevels)[index];
    if (root === this.expandedBranch) return;
    const tick = this.el.children[index];
    const before = tick.getBoundingClientRect().top;
    this.expandedBranch = root;
    this.updateHierarchy();
    // Opening a branch must not move the pointed heading out from under the
    // pointer, especially with a middle or bottom anchor.
    const shift = before - tick.getBoundingClientRect().top;
    const offset = Number.parseFloat(this.el.style.getPropertyValue("--ss-reveal-shift")) || 0;
    this.el.style.setProperty("--ss-reveal-shift", String(offset + shift));
    this.el.style.translate = `0 ${offset + shift}px`;
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
      const distance = Math.abs(this.centers[i] - this.pointerY) / reach;

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
    if (!settings.showLabels) return;

    const label = this.labelFor(index);
    const tick = this.el.children[index];
    if (!label || !tick) return;

    this.flyoutIndex = index;
    this.updateBookmarkButton();
    this.flyoutTitle.setText(label.title);

    this.flyoutPercent.setText(settings.showPercent ? `${label.percent}%` : "");
    this.flyoutPercent.toggleClass("is-hidden", !settings.showPercent);

    const preview = settings.showPreview ? label.preview : "";
    this.flyoutPreview.setText(preview);
    this.flyoutPreview.toggleClass("is-hidden", !preview);

    // Vertically centred on the hovered bar, horizontally on the rail's inner
    // side so it opens over the content rather than off the edge.
    const host = this.host.getBoundingClientRect();
    const box = tick.getBoundingClientRect();
    this.flyout.style.top = `${box.top - host.top + box.height / 2}px`;
    this.flyout.toggleClass("is-visible", true);
  }

  hideFlyout() {
    this.cancelLeave();
    this.flyoutIndex = -1;
    this.overFlyout = false;
    this.flyout.toggleClass("is-visible", false);
  }

  /* --------------------------------------------------------------- build -- */

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

    this.el.toggleClass("is-left", settings.side === "left");
    this.el.toggleClass("is-right", settings.side !== "left");
    this.el.toggleClass("anchor-top", settings.anchor === "top");
    this.el.toggleClass("anchor-middle", settings.anchor === "middle");
    this.el.toggleClass("anchor-bottom", settings.anchor === "bottom");
    this.flyout.toggleClass("is-left", settings.side === "left");
    this.flyout.toggleClass("is-right", settings.side !== "left");

    this.el.toggleClass("can-scrub", settings.dragToScrub);
    this.el.toggleClass("has-section-progress", settings.showSectionProgress);
    this.el.toggleClass("hover-wave", settings.hoverStyle === "wave");
    this.el.toggleClass("hover-pill", settings.hoverStyle === "pill");

    // Indent relative to the shallowest heading present, so a note whose top
    // level is H2 still starts flush rather than pre-indented.
    const topLevel = Math.min(6, ...levels);

    levels.forEach((level) => {
      const tick = this.el.createDiv({ cls: "scrollspy-tick" });
      tick.style.setProperty("--ss-depth", String(level - topLevel));
      tick.style.setProperty("--ss-boost", "0px");

      const mark = tick.createDiv({ cls: "scrollspy-mark" });
      if (settings.showLevel && settings.hoverStyle === "pill") {
        mark.createSpan({ cls: "scrollspy-level", text: `H${level}` });
      }
    });
    this.paintBookmarks();
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

    this.onScroll = () => this.syncActive();

    // Reevaluate both pane width and phone orientation when the pane resizes.
    this.resizeObserver = new ResizeObserver(() => {
      this.syncWidth();
      this.syncActive();
    });
    this.resizeObserver.observe(view.containerEl);
  }

  destroy() {
    this.bookmarksPlugin?.off?.("changed", this.onBookmarksChanged);
    this.detachScroller();
    this.resizeObserver.disconnect();
    super.destroy();
  }

  activate(index) {
    const heading = this.headings[index];
    if (!heading) return;
    const mode = this.view.currentMode;
    if (mode && typeof mode.applyScroll === "function") {
      mode.applyScroll(heading.position.start.line);
    }
  }

  scrubTo(progress) {
    const el = this.scroller;
    if (!el) return;
    const previous = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    el.scrollTop = clampProgress(progress) * Math.max(0, el.scrollHeight - el.clientHeight);
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
    }
  }

  detachScroller() {
    if (this.scroller) {
      this.scroller.removeEventListener("scroll", this.onScroll);
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
    const hidden = !!this.visibilityReason();
    this.el.toggleClass("is-cramped", hidden);
    if (hidden) this.onLeave();
    this.centers = [];
  }

  rebuild() {
    const core = bookmarksCore(this.view.app);
    if (core !== this.bookmarksPlugin) {
      this.bookmarksPlugin?.off?.("changed", this.onBookmarksChanged);
      this.bookmarksPlugin = core;
      core?.on?.("changed", this.onBookmarksChanged);
    }
    const settings = this.settings;
    const file = this.view.file;
    const cache = file ? this.view.app.metadataCache.getFileCache(file) : null;
    this.headings = (cache && cache.headings) || [];

    // Cached here rather than read on hover: rebuild already runs on every
    // metadata change, so this stays as fresh as the heading list itself.
    // Always needed now -- the visible-range calculation counts lines too.
    this.lines = this.view.getViewData().split("\n");

    this.render(this.headings.map((heading) => heading.level));
    this.el.toggleClass("is-hidden", this.headings.length < settings.minHeadings);

    this.activeIndex = -1;
    this.activeKey = "";
    this.attachScroller();
    this.syncWidth();
    this.syncActive();
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
    if (!this.headings.length) return;

    const [first, last] = this.visibleRange();

    const el = this.scroller;
    const scrollRange = el ? Math.max(0, el.scrollHeight - el.clientHeight) : 0;
    const viewport = {
      first, last, topLine: this.scrollTopLine(),
      progress: scrollRange > 0 ? el.scrollTop / scrollRange : 0,
      scrollable: scrollRange > 2,
      atBottom: this.atBottom(),
    };
    const lines = this.headings.map((heading) => heading.position.start.line);
    const current = resolveCurrent(lines, this.lines.length, this.settings, viewport);
    const active = resolveActive(lines, this.settings, viewport, current);

    this.paintActive(active, current);
    this.paintProgress(sectionProgress(lines, this.lines.length, this.settings, viewport, current));
  }
}

/* ========================================================= preview rail === */

const SAMPLE = [
  { level: 1, title: "Margin", percent: 0 },
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
    this.host.style.height = `${Math.max(180, height + 64)}px`;
  }

  destroy() {
    this.sceneObserver.disconnect();
    super.destroy();
  }

  activate(index) {
    if (index < 0) return;
    const mode = this.settings.trackingMode;
    const ranges = headingAllocations(SAMPLE.map(item => item.percent), 100, mode);
    this.progress = mode === "equal" || mode === "length"
      ? (ranges[index].start + ranges[index].end) / 2
      : Math.min(1, SAMPLE[index].percent / 75);
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

  scrubTo(progress) {
    this.progress = clampProgress(progress);
    this.syncActive();
    if (this.onProgress) this.onProgress(this.progress);
  }

  syncActive() {
    const lines = SAMPLE.map(item => item.percent);
    const viewport = { first: this.progress * 75, last: this.progress * 75 + 25,
      progress: this.progress, scrollable: true, atBottom: this.progress >= 1 };
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

  // Redraw the sample after any change. Sizes and colours ride CSS variables
  // and update on their own; side, anchor and hover style need the markup back.
  save(render) {
    this.plugin.saveSettings();
    if (this.preview) this.preview.rebuild();
    if (this.updateSimulation) this.updateSimulation();
    if (this.presetDrop) {
      if (this.plugin.settings.activePreset === "custom") this.presetDrop.addOption("custom", "Custom (unsaved)");
      this.presetDrop.setValue(this.plugin.settings.activePreset);
    }
    if (render) this.display();
  }

  // Touching anything a preset captures means you are no longer on that preset.
  // Saying so beats leaving a stale name at the top of the tab.
  edited(key) {
    if (PRESET_KEYS.includes(key)) this.plugin.settings.activePreset = "custom";
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

    // Use one native input: recent Obsidian versions add their own raw-number
    // readout to SliderComponent, which duplicates our formatted units.
    const input = setting.controlEl.createEl("input", { type: "range" });
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.plugin.settings[key]);
    input.setAttribute("aria-label", name);
    input.setAttribute("aria-valuetext", format(this.plugin.settings[key]));
    input.addEventListener("input", () => {
      const value = Number(input.value);
      readout.setText(format(value));
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

  /* ------------------------------------------------------------- display -- */

  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;

    const previousPanel = this.containerEl.querySelector(".scrollspy-panel");
    if (previousPanel && this.displayedSection) {
      this.sectionScroll[this.displayedSection] = this.containerEl.scrollTop;
    }
    this.hide();
    this.presetDrop = null;
    this.sectionEl = null;
    containerEl.empty();
    containerEl.addClass("scrollspy-settings");

    this.renderPreview();
    const nav = containerEl.querySelector(".scrollspy-preview").createDiv({ cls: "scrollspy-nav" });
    nav.setAttribute("role", "tablist");
    const sections = { tracking: "Scroll tracking", appearance: "Rail & colour",
      hover: "Pointer & motion", labels: "Labels", placement: "Placement", presets: "Presets" };
    if (!sections[s.settingsSection]) s.settingsSection = "tracking";
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
    if (s.settingsSection === "tracking") this.renderTracking(s);
    if (s.settingsSection === "appearance") this.renderAppearance(s);
    if (s.settingsSection === "hover") this.renderPointer(s);
    if (s.settingsSection === "labels") this.renderLabels(s);
    if (s.settingsSection === "placement") this.renderPlacement(s);
    if (s.settingsSection === "presets") this.renderPresets(s);
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
    const allocations = simulator.createDiv({ cls: "scrollspy-allocations" });
    allocations.setAttribute("aria-label", "Heading shares of scroll progress");
    const note = simulator.createDiv({ cls: "setting-item-description" });
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
        headingAllocations(SAMPLE.map(item => item.percent), 100, mode).forEach((range, i) => {
          const segment = allocations.createEl("button", { text: String(i + 1), cls: i === current ? "is-current" : "" });
          segment.style.flex = String(range.end - range.start);
          const label = `${SAMPLE[i].title}: ${(range.start * 100).toFixed(1)}–${(range.end * 100).toFixed(1)}%`;
          segment.title = label;
          segment.setAttribute("aria-label", label);
          segment.addEventListener("click", () => this.preview.activate(i));
        });
      }
      note.setText(allocated ? "Each numbered block is a heading’s share. Click one or scrub the slider. Section length uses source lines." :
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
    const row = new Setting(parent).setName(name).setDesc(desc);
    row.settingEl.addClass("scrollspy-choice-setting");
    const group = row.controlEl.createDiv({ cls: "scrollspy-choices" });
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", name);
    for (const [value, [title, detail]] of Object.entries(options)) {
      const button = group.createEl("button", { cls: this.plugin.settings[key] === value ? "is-selected" : "" });
      button.setAttribute("aria-pressed", String(this.plugin.settings[key] === value));
      button.dataset.setting = key;
      button.dataset.value = value;
      button.createEl("strong", { text: title });
      button.createEl("span", { text: detail });
      button.addEventListener("click", () => {
        this.plugin.settings[key] = value;
        this.edited(key);
        this.save(true);
        const replacement = Array.from(this.containerEl.querySelectorAll("button[data-setting]"))
          .find(item => item.dataset.setting === key && item.dataset.value === value);
        if (replacement) replacement.focus({ preventScroll: true });
      });
    }
  }

  renderTracking(s) {
    const box = this.heading("How scrolling chooses a heading", "Choose the rule first, then decide how the rail highlights it.");
    this.choices(box, "Tracking rule", "Try each rule with the slider above.", "trackingMode", {
      position: ["Follow the note", "Current when its heading reaches the top."],
      length: ["By section length", "Longer sections get more scroll time. Every heading gets a turn."],
      equal: ["Equal shares", "Every heading gets the same scroll time."],
      off: ["No tracking", "Keep the rail for navigation without a current marker."],
    });
    this.toggle(box, "Show progress within the section", "The current bar fills as you move through its section. Allocation rules use that heading’s scroll share; Follow the note uses source lines.", "showSectionProgress", false);
    this.toggle(box, "Finish on the last heading", "At the bottom of a scrollable note, make the final heading current. Works with every rule, including no tracking.", "lastAtBottom", false);
    if (s.trackingMode !== "off") this.choices(box, "Highlight", "The chosen heading still determines which sections count as passed.", "activeMode", {
      single: ["Current heading", "Highlight the one chosen by your tracking rule."],
      visible: ["Also on screen", "Highlight visible headings alongside the current one."],
    });
  }


  renderPresets(s) {
    const box = this.heading("Preset");
    const saved = this.currentPreset();

    const options = {};
    for (const preset of BUILTIN_PRESETS) options[preset.id] = preset.name + (preset.id === "default" ? " (default)" : "");
    for (const preset of s.presets) options[preset.id] = preset.name +
      (BUILTIN_PRESETS.some(builtin => builtin.name === preset.name) ? " (saved)" : "");
    const builtin = BUILTIN_PRESETS.find(preset => preset.id === s.activePreset);
    if (s.activePreset === "custom") options.custom = "Custom (unsaved)";

    new Setting(box)
      .setName("Active preset")
      .setDesc(builtin ? builtin.description : "Switching replaces appearance and behaviour across every section.")
      .addDropdown((drop) => {
        this.presetDrop = drop;
        return drop
          .addOptions(options)
          .setValue(s.activePreset)
          .onChange((value) => {
            const preset = BUILTIN_PRESETS.find(item => item.id === value) ||
              s.presets.find(item => item.id === value);
            if (preset) Object.assign(s, DEFAULTS, preset.values);
            s.activePreset = value;
            this.save(true);
          });
      });

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
            this.draftName = "";
            new Notice(`Saved preset “${name}”.`);
            this.save(true);
          })
      );

    new Setting(box).setName("Restore v1 defaults")
      .setDesc("Reset appearance and tracking. Your saved presets stay available.")
      .addButton(button => button.setButtonText("Reset to v1").onClick(() => {
        Object.assign(s, DEFAULTS); s.activePreset = "default"; this.save(true);
      }));

    if (!saved) return;

    new Setting(box)
      .setName(`“${saved.name}”`)
      .setDesc("Overwrite it with the current settings, or remove it.")
      .addButton((button) =>
        button.setButtonText("Update").onClick(() => {
          saved.values = this.capture();
          new Notice(`Updated “${saved.name}”.`);
          this.save(true);
        })
      )
      .addButton((button) =>
        button
          .setButtonText("Delete")
          .setWarning()
          .onClick(() => {
            s.presets = s.presets.filter((item) => item.id !== saved.id);
            s.activePreset = "custom";
            this.save(true);
          })
      );
  }

  renderAppearance(s) {
    const hierarchy = this.heading("Heading hierarchy");
    this.choices(hierarchy, "Which headings to show", "The current heading stays visible in either mode.", "hierarchyMode", {
      all: ["All headings", "Keep every heading visible."],
      nearby: ["Reveal nearby", "Hover a heading to reveal the deeper headings in its branch."],
    });
    if (s.hierarchyMode === "nearby") this.slider(hierarchy, "Levels shown at rest", "Relative to the note’s shallowest heading. Deeper headings appear near your pointer.", "idleLevels", 1, 6, 1);
    const bars = this.heading("Bar shape", "Set the resting shape; each state below can add length and change visibility.");
    this.slider(bars, "Length", "", "tickWidth", 4, 60, 1, "px");
    this.slider(bars, "Thickness", "", "tickHeight", 1, 14, 1, "px");
    this.slider(bars, "Corner radius", "", "tickRadius", 0, 7, 0.5, "px");
    this.slider(bars, "Space between bars", "", "tickGap", 0, 24, 1, "px");
    this.slider(bars, "Indent per heading level", "Shorten nested headings. Zero gives every level the same length.", "levelIndent", 0, 12, 1, "px");
    const states = this.heading("Visibility by state");
    this.slider(states, "Idle", "Headings ahead of you.", "idleOpacity", 0.05, 1, 0.05);
    this.slider(states, "Pointer nearby", "Visibility of the whole rail while you point at it. The pointed bar stays fully visible.", "hoverOpacity", 0.05, 1, 0.05);
    this.slider(states, "Current", "Headings highlighted by your tracking rule.", "activeOpacity", 0.05, 1, 0.05);
    this.slider(states, "Extra length when current", "Added to the resting length and pointer swell.", "activeBoost", 0, 40, 1, "px");
    this.toggle(states, "Distinguish passed headings", "Give headings before the current one their own visibility and length.", "markPassed", true);
    if (s.markPassed) {
      this.slider(states, "Passed visibility", "Lower values fade passed sections.", "passedOpacity", 0.05, 1, 0.05);
      this.slider(states, "Extra length when passed", "Zero keeps their resting length.", "passedBoost", 0, 40, 1, "px");
    }
    const colour = this.heading("Current heading colour");
    this.dropdown(colour, "Colour", "", "colorMode", { neutral: "Neutral text", accent: "Theme accent", custom: "Custom colour" }, true);
    if (s.colorMode === "custom") new Setting(colour).setName("Custom colour").addColorPicker(picker =>
      picker.setValue(s.customColor).onChange(value => {
        s.customColor = value; this.edited("customColor"); this.save(false);
      }));
  }

  renderPointer(s) {
    const box = this.heading("Pointer response");
    this.toggle(box, "Drag to scrub", "Hold and drag along the rail to scroll continuously from top to bottom. A click still jumps to a heading.", "dragToScrub", false);
    this.choices(box, "On hover", "Choose an effect, then tune it below.", "hoverStyle", {
      wave: ["Swell", "Nearby bars grow toward your pointer."],
      pill: ["Pill", "The pointed bar opens into a rounded pill."],
      none: ["Still", "Highlight and labels without growing bars."],
    });
    this.slider(box, "Pointer area", "Invisible padding on each side of the rail. Wider is easier to hit.", "hitbox", 0, 120, 2, "px");
    if (s.hoverStyle !== "none") this.slider(box, "Animation duration", "Lower is snappier; higher moves more slowly.", "animDuration", 0, 800, 20, "ms");
    if (s.hoverStyle === "wave") {
      this.slider(box, "Extra length at the pointer", "", "waveBoost", 0, 120, 1, "px");
      this.slider(box, "Distance of the swell", "How far neighbours react on either side.", "waveReach", 10, 240, 5, "px");
      this.slider(box, "Focus", "Low spreads growth; high concentrates it on the nearest bar.", "waveFocus", 1, 8, 0.5);
    }
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

    this.toggle(box, "Quick bookmark button", "Add or remove a heading bookmark from its hover label. Bookmarked headings have a dot beside their tick. Preview clicks only change the sample.", "showBookmarkButton", false);
    this.slider(box, "Label distance", "Space between the rail and label.", "labelOffset", 0, 40, 1, "px");
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
    if (s.showPreview) {
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
    this.slider(box, "Distance from the edge", "", "edgeOffset", 0, 80, 1, "px");
    this.slider(box, "Nudge up or down", "", "axisOffset", -300, 300, 2, "px");
    const hide = this.heading("When to show the rail");
    this.slider(hide, "Minimum headings", "Notes with fewer headings get no rail.", "minHeadings", 1, 10, 1);
    this.choices(hide, "On phones", "A separate device preference. Presets keep your choice; the settings preview stays available.", "phoneVisibility", {
      hidden: ["Hide on phones", "Keep the small screen clear."],
      landscape: ["Landscape only", "Show the rail when the phone is sideways."],
      always: ["Show on phones", "Show in portrait and landscape."],
    });
    this.slider(hide, "Minimum pane width", "For desktops and tablets. Phone visibility is controlled above. Zero shows it at any width.", "hideBelowWidth", 0, 1200, 20, "px");
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

    // Promote the original saved v1 when it still matches the new built-in.
    // Keep the saved copy, and leave any later customizations untouched.
    const selected = this.settings.presets.find(preset => preset.id === this.settings.activePreset);
    if (selected?.name === "v1" && PRESET_KEYS.every(key => this.settings[key] === DEFAULTS[key])) {
      this.settings.activePreset = "default";
      await this.saveData(this.settings);
    }

    this.refresh = this.refresh.bind(this);
    this.addSettingTab(new ScrollspySettingTab(this.app, this));
    this.applyStyles();

    // layout-change covers pane splits, closes, and reading/editing mode switches.
    this.registerEvent(this.app.workspace.on("layout-change", this.refresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", this.refresh));
    this.registerEvent(this.app.workspace.on("file-open", this.refresh));

    // A cold/mobile startup can finish indexing after layout is ready, without
    // emitting a per-file change for notes that were already cached on disk.
    this.registerEvent(this.app.metadataCache.on("resolved", this.refresh));

    this.addCommand({
      id: "refresh-rail", name: "Refresh rail and show status",
      callback: () => {
        this.refresh();
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const rail = this.rails.get(view);
        if (!rail) { new Notice("Margin: open a Markdown note first."); return; }
        const count = rail.headings.length;
        const width = view.containerEl.clientWidth;
        const reason = rail.visibilityReason() ||
          (!rail.scroller ? "Waiting for the note’s scroll container." : "Rail ready.");
        new Notice(`Margin: ${count} headings, ${width}px pane. ${reason}`, 10000);
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

    this.app.workspace.onLayoutReady(this.refresh);
  }

  onunload() {
    for (const rail of this.rails.values()) rail.destroy();
    this.rails.clear();
  }

  saveSettings() {
    this.saveData(this.settings);
    this.applyStyles();
    this.refresh();
  }

  // Appearance lives in CSS variables on body. Nothing here touches markup, so
  // settings changes cost one style recalculation rather than a rebuild.
  applyStyles() {
    const s = this.settings;
    const style = document.body.style;
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
      "--ss-active-color": active,
    };

    for (const [name, value] of Object.entries(vars)) {
      style.setProperty(name, value);
    }
  }

  refresh() {
    const live = new Set();

    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) continue;
      live.add(view);

      let rail = this.rails.get(view);
      if (!rail) {
        rail = new DocumentRail(this, view);
        this.rails.set(view, rail);
      }
      rail.rebuild();
    }

    for (const [view, rail] of this.rails) {
      if (live.has(view)) continue;
      rail.destroy();
      this.rails.delete(view);
    }
  }
};
