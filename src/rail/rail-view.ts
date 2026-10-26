import type ScrollspyRailPlugin from "../plugin";
import type { Settings } from "../settings/model";
import type { HeadingRange } from "../core/tracking";
import type { DragMotion } from "../core/drag";
import { setIcon, getIcon, Notice } from "obsidian";
import { headingBranches, hierarchyVisible } from "../core/hierarchy";
import {
  scrubProgress,
  sectionDragProgress,
  sampleDragSpeed,
} from "../core/drag";
let nextRailId = 0;
interface RailDrag {
  id: number;
  pointerType: string;
  slop: number;
  y: number;
  moved: boolean;
  index: number;
  startedAt: number;
  strength: number;
  start: number;
  end: number;
  feedbackIndex?: number;
  prepared?: boolean;
  centers?: (number | null)[];
  motion?: DragMotion;
  progress?: number;
}
interface HeadingLabel {
  title: string;
  percent: number | null;
  preview: string;
}
class RailView {
  declare effectiveSettings: Settings | undefined;
  declare simulateTouch: boolean;
  declare forceReducedMotion: boolean;
  declare plugin: ScrollspyRailPlugin;
  declare host: HTMLElement;
  declare levels: number[];
  declare centers: (number | null)[];
  declare activeIndex: number;
  declare activeKey: string;
  declare hoveredIndex: number;
  declare waveFrame: number;
  declare pointerY: number;
  declare expandedBranch: number;
  declare drag: RailDrag | null;
  declare suppressClick: boolean;
  declare sectionFraction: number;
  declare leaveTimer: number;
  declare flyoutIndex: number;
  declare bookmarkBusy: boolean;
  declare overFlyout: boolean;
  declare flyoutPointerFocus: boolean;
  declare keyboardFocused: boolean;
  declare keyboardIndex: number;
  declare railId: string;
  declare ownsHostClass: boolean;
  declare el: HTMLDivElement & { children: HTMLCollectionOf<HTMLDivElement> };
  declare accessibleLabel: HTMLSpanElement;
  declare onKeyboardIntent: (event: KeyboardEvent) => void;
  declare flyout: HTMLDivElement;
  declare flyoutHead: HTMLDivElement;
  declare flyoutTitle: HTMLSpanElement;
  declare flyoutPercent: HTMLSpanElement;
  declare flyoutBookmark: HTMLButtonElement;
  declare flyoutPreview: HTMLDivElement;
  declare lastPointerX: number;
  declare lastPointerY: number;
  declare inputMode: string;
  declare bookmarkIconKey: string;
  declare dense: boolean;
  declare touch: {
    id: number;
    x: number;
    y: number;
    index: number;
    moved: boolean;
  } | null;
  declare dragSnapAnimation: Animation | null;
  declare labelAnimations: Animation[];
  declare markStyle: string;

