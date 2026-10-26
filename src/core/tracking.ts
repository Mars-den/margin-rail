import type { RailSettings } from "../settings/model";
export interface HeadingRange {
  start: number;
  end: number;
}
export interface ScrollViewport {
  first: number;
  last?: number;
  topLine?: number;
  progress: number;
  scrollable?: boolean;
  atBottom?: boolean;
  headingStarts?: number[] | null;
}
export interface HeadingLanding {
  scrollRange: number;
  viewportHeight: number;
  headingTop: number;
  headingBottom: number;
  preferredTop: number;
  lastAtBottom?: boolean;
}
type TrackingSettings = Pick<
  RailSettings,
  "trackingMode" | "lastAtBottom" | "activeMode"
>;
const LOOKAHEAD_LINES = 1;
function headingAllocations(lines: number[], totalLines: number, mode: string) {
  const weights = lines.map((line, i) =>
    mode === "equal"
      ? 1
      : Math.max(1, (lines[i + 1] ?? totalLines) - (i === 0 ? 0 : line)),
  );
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
function headingLandingStarts(
  tops: number[],
  scrollRange: number,
  viewportHeight = 200,
  bottoms = tops.map((top) => top + 24),
) {
  if (scrollRange <= 0) return tops.map(() => 0);
  const starts = tops.map((top) => Math.max(0, Math.ceil(top - 24)));
  let step = Math.min(
    64,
    viewportHeight / 4,
    scrollRange / Math.max(1, tops.length - 1),
  );
  for (let i = 0; i < tops.length; i++) {
    // Never move a landing past its heading, or so far back it leaves the screen.
    // Near the start, reduce the preferred 24px inset before sacrificing a
    // heading's entire range (e.g. consecutive H1/H2 lines in the editor).
    if (i) step = Math.min(step, Math.max(0, tops[i]) / i);
    const remaining = tops.length - 1 - i;
    if (remaining)
      step = Math.min(
        step,
        Math.max(0, scrollRange - Math.max(0, bottoms[i] - viewportHeight)) /
          remaining,
      );
  }
  step = Math.max(0, Math.floor(step));
  for (let i = starts.length - 1; i >= 0; i--) {
    starts[i] = Math.min(
      starts[i],
      i === starts.length - 1 ? scrollRange : starts[i + 1] - step,
    );
  }
  for (let i = 0; i < starts.length; i++)
    starts[i] = Math.max(i * step, starts[i]);
  return starts.map((top) => top / scrollRange);
}

function physicalHeadingRanges(starts: number[]) {
  return starts.map((start, i) => ({
    start: i === 0 ? 0 : start,
    end: starts[i + 1] ?? 1,
  }));
}

// Prefer the actual heading, near the top with a little breathing room, while
// staying inside the scroll share that activates its mark. Use integer-safe
// boundaries because browsers round scrollTop to physical CSS pixels.
function headingNavigationProgress(
  lines: number[],
  totalLines: number,
  mode: string,
  index: number,
  landing?: HeadingLanding,
) {
  if (
    (mode !== "length" && mode !== "equal") ||
    index < 0 ||
    index >= lines.length
  )
    return null;
  const range = headingAllocations(lines, totalLines, mode)[index];
  if (!landing) return range.start; // Settings sample: start of the section.
  const {
    scrollRange,
    viewportHeight,
    headingTop,
    headingBottom,
    preferredTop,
    lastAtBottom,
  } = landing;
  if (scrollRange <= 0) return null;
  let min = Math.ceil(range.start * scrollRange);
  if (min / scrollRange < range.start) min++;
  let max =
    index === lines.length - 1
      ? Math.floor(scrollRange)
      : Math.ceil(range.end * scrollRange) - 1;
  if (index < lines.length - 1 && max / scrollRange >= range.end) max--;
  if (lastAtBottom && index < lines.length - 1)
    max = Math.min(max, Math.ceil(scrollRange - 2) - 1);
  const preferred = Number.isFinite(headingTop)
    ? headingTop - 24
    : preferredTop;
  let low = min,
    high = max;
  if (Number.isFinite(headingTop) && Number.isFinite(headingBottom)) {
    const visibleMin = Math.max(min, Math.ceil(headingBottom - viewportHeight));
    const visibleMax = Math.min(max, Math.floor(headingTop));
    if (visibleMin <= visibleMax) {
      low = visibleMin;
      high = visibleMax;
    }
  }
  // If there is no heading-visible overlap, choose the closest point in the
  // mark's range rather than skipping to the middle of its section.
  if (max < min) return range.start; // A tiny scroll range may have no distinct pixel for this mark.
  return Math.max(low, Math.min(high, Math.round(preferred))) / scrollRange;
}

function resolveCurrent(
  lines: number[],
  totalLines: number,
  settings: TrackingSettings,
  viewport: ScrollViewport,
) {
  if (!lines.length) return -1;
  // No scroll range means there is no meaningful bottom override.
  if (settings.lastAtBottom && viewport.scrollable && viewport.atBottom)
    return lines.length - 1;
  if (settings.trackingMode === "off") return -1;
  if (settings.trackingMode === "length" || settings.trackingMode === "equal") {
    const ranges =
      settings.trackingMode === "length" && viewport.headingStarts
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

function resolveActive(
  lines: number[],
  settings: TrackingSettings,
  viewport: ScrollViewport,
  current: number,
) {
  const active = new Set(current < 0 ? [] : [current]);
  if (settings.trackingMode !== "off" && settings.activeMode === "visible") {
    lines.forEach((line, index) => {
      if (line >= viewport.first && line <= (viewport.last ?? viewport.first))
        active.add(index);
    });
  }
  return active;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sectionProgress(
  lines: number[],
  totalLines: number,
  settings: TrackingSettings,
  viewport: ScrollViewport,
  current: number,
) {
  if (current < 0 || !lines.length) return 0;
  if (viewport.scrollable && viewport.atBottom) return 1;
  if (settings.trackingMode === "length" || settings.trackingMode === "equal") {
    const range = (
      settings.trackingMode === "length" && viewport.headingStarts
        ? physicalHeadingRanges(viewport.headingStarts)
        : headingAllocations(lines, totalLines, settings.trackingMode)
    )[current];
    return clampProgress(
      (viewport.progress - range.start) / (range.end - range.start),
    );
  }
  const start = lines[current];
  const end = lines[current + 1] ?? totalLines;
  return clampProgress(
    ((viewport.topLine ?? viewport.first) - start) / Math.max(1, end - start),
  );
}

// A branch belongs to the nearest preceding heading shown at rest. Heading
// levels are relative to the shallowest level present, including H2-only notes.

export {
  headingAllocations,
  headingLandingStarts,
  physicalHeadingRanges,
  headingNavigationProgress,
  resolveCurrent,
  resolveActive,
  clampProgress,
  sectionProgress,
};
