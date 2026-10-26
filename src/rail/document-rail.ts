import { MarkdownView, Notice, Platform } from "obsidian";
import { RailView } from "./rail-view";
import { railVisibilityReason } from "../settings/model";
import {
  headingAllocations,
  headingLandingStarts,
  physicalHeadingRanges,
  headingNavigationProgress,
  resolveCurrent,
  resolveActive,
  sectionProgress,
  clampProgress,
} from "../core/tracking";
import {
  headingSubpath,
  findHeadingBookmark,
  bookmarksCore,
} from "../integrations/bookmarks";
const LOOKAHEAD_LINES = 1;
class DocumentRail extends RailView {
  declare view: any;
  declare headings: any[];
  declare lines: any[];
  declare scroller: any;
  declare bookmarksPlugin: any;
  declare onBookmarksChanged: () => void;
  declare scrollFrame: number;
  declare onScroll: () => void;
  declare onNavigationInput: () => void;
  declare resizeObserver: ResizeObserver;
  declare sourceEpoch: any;
  declare navigationHighlightTimer: NodeJS.Timeout | null;
  declare navigationHighlight: any;
  declare navigationHighlightScrollTop: any;
  declare pendingNavigation: {
    line: any;
    file: any;
    mode: any;
    ready: boolean;
    feedback: boolean;
  } | null;
  declare navigationFrame: any;
  declare navigationWindow: any;
  declare scrollWindow: any;
  declare file: any;
  declare filePath: any;
  declare cachedMetadataKey: string;
  declare sourceReady: boolean;

