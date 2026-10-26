import type ScrollspyRailPlugin from "../plugin";
import { RailView } from "./rail-view";
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
  declare onProgress: ((progress: number) => void) | undefined;
  declare showSampleLabel: boolean;
  declare scroller: HTMLDivElement;
  declare sections: HTMLElement[];
  declare sampleBookmarks: Set<number>;
  declare onScroll: () => void;
  declare progress: number;
  declare onWheel: (event: WheelEvent) => void;
  declare sceneObserver: ResizeObserver;

  constructor(plugin: ScrollspyRailPlugin, hostEl: HTMLElement) {
    super(plugin, hostEl);
    this.scroller = hostEl.querySelector<HTMLDivElement>(
      ".scrollspy-preview-note",
    )!;
    this.sections = Array.from(
      this.scroller.querySelectorAll<HTMLElement>(".scrollspy-sample-section"),
    );
    this.sampleBookmarks =
      plugin.previewBookmarks || (plugin.previewBookmarks = new Set());
    this.onScroll = () => {
      this.progress = this.scroller.scrollTop / this.scrollRange();
      this.syncActive();
      this.onProgress?.(this.progress);
    };
    this.scroller.addEventListener("scroll", this.onScroll, { passive: true });
    this.onWheel = (event) => {
      if (!this.scroller.contains(event.target as Node | null) && !this.dense) {
        event.preventDefault();
        this.scroller.scrollTop +=
          event.deltaY *
          (event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? this.scroller.clientHeight
              : 1);
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
      this.tops().map((top) => top + 24),
    );
  }
  fitScene() {
    // Reserve the full expanded mark width on the selected side. The note
    // stays separate from the rail even when its size or placement changes.
    const s = this.settings;
    const width = Math.max(
      s.tickWidth +
        (s.hoverStyle === "wave" ? s.waveBoost : 0) +
        Math.max(s.activeBoost, s.passedBoost) +
        Math.max(s.pointedBoost, s.focusBoost),
      s.hoverStyle === "pill" ? s.expandWidth : 0,
      s.hoverStyle === "dot" ? s.expandHeight : 0,
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
  activate(index: number) {
    if (!SAMPLE[index]) return;
    const mode = this.settings.trackingMode;
    const progress =
      mode === "length"
        ? this.starts()[index]
        : mode === "equal"
          ? headingNavigationProgress(
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
                lastAtBottom: this.settings.lastAtBottom,
              },
            )
          : this.tops()[index] / this.scrollRange();
    this.scrubTo(progress ?? 0);
  }
  bookmarkState(index: number) {
    return {
      available: !!SAMPLE[index],
      saved: this.sampleBookmarks.has(index),
    };
  }
  async bookmarkHeading(index: number) {
    if (!SAMPLE[index]) return;
    if (this.sampleBookmarks.has(index)) this.sampleBookmarks.delete(index);
    else this.sampleBookmarks.add(index);
  }
  labelFor(index: number) {
    const item = SAMPLE[index];
    return item
      ? { title: item.title, percent: item.percent, preview: SAMPLE_BODY }
      : null;
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
        "equal",
      );
    return null;
  }
  scrubTo(progress: number) {
    this.scroller.scrollTop = clampProgress(progress) * this.scrollRange();
    this.onScroll();
  }
  syncActive() {
    if (!this.scroller) return;
    this.progress = this.scroller.scrollTop / this.scrollRange();
    const tops = this.tops(),
      lineAt = (y: number) => {
        let i = tops.findIndex((_top, j) => y < (tops[j + 1] ?? Infinity));
        if (i < 0) i = tops.length - 1;
        return (
          SAMPLE[i].percent +
          ((y - tops[i]) /
            Math.max(
              1,
              (tops[i + 1] ?? this.scroller.scrollHeight) - tops[i],
            )) *
            ((SAMPLE[i + 1]?.percent ?? 100) - SAMPLE[i].percent)
        );
      };
    const lines = SAMPLE.map((item) => item.percent),
      viewport = {
        first: lineAt(this.scroller.scrollTop),
        last: lineAt(this.scroller.scrollTop + this.scroller.clientHeight),
        progress: this.progress,
        scrollable: true,
        atBottom: this.scroller.scrollTop >= this.scrollRange() - 1,
        headingStarts:
          this.settings.trackingMode === "length" ? this.starts() : null,
      };
    const current = resolveCurrent(lines, 100, this.settings, viewport);
    this.paintActive(
      resolveActive(lines, this.settings, viewport, current),
      current,
    );
    this.paintProgress(
      sectionProgress(lines, 100, this.settings, viewport, current),
    );
    if (this.showSampleLabel && current >= 0 && this.hoveredIndex < 0)
      this.showFlyout(current);
  }
}
export { PreviewRail, SAMPLE };