  constructor(plugin: ScrollspyRailPlugin, hostEl: HTMLElement) {
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
    this.el = hostEl.createDiv({ cls: "scrollspy-rail" }) as typeof this.el;
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
    this.el.setAttribute(
      "aria-description",
      "Arrow keys select a heading, home and end select the first and last. Enter jumps. Escape dismisses. Scroll to browse long outlines.",
    );
    // Focus can arrive after touch release on WebKit. Only a real keyboard
    // Tab should turn a touch-focused list into an expanded keyboard outline.
    this.onKeyboardIntent = (event) => {
      if (event.key === "Tab") this.setInputMode("keyboard");
    };
    hostEl.ownerDocument.addEventListener(
      "keydown",
      this.onKeyboardIntent,
      true,
    );
    this.el.addEventListener("focus", () => {
      if (
        this.touch ||
        this.drag?.pointerType === "touch" ||
        this.inputMode === "touch"
      )
        return;
      this.setInputMode("keyboard");
      this.cancelLeave();
      this.flyoutPointerFocus = false;
      this.keyboardFocused = true;
      this.selectKeyboard(Math.max(0, this.activeIndex));
    });
    this.el.addEventListener("blur", (event) => {
      if (!this.flyout.contains(event.relatedTarget as Node | null))
        this.dismissKeyboard();
    });
    this.el.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.el.addEventListener(
      "wheel",
      (event) => {
        if (this.dense) event.stopPropagation();
        if (this.drag) event.preventDefault();
      },
      { passive: false },
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

    // The label lives outside the rail so the rail never needs a background of
    // its own -- the hover chrome belongs to the label, not to the bars.
    this.flyout = hostEl.createDiv({ cls: "scrollspy-flyout" });
    this.flyout.dataset.ignoreSwipe = "true";
    this.flyoutHead = this.flyout.createDiv({ cls: "scrollspy-flyout-head" });
    this.flyoutTitle = this.flyoutHead.createSpan({
      cls: "scrollspy-flyout-title",
    });
    this.flyoutPercent = this.flyoutHead.createSpan({
      cls: "scrollspy-flyout-percent",
    });
    this.flyoutBookmark = this.flyoutHead.createEl("button", {
      cls: "scrollspy-bookmark-button clickable-icon",
      type: "button",
    });
    this.flyoutBookmark.addEventListener("click", (evt) => {
      evt.stopPropagation();
      void this.toggleHeadingBookmark();
    });
    this.flyout.addEventListener("pointerdown", (evt) => {
      this.flyoutPointerFocus = true;
      // WebKit can blur the rail to the page instead of focusing a clicked
      // button. Keep focus in place so blur cannot dismiss it before click.
      if (
        (evt.target as Element | null)?.closest?.(".scrollspy-bookmark-button")
      )
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
      if (
        !this.flyout.contains(evt.relatedTarget as Node | null) &&
        evt.relatedTarget !== this.el
      ) {
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
      cls: "scrollspy-flyout-preview",
    });

    // Every pointer interaction is resolved against the whole rail rather than
    // against individual bars. A 5px bar is a bad target; the band around it is
    // a good one, and nearest-centre makes the gaps between bars live too.
    this.el.addEventListener("click", (evt) => {
      // Touch activation belongs exclusively to pointerup. Compatibility clicks
      // can arrive after another tap, when a one-click suppression flag is reset.
      if (
        this.inputMode === "touch" ||
        evt.pointerType === "touch" ||
        (
          evt as MouseEvent & {
            sourceCapabilities?: { firesTouchEvents: boolean };
          }
        ).sourceCapabilities?.firesTouchEvents
      )
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
    this.el.addEventListener("pointermove", (evt) => this.onPointerMove(evt));
    this.el.addEventListener("pointerleave", (evt) => {
      if (evt.pointerType !== "touch" && !this.drag) this.scheduleLeave();
    });
    this.el.addEventListener("pointerdown", (evt) => this.startDrag(evt));
    this.el.addEventListener("pointerup", (evt) => this.endDrag(evt));
    this.el.addEventListener("pointercancel", (evt) => this.endDrag(evt, true));
    this.el.addEventListener("lostpointercapture", (evt) => {
      if (this.drag || this.touch) this.endDrag(evt, true);
    });
    this.plugin.applyStyles(this);
  }

  destroy() {
    this.host.ownerDocument.removeEventListener(
      "keydown",
      this.onKeyboardIntent,
      true,
    );
    this.dragSnapAnimation?.cancel();
    this.cancelLabelMotion();
    if (this.ownsHostClass) this.host.classList.remove("margin-rail-host");
    this.cancelLeave();
    if (this.waveFrame) this.win.cancelAnimationFrame(this.waveFrame);
    if (this.drag && this.el.hasPointerCapture(this.drag.id))
      this.el.releasePointerCapture(this.drag.id);
    this.el.remove();
    this.accessibleLabel.remove();
    this.flyout.remove();
  }

  get settings(): Settings {
    return this.effectiveSettings || this.plugin.settings;
  }

  // Subclasses say what a click does and what the label says.
  activate(_index?: number) {}
  scrubTo(_progress?: number) {}
  labelFor(_index?: number): HeadingLabel | null {
    return null;
  }

  bookmarkState(_index?: number) {
    return { available: false, saved: false };
  }
  async bookmarkHeading(_index?: number) {}

  get win() {
    return this.host.ownerDocument.defaultView!;
  }

  async toggleHeadingBookmark() {
    if (this.bookmarkBusy || this.flyoutIndex < 0) return;
    const index = this.flyoutIndex;
    this.bookmarkBusy = true;
    // Native disabled blurs a focused button synchronously. That dismisses
    // the flyout and clears its heading before the bookmark can be written.
    this.updateBookmarkButton();
    try {
      await this.bookmarkHeading(index);
    } catch {
      new Notice(
        "Could not bookmark this heading. Try again from Obsidian’s bookmarks.",
      );
    } finally {
      this.bookmarkBusy = false;
      this.paintBookmarks();
      this.updateBookmarkButton();
    }
  }

  cancelLeave() {
    if (this.leaveTimer) this.win.clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
  }

  cancelHoverFrame() {
    if (this.waveFrame) this.win.cancelAnimationFrame(this.waveFrame);
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
    if (
      this.overFlyout ||
      (!this.flyoutPointerFocus &&
        (this.keyboardFocused ||
          this.flyout.contains(this.host.ownerDocument?.activeElement)))
    )
      return;
    const leave = () =>
      this.flyoutPointerFocus ? this.dismissKeyboard() : this.onLeave();
    if (this.settings.showBookmarkButton && this.settings.showLabels) {
      // Leave time to cross the gap between a tick and its actionable label.
      this.leaveTimer = this.win.setTimeout(() => {
        this.leaveTimer = 0;
        leave();
      }, 250);
    } else leave();
  }

  setInputMode(mode: string) {
    if (this.simulateTouch) mode = "touch";
    if (this.inputMode === mode) return;
    this.inputMode = mode;
    if (this.flyoutBookmark) this.updateBookmarkButton();
  }

  updateBookmarkButton() {
    // Touch labels describe the drag target and close on release. Pointer and
    // keyboard labels stay actionable, including on hybrid tablets.
    const visible =
      this.settings.showBookmarkButton && this.inputMode !== "touch";
    this.flyoutBookmark.toggleClass("is-hidden", !visible);
    this.flyout.toggleClass("has-bookmark-button", visible);
    if (!visible) return;
    const state = this.bookmarkState(this.flyoutIndex);
    const title = state.saved
      ? "Remove heading bookmark"
      : state.available
        ? "Bookmark this heading"
        : "Enable Obsidian’s Bookmarks core plugin to bookmark headings";
    // Mobile and desktop Obsidian can ship different Lucide icon versions.
    const candidates = state.saved
      ? ["bookmark-check", "bookmark-minus", "bookmark"]
      : ["bookmark-plus", "bookmark"];
    const icon =
      typeof getIcon === "function"
        ? candidates.find((name) => getIcon(name))
        : candidates[0];
    const iconKey = `${icon || "bookmark"}:${state.saved ? "saved" : "unsaved"}`;
    if (
      this.bookmarkIconKey !== iconKey ||
      !this.flyoutBookmark.querySelector?.("svg")
    ) {
      this.flyoutBookmark.replaceChildren?.();
      setIcon(this.flyoutBookmark, icon || "bookmark");
      // Keep the action visible even when the installed icon registry lacks all
      // variants. This fixed outline uses the same stroke and size as Lucide.
      if (
        !this.flyoutBookmark.querySelector?.("svg") &&
        typeof this.flyoutBookmark.createSvg === "function"
      ) {
        const svg = this.flyoutBookmark.createSvg("svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("aria-hidden", "true");
        const outline = svg.createSvg("path");
        outline.setAttribute(
          "d",
          "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
        );
        svg.append(outline);
        const symbol = svg.createSvg("path");
        symbol.setAttribute(
          "d",
          state.saved ? "m9 10 2 2 4-4" : "M12 7v6m-3-3h6",
        );
        svg.append(symbol);
        this.flyoutBookmark.replaceChildren(svg);
      }
      this.bookmarkIconKey = iconKey;
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
    this.el.setCssStyles({ translate: "" });
    this.el.setCssProps({ "--ss-reveal-shift": "" });
    this.updateHierarchy();
  }

  // A bounded scroll strip preserves target sizes instead of compressing hundreds
  // of headings into a few pixels. Reserve horizontal room for expanded marks.
  fitPane() {
    if (!this.host) return;
    const s = this.settings;
    const height =
      this.host.clientHeight || this.host.getBoundingClientRect().height;
    const travel = Math.max(0, height - 56);
    const offset =
      s.anchor === "top"
        ? Math.max(0, Math.min(s.axisOffset, travel))
        : s.anchor === "bottom"
          ? Math.max(-travel, Math.min(s.axisOffset, 0))
          : Math.max(-travel / 2, Math.min(s.axisOffset, travel / 2));
    const used =
      s.anchor === "middle" ? 2 * Math.abs(offset) : Math.abs(offset);
    const available = Math.max(0, height - 32 - used);
    const count = Array.from(this.el.children).filter(
      (tick) => !tick.hidden,
    ).length;
    const swell = ["pill", "dot"].includes(s.hoverStyle)
      ? Math.max(0, s.expandHeight - s.tickHeight)
      : 0;
    const natural =
      20 +
      swell +
      count * (s.tickHeight + 6) +
      Math.max(0, count - 1) * Math.max(0, s.tickGap - 6);
    this.dense = natural > available;
    this.el.toggleClass("is-dense", this.dense);
    this.el.setCssProps({ "--ss-pane-height": `${available}px` });
    this.el.setCssProps({ "--ss-axis-offset": `${offset}px` });
    if (this.dense) {
      this.el.setCssStyles({ translate: "" });
      this.el.setCssProps({ "--ss-reveal-shift": "" });
    }
    this.centers = [];
  }

  selectKeyboard(index: number) {
    if (!this.levels.length) return;
    this.keyboardIndex = Math.max(0, Math.min(index, this.levels.length - 1));
    this.updateHierarchy(); // All nested headings are available while focused.
    const tick = this.el.children[this.keyboardIndex];
    this.el.setAttribute("aria-activedescendant", tick.id);
    Array.from(this.el.children).forEach((item, i) =>
      item.setAttribute("aria-selected", String(i === this.keyboardIndex)),
    );
    // Scroll only the outline, never its note or workspace ancestors.
    const box = tick.getBoundingClientRect(),
      rail = this.el.getBoundingClientRect();
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
    Array.from(this.el.children).forEach((tick) =>
      tick.setAttribute("aria-selected", "false"),
    );
    this.onLeave();
  }

  onKeyDown(event: KeyboardEvent) {
    this.setInputMode("keyboard");
    const key = event.key;
    if (
      !["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"].includes(key)
    )
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
    const start =
      this.keyboardIndex >= 0
        ? this.keyboardIndex
        : Math.max(0, this.activeIndex);
    this.selectKeyboard(
      key === "Home"
        ? 0
        : key === "End"
          ? this.levels.length - 1
          : start + (key === "ArrowDown" ? 1 : -1),
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
        box.height &&
          (!rail ||
            (box.top + box.height / 2 >= rail.top &&
              box.top + box.height / 2 <= rail.bottom))
          ? box.top + box.height / 2
          : null,
      );
    }
  }

  nearestIndex(clientY: number) {
    if (this.centers.length !== this.el.children.length) this.measure();
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < this.centers.length; i++) {
      const center = this.centers[i];
      if (center == null) continue;
      const distance = Math.abs(center - clientY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best;
  }

  onPointerMove(evt: PointerEvent) {
    if (evt.pointerType) this.setInputMode(evt.pointerType);
    if (evt.pointerType === "touch" && !this.drag) {
      if (
        this.touch &&
        this.touch.id === evt.pointerId &&
        Math.hypot(evt.clientX - this.touch.x, evt.clientY - this.touch.y) > 8
      )
        this.touch.moved = true;
      return;
    }
    if (this.drag && evt.pointerId !== this.drag.id) return;
    const dx = evt.clientX - this.lastPointerX;
    const dy = evt.clientY - this.lastPointerY;
    this.lastPointerX = evt.clientX;
    this.lastPointerY = evt.clientY;
    // Keep the heading stable while crossing sideways to its bookmark button.
    const towardLabel = this.settings.side === "left" ? dx > 0 : dx < 0;
    if (
      !this.drag &&
      this.settings.showBookmarkButton &&
      this.flyoutIndex >= 0 &&
      towardLabel &&
      Math.abs(dx) > Math.abs(dy)
    ) {
      this.cancelHoverFrame();
      return;
    }
    this.pointerY = evt.clientY;
    if (this.waveFrame) return;
    this.waveFrame = this.win.requestAnimationFrame(() => {
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

  startDrag(evt: PointerEvent) {
    this.setInputMode(evt.pointerType || "mouse");
    if (evt.pointerType !== "touch") this.touch = null;
    if (
      evt.pointerType === "touch" &&
      this.touch &&
      evt.pointerId !== this.touch.id
    ) {
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
      this.touch = {
        id: evt.pointerId,
        x: evt.clientX,
        y: evt.clientY,
        index: this.nearestIndex(evt.clientY),
        moved: false,
      };
    }
    // Let a finger browse a dense outline using native scrolling; mouse and
    // pen drags still scrub the entire note across the bounded track.
    if (
      !this.settings.dragToScrub ||
      evt.button !== 0 ||
      this.drag ||
      (this.dense && evt.pointerType === "touch")
    )
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
      end:
        !this.dense && centers.length > 1
          ? centers[centers.length - 1]
          : box.bottom,
    };
    this.touch = null;
    this.drag.feedbackIndex = this.dragSectionIndex();
    this.el.setPointerCapture(evt.pointerId);
    this.el.addClass("is-dragging");
    evt.preventDefault();
  }

  dragNow() {
    return (
      this.host?.ownerDocument.defaultView?.performance?.now?.() ?? Date.now()
    );
  }

  dragRanges(): HeadingRange[] | null {
    return null;
  }

  prepareDragTrack() {
    if (!this.drag || this.drag.prepared) return;
    this.drag.prepared = true;
    this.cancelLabelMotion();
    this.flyout?.addClass("is-scrubbing");
    const selected = this.el.children[this.drag.index];
    const before = selected?.getBoundingClientRect();
    // Folded headings must have a mark while they can become a drag target.
    Array.from(this.el.children).forEach((tick) => (tick.hidden = false));
    this.fitPane();
    if (before && selected) {
      const after = selected.getBoundingClientRect();
      if (this.dense) this.el.scrollTop += after.top - before.top;
      else {
        const existing =
          Number(this.el.style.getPropertyValue("--ss-reveal-shift")) || 0;
        let shift = existing + before.top - after.top;
        if (this.host) {
          const host = this.host.getBoundingClientRect(),
            box = this.el.getBoundingClientRect();
          shift = Math.max(
            existing + host.top + 16 - box.top,
            Math.min(shift, existing + host.bottom - 16 - box.bottom),
          );
        }
        this.el.setCssProps({ "--ss-reveal-shift": String(shift) });
        this.el.setCssStyles({ translate: `0 ${shift}px` });
      }
    }
    this.measure();
    const centers = this.centers.filter((center) => center != null),
      box = this.el.getBoundingClientRect();
    this.drag.start = !this.dense && centers.length > 1 ? centers[0] : box.top;
    this.drag.end =
      !this.dense && centers.length > 1
        ? centers[centers.length - 1]
        : box.bottom;
    this.drag.centers = [...this.centers];
    this.drag.motion = {
      position:
        scrubProgress(this.drag.y, this.drag.start, this.drag.end) *
        Math.max(1, this.levels.length - 1),
      time: this.drag.startedAt,
      speed: 0,
    };
  }

  dragProgressAt(clientY: number) {
    this.pointerY = clientY;
    this.prepareDragTrack();
    if (!this.drag?.motion || !this.drag.centers) return 0;
    const position =
      scrubProgress(clientY, this.drag.start, this.drag.end) *
      Math.max(1, this.levels.length - 1);
    const direction = Math.sign(position - this.drag.motion.position);
    this.drag.strength = sampleDragSpeed(
      this.drag.motion,
      position,
      this.dragNow(),
    );
    let progress = this.dense
      ? scrubProgress(clientY, this.drag.start, this.drag.end)
      : sectionDragProgress(
          clientY,
          this.drag.centers,
          this.dragRanges(),
          this.drag.start,
          this.drag.end,
          this.drag.strength,
        );
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

  updateDragFeedback(index: number, crossed = false) {
    if (index < 0 || !this.el?.children[index]) return;
    const tick = this.el.children[index];
    if (this.dense && this.drag?.moved) {
      const box = this.el.getBoundingClientRect(),
        mark = tick.getBoundingClientRect();
      const target = Math.max(
        box.top + 12,
        Math.min(box.bottom - 12, this.pointerY),
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
      const reduced = this.host?.ownerDocument.defaultView?.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const strength = this.drag?.strength ?? 1;
      if (!reduced && strength > 0.2 && mark?.animate) {
        this.dragSnapAnimation = mark.animate(
          [
            {
              transform: `scale(${1 + 0.16 * strength}, ${1 + 0.3 * strength})`,
            },
            { transform: "scale(1)" },
          ],
          { duration: 140, easing: "ease-out" },
        );
      }
    }
  }

  dragSectionIndex() {
    return this.activeIndex;
  }

  scrubDragTo(progress: number) {
    this.scrubTo(progress);
    const index = this.dragSectionIndex();
    const crossed =
      this.drag !== null &&
      index >= 0 &&
      (this.drag.feedbackIndex ?? -1) >= 0 &&
      index !== this.drag.feedbackIndex;
    if (this.drag) {
      this.drag.feedbackIndex = index;
      this.updateDragFeedback(index, crossed);
    }
  }

  endDrag(evt: PointerEvent, cancelled = false) {
    if (this.touch && this.touch.id === evt.pointerId) {
      const touch = this.touch;
      this.touch = null;
      this.suppressClick = true;
      if (
        !cancelled &&
        !touch.moved &&
        Math.hypot(evt.clientX - touch.x, evt.clientY - touch.y) <= 8
      )
        this.activate(touch.index);
      this.onLeave();
      return;
    }
    if (!this.drag || evt.pointerId !== this.drag.id) return;
    const drag = this.drag;
    if (this.waveFrame) {
      this.win.cancelAnimationFrame(this.waveFrame);
      this.waveFrame = 0;
    }
    if (Math.abs(evt.clientY - drag.y) > (drag.slop ?? 3)) drag.moved = true;
    if (!cancelled && drag.moved)
      this.scrubDragTo(this.dragProgressAt(evt.clientY));
    this.suppressClick = true; // Handle a short press here before folding changes hit targets.
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
    if (this.drag || this.touch) return; // Keep pressed targets stable as the current heading changes.
    const visible =
      !this.keyboardFocused && this.settings.hierarchyMode === "nearby"
        ? hierarchyVisible(
            this.levels,
            this.settings.idleLevels,
            this.activeIndex,
            this.expandedBranch,
          )
        : this.levels.map(() => true);
    Array.from(this.el.children).forEach(
      (tick, index) => (tick.hidden = !visible[index]),
    );
    this.fitPane();
    this.centers = [];
  }

  revealAt(clientY: number) {
    if (
      this.drag ||
      this.touch ||
      this.keyboardFocused ||
      this.settings.hierarchyMode !== "nearby"
    )
      return;
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
    this.el.setCssStyles({ translate: "" });
    this.el.setCssProps({ "--ss-reveal-shift": "" });
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
        const host = this.host.getBoundingClientRect(),
          rail = this.el.getBoundingClientRect();
        shift = Math.max(
          host.top + 16 - rail.top,
          Math.min(shift, host.bottom - 16 - rail.bottom),
        );
      }
      this.el.setCssProps({ "--ss-reveal-shift": String(shift) });
      this.el.setCssStyles({ translate: `0 ${shift}px` });
    }
    this.measure();
  }

  paintProgress(fraction: number) {
    this.sectionFraction = fraction;
    Array.from(this.el.children).forEach((tick, index) => {
      tick.classList.toggle("is-current", index === this.activeIndex);
      tick.setCssProps({
        "--ss-section-progress": `${(fraction * 100).toFixed(2)}%`,
      });
    });
  }

  // Hover is a class the plugin assigns, not CSS :hover, because the bar being
  // pointed at is whichever is nearest -- not necessarily one under the cursor.
  setHovered(index: number) {
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
      const center = this.centers[i];
      if (center == null) continue;
      const waveY = this.drag?.moved
        ? (this.centers[this.dragSectionIndex()] ?? this.pointerY)
        : this.pointerY;
      const distance = Math.abs(center - waveY) / reach;

      // Raised cosine, then sharpened by the focus exponent. Focus 1 is a broad
      // swell across neighbours; higher values pull the growth onto the bar
      // under the cursor and leave the rest nearly flat. Either way it reaches
      // exactly zero at the configured distance, so nothing snaps.
      const falloff =
        distance >= 1
          ? 0
          : Math.cos((distance * Math.PI) / 2) ** (2 * waveFocus);

      ticks[i].setCssProps({
        "--ss-boost": `${(waveBoost * falloff).toFixed(2)}px`,
      });
    }
  }

  clearWave() {
    const ticks = this.el.children;
    for (let i = 0; i < ticks.length; i++) {
      ticks[i].setCssProps({ "--ss-boost": "0px" });
    }
  }

  /* --------------------------------------------------------------- label -- */

  showFlyout(index: number) {
    const settings = this.settings;
    if (!settings.showLabels && !this.keyboardFocused) return;

    const label = this.labelFor(index);
    const tick = this.el.children[index];
    if (!label || !tick) return;

    const switching =
      !this.drag?.moved &&
      settings.labelMoveMotion === "slide" &&
      this.flyoutIndex >= 0 &&
      this.flyoutIndex !== index &&
      this.flyout.classList.contains("is-visible");
    // Retarget from the on-screen position when moving quickly between marks.
    const fromTop = switching
      ? this.flyout.ownerDocument.defaultView!.getComputedStyle(this.flyout).top
      : null;
    if (switching) this.cancelLabelMotion();
    this.flyoutIndex = index;
    this.updateBookmarkButton();
    this.flyoutTitle.setText(label.title);

    this.flyoutPercent.setText(
      settings.showPercent && label.percent != null ? `${label.percent}%` : "",
    );
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
    this.flyout.setCssStyles({ top });
    const reduced =
      this.forceReducedMotion ||
      this.flyout.ownerDocument.defaultView?.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
    if (
      switching &&
      !reduced &&
      settings.labelMoveDuration > 0 &&
      this.flyout.animate
    ) {
      const timing = {
        duration: settings.labelMoveDuration,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      };
      this.labelAnimations = [
        this.flyout.animate([{ top: fromTop ?? top }, { top }], timing),
      ];
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
      ? this.flyout.ownerDocument.defaultView!.getComputedStyle(this.flyout).top
      : null;
    this.cancelLabelMotion();
    if (top) this.flyout.setCssStyles({ top });
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
    if (
      this.markStyle !==
      `${this.settings.showLevel}|${this.settings.hoverStyle}`
    ) {
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
  render(levels: number[]) {
    const settings = this.settings;
    this.levels = levels;

    this.el.empty();
    this.centers = [];
    this.hoveredIndex = -1;
    this.expandedBranch = -1;
    this.el.setCssStyles({ translate: "" });
    this.el.setCssProps({ "--ss-reveal-shift": "" });
    this.hideFlyout();

    this.updatePresentation();
    this.markStyle = `${settings.showLevel}|${settings.hoverStyle}`;

    // Indent relative to the shallowest heading present, so a note whose top
    // level is H2 still starts flush rather than pre-indented.
    const topLevel = Math.min(6, ...levels);

    levels.forEach((level, index) => {
      const tick = this.el.createDiv({ cls: "scrollspy-tick" });
      tick.dataset.level = String(level);
      tick.id = `${this.railId}-heading-${index}`;
      tick.setAttribute("role", "option");
      tick.setAttribute(
        "aria-label",
        `Heading level ${level}: ${this.labelFor(index)?.title || `Heading ${index + 1}`}`,
      );
      tick.setAttribute("aria-selected", "false");
      tick.setCssProps({ "--ss-depth": String(level - topLevel) });
      tick.setCssProps({ "--ss-boost": "0px" });

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
  paintActive(active: ReadonlySet<number>, current: number) {
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
        markPassed && !isActive && i < current,
      );
    }
    if (this.drag?.moved && current >= 0 && current !== this.hoveredIndex)
      this.updateDragFeedback(current);
  }
}

export { RailView };