  constructor(plugin: any, view: any) {
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
      if (
        this.navigationHighlight &&
        Math.abs(this.scroller.scrollTop - this.navigationHighlightScrollTop) >
          1
      )
        this.clearNavigationHighlight();
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

  activate(index: any) {
    this.cancelHeadingNavigation();
    const heading = this.headings[index];
    if (!heading) return;
    const mode = this.view.currentMode;
    const allocated = ["length", "equal"].includes(this.settings.trackingMode);
    // Already measured headings can go straight to their final destination.
    // A native reveal followed by our correction causes a visible double jump.
    const bounds = allocated && this.headingBounds(index);
    if (
      bounds &&
      bounds.measured !== false &&
      (this.settings.trackingMode !== "length" || this.headingLandingStarts())
    ) {
      this.finishHeadingNavigation(index, true);
      return;
    }
    if (mode && typeof mode.applyScroll === "function") {
      mode.applyScroll(heading.position.start.line);
      if (
        allocated ||
        this.settings.placeCursorOnNavigate ||
        this.settings.highlightOnNavigate
      ) {
        this.queueHeadingNavigation(heading.position.start.line, true);
      }
    }
  }

  finishHeadingNavigation(index: any, feedback: any) {
    const mode = this.view.currentMode;
    const line = this.headings[index].position.start.line;
    if (
      feedback &&
      this.settings.placeCursorOnNavigate &&
      mode?.type !== "preview" &&
      mode !== this.view.previewMode
    ) {
      const cm = mode?.cm;
      if (cm?.state?.doc && typeof cm.dispatch === "function") {
        const position = cm.state.doc.line(
          Math.min(cm.state.doc.lines, line + 1),
        ).from;
        // Selection without scrollIntoView preserves the section landing rule.
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

  showNavigationHighlight(index: any) {
    this.clearNavigationHighlight();
    const bounds = this.headingBounds(index),
      el = this.scroller;
    if (!bounds || !el) return;
    const frame = el.getBoundingClientRect();
    const top = Math.max(
      frame.top,
      frame.top + el.clientTop + bounds.top - el.scrollTop,
    );
    const bottom = Math.min(
      frame.bottom,
      frame.top + el.clientTop + bounds.bottom - el.scrollTop,
    );
    if (bottom <= top) return;
    const highlight = (this.navigationHighlight =
      el.ownerDocument.createElement("div"));
    highlight.className = "scrollspy-heading-flash";
    highlight.setAttribute("aria-hidden", "true");
    Object.assign(highlight.style, {
      top: `${top}px`,
      left: `${frame.left + el.clientLeft}px`,
      width: `${el.clientWidth}px`,
      height: `${bottom - top}px`,
    });
    el.ownerDocument.body.appendChild(highlight);
    this.navigationHighlightScrollTop = el.scrollTop;
    this.navigationHighlightTimer = setTimeout(
      () => this.clearNavigationHighlight(),
      1400,
    );
  }

  cancelHeadingNavigation() {
    this.pendingNavigation = null;
    if (this.navigationFrame)
      this.navigationWindow.cancelAnimationFrame(this.navigationFrame);
    this.navigationFrame = 0;
  }

  queueHeadingNavigation(line: any, feedback: any = false) {
    this.cancelHeadingNavigation();
    const request = (this.pendingNavigation = {
      line,
      file: this.view.file,
      mode: this.view.currentMode,
      ready: false as boolean,
      feedback,
    });
    const win = (this.navigationWindow = this.host.ownerDocument.defaultView);
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
    if (typeof renderer?.onRendered === "function")
      renderer.onRendered(schedule);
    else schedule();
  }

  applyPendingNavigation() {
    const request = this.pendingNavigation;
    if (!request?.ready) return false;
    if (
      request.file !== this.view.file ||
      request.mode !== this.view.currentMode
    ) {
      this.pendingNavigation = null;
      return false;
    }
    if (!this.sourceReady) return false; // refreshSource will retry after cachedRead.
    this.pendingNavigation = null;
    this.attachScroller();
    const index = this.headings.findIndex(
      (heading: any) => heading.position.start.line === request.line,
    );
    if (index < 0) return false;
    this.finishHeadingNavigation(index, request.feedback);
    return true;
  }

  headingBounds(index: any) {
    const heading = this.headings[index];
    const line = heading.position.start.line;
    const mode = this.view.currentMode;
    const cm = mode?.cm;
    if (cm?.state?.doc && typeof cm.lineBlockAt === "function") {
      const position = cm.state.doc.line(
        Math.min(cm.state.doc.lines, line + 1),
      ).from;
      const block = cm.lineBlockAt(position);
      const top = block.top + (cm.contentDOM?.offsetTop || 0);
      return { top, bottom: top + block.height, measured: true };
    }
    for (const section of mode?.renderer?.sections || []) {
      if (section.lineStart > line || section.lineEnd < line) continue;
      const nodes = Array.from(
        section.el?.querySelectorAll?.("h1,h2,h3,h4,h5,h6") || [],
      );
      const node =
        section.lineStart === line
          ? nodes[0]
          : nodes.find(
              (node: any) =>
                node.getAttribute("data-heading") === heading.heading ||
                node.textContent.trim() === heading.heading,
            );
      if (!node) continue;
      const box = (node as HTMLElement).getBoundingClientRect();
      if (!box.height) continue;
      const offset =
        this.scroller.scrollTop -
        this.scroller.getBoundingClientRect().top -
        this.scroller.clientTop;
      return {
        top: box.top + offset,
        bottom: box.bottom + offset,
        measured: true,
      };
    }
    // Unmounted reading sections retain a layout box. Estimate within that
    // section until its actual heading DOM becomes available.
    for (const section of mode?.renderer?.sections || []) {
      if (section.lineStart > line || section.lineEnd < line || !section.el)
        continue;
      const fraction =
        (line - section.lineStart) /
        Math.max(1, section.lineEnd - section.lineStart + 1);
      const renderer = mode.renderer;
      if (
        typeof renderer.getSectionTop === "function" &&
        Number.isFinite(section.height)
      ) {
        const offset = renderer.getSectionTop(section);
        if (offset >= 0) {
          const top =
            offset + (renderer.topSpace || 0) + fraction * section.height;
          return { top, bottom: top, measured: false };
        }
      }
      const box = section.el.getBoundingClientRect();
      if (!box.height) continue;
      const top =
        box.top +
        this.scroller.scrollTop -
        this.scroller.getBoundingClientRect().top -
        this.scroller.clientTop +
        fraction * box.height;
      return { top, bottom: top, measured: false };
    }
    return null;
  }

  headingLandingStarts() {
    const el = this.scroller;
    if (!el) return null;
    const bounds = this.headings.map((_: any, index: any) =>
      this.headingBounds(index),
    );
    const tops = bounds.map((bounds: any) => bounds?.top);
    // Missing virtualized headings use their renderer section's layout estimate
    // in headingBounds; if unavailable, keep native source-position tracking.
    if (tops.some((top: any) => !Number.isFinite(top))) return null;
    return headingLandingStarts(
      tops,
      Math.max(0, el.scrollHeight - el.clientHeight),
      el.clientHeight,
      bounds.map((bounds: any) => bounds.bottom),
    );
  }

  landAtHeading(index: any) {
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
      this.headings.map((item: any) => item.position.start.line),
      this.lines.length,
      this.settings.trackingMode,
      index,
      {
        scrollRange: Math.max(0, el.scrollHeight - el.clientHeight),
        viewportHeight: el.clientHeight,
        headingTop: bounds?.top,
        headingBottom: bounds?.bottom,
        preferredTop: el.scrollTop,
        lastAtBottom: this.settings.lastAtBottom,
      },
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
        this.headings.map((heading: any) => heading.position.start.line),
        this.lines.length,
        "equal",
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
      this.headings.map((heading: any) => heading.position.start.line),
      this.lines.length,
      {
        ...this.settings,
        trackingMode: starts ? "length" : "position",
        lastAtBottom: false,
      },
      {
        headingStarts: starts,
        first: this.scrollTopLine(),
        progress: range ? el.scrollTop / range : 0,
      },
    );
  }

  scrubTo(progress: any, alignToPixel: any = false) {
    const el = this.scroller;
    if (!el) return;
    const previous = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    const top =
      clampProgress(progress) * Math.max(0, el.scrollHeight - el.clientHeight);
    // A normalized integer landing can multiply back to e.g. 17.999999999.
    // WebKit floors that to 17, leaving the previous mark active.
    el.scrollTop = alignToPixel ? Math.round(top) : top;
    el.style.scrollBehavior = previous;
    this.syncActive();
  }

  labelFor(index: any) {
    const heading = this.headings[index];
    if (!heading) return null;
    return {
      title: heading.heading,
      percent: this.percentAt(index),
      preview: this.previewAt(index),
    };
  }

  bookmarkState(index: any) {
    const core = bookmarksCore(this.view.app);
    const file = this.view.file;
    const heading = this.headings[index];
    return {
      available: !!(core && file && heading),
      saved: !!(
        core &&
        file &&
        heading &&
        findHeadingBookmark(
          core.items,
          file.path,
          headingSubpath(heading.heading),
        )
      ),
    };
  }

  async bookmarkHeading(index: any) {
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
      ctime: Date.now(),
    });
  }

  // How far into the document this heading sits, by line. Lines rather than
  // pixels because that is the unit the rest of the plugin already works in,
  // and it does not change with window width or folded sections.
  percentAt(index: any) {
    if ((this.headings.at(-1)?.position.start.line ?? -1) >= this.lines.length)
      return null;
    const span = Math.max(1, this.lines.length - 1);
    const line = this.headings[index].position.start.line;
    return Math.min(100, Math.round((line / span) * 100));
  }

  // The body between this heading and the next, flattened to one line. Markdown
  // is stripped roughly -- this is a glance, not a render.
  previewAt(index: any) {
    if (!this.settings.showPreview) return "";

    const start = this.headings[index].position.start.line + 1;
    const next = this.headings[index + 1];
    const end = next ? next.position.start.line : this.lines.length;

    const text = this.lines
      .slice(start, end)
      .map((line: any) =>
        line
          .replace(/^\s*>\s?/, "")
          .replace(/^\s*[-*+]\s+/, "")
          .replace(/^\s*\d+\.\s+/, "")
          .replace(/^\s*\|/, ""),
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
    const reading =
      (mode && mode === this.view.previewMode) ||
      mode?.type === "preview" ||
      this.view.getMode?.() === "preview";
    // Both mode containers can remain in the pane. Document-order selection
    // can bind to the hidden editor, whose scrollTop never changes while reading.
    const next = reading
      ? mode?.renderer?.previewEl ||
        this.view.containerEl.querySelector(
          ".markdown-reading-view .markdown-preview-view",
        )
      : mode?.cm?.scrollDOM ||
        this.view.editor?.cm?.scrollDOM ||
        this.view.containerEl.querySelector(
          ".markdown-source-view .cm-scroller",
        );
    if (next === this.scroller) return;
    this.detachScroller();
    this.scroller = next;
    if (this.scroller) {
      this.scroller.addEventListener("scroll", this.onScroll, {
        passive: true,
      });
      for (const event of ["wheel", "touchstart", "pointerdown", "keydown"]) {
        this.scroller.addEventListener(event, this.onNavigationInput, {
          passive: true,
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
    return JSON.stringify(
      this.view.file
        ? this.view.app.metadataCache.getFileCache(this.view.file)?.headings ||
            []
        : [],
    );
  }

  refresh(force: any = false, checkMetadata: any = false) {
    this.syncBookmarks();
    if (
      force ||
      this.file !== this.view.file ||
      this.filePath !== this.view.file?.path ||
      (checkMetadata && this.cachedMetadataKey !== this.metadataKey())
    ) {
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
    this.el.toggleClass(
      "is-hidden",
      this.headings.length < this.settings.minHeadings,
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
    this.headings = (cache && cache.headings) || [];

    // Cached here rather than read on hover: rebuild already runs on every
    // metadata change, so this stays as fresh as the heading list itself.
    // Always needed now -- the visible-range calculation counts lines too.
    this.refreshSource();

    this.render(this.headings.map((heading: any) => heading.level));
    this.el.toggleClass(
      "is-hidden",
      this.headings.length < settings.minHeadings,
    );

    this.activeIndex = -1;
    this.activeKey = "";
    this.attachScroller();
    this.syncWidth();
    this.syncActive();
  }

  refreshSource() {
    const epoch = (this.sourceEpoch = (this.sourceEpoch || 0) + 1);
    const file = this.view.file;
    const lines = this.view.getViewData().split("\n");
    const lastHeading = this.headings.at(-1)?.position.start.line ?? -1;
    this.sourceReady = lines.length > lastHeading;
    this.lines = lines;
    if (this.sourceReady || !file || !this.view.app.vault?.cachedRead) return;
    // Metadata can arrive before reading mode receives its text. Read the same
    // file once, keeping navigation/file changes from accepting an old result.
    this.view.app.vault
      .cachedRead(file)
      .then((text: any) => {
        if (this.sourceEpoch !== epoch || this.view.file !== file) return;
        this.lines = text.split("\n");
        this.sourceReady = this.lines.length > lastHeading;
        this.syncActive();
        if (this.flyoutIndex >= 0) this.showFlyout(this.flyoutIndex);
      })
      .catch(() => {}); // A later layout/metadata refresh can retry a failed read.
  }

  scrollTopLine() {
    const mode = this.view.currentMode;
    return (
      (mode && typeof mode.getScroll === "function" ? mode.getScroll() : 0) || 0
    );
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
    const reading =
      (mode && mode === this.view.previewMode) ||
      mode?.type === "preview" ||
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

    const needsRange =
      this.settings.trackingMode === "position" ||
      this.settings.activeMode === "visible";
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
      headingStarts:
        this.settings.trackingMode === "length"
          ? this.headingLandingStarts()
          : null,
    };
    const lines = this.headings.map(
      (heading: any) => heading.position.start.line,
    );
    if (this.settings.trackingMode === "length" && !viewport.headingStarts) {
      // Do not assign unrelated percentage ranges while layout is unavailable.
      const current = resolveCurrent(
        lines,
        this.lines.length,
        { ...this.settings, trackingMode: "position" },
        viewport,
      );
      this.paintActive(
        resolveActive(lines, this.settings, viewport, current),
        current,
      );
      this.paintProgress(
        sectionProgress(
          lines,
          this.lines.length,
          { ...this.settings, trackingMode: "position" },
          viewport,
          current,
        ),
      );
      return;
    }
    const current = resolveCurrent(
      lines,
      this.lines.length,
      this.settings,
      viewport,
    );
    const active = resolveActive(lines, this.settings, viewport, current);

    this.paintActive(active, current);
    this.paintProgress(
      sectionProgress(
        lines,
        this.lines.length,
        this.settings,
        viewport,
        current,
      ),
    );
  }
}

export { DocumentRail };
