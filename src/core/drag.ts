import type { HeadingRange } from "./tracking";
export interface DragMotion {
  position: number;
  time: number;
  speed: number;
}
import { clampProgress } from "./tracking";
function scrubProgress(clientY: number, start: number, end: number) {
  return clampProgress((clientY - start) / Math.max(1, end - start));
}

// Each visible mark owns the pointer band halfway to its neighbours. Map that
// band to the same scroll interval that makes this heading current.
function sectionDragProgress(
  clientY: number,
  centers: (number | null)[],
  ranges: HeadingRange[] | null,
  start: number,
  end: number,
  strength = 1,
) {
  if (
    !ranges ||
    centers.some((center) => center == null) ||
    centers.length !== ranges.length
  ) {
    return scrubProgress(clientY, start, end);
  }
  let index = centers.findIndex(
    (center, i) => clientY < (center! + (centers[i + 1] ?? Infinity)) / 2,
  );
  if (index < 0) index = centers.length - 1;
  const low = index ? (centers[index - 1]! + centers[index]!) / 2 : start;
  const high =
    index + 1 < centers.length
      ? (centers[index]! + centers[index + 1]!) / 2
      : end;
  const fraction = scrubProgress(clientY, low, high);
  // Briefly hold the heading's landing at the entrance to its band. This gives
  // each crossing a small detent without delaying or animating the scroll.
  const hold = 0.15 * strength;
  const within = fraction < hold ? 0 : (fraction - hold) / (1 - hold);
  return (
    ranges[index].start + (ranges[index].end - ranges[index].start) * within
  );
}

// Speeds are measured in marks per second, independent of rail spacing.
function dragSnapStrength(speed: number) {
  const blend = clampProgress((speed - 2) / 6);
  return 1 - blend * blend * (3 - 2 * blend);
}

function sampleDragSpeed(motion: DragMotion, position: number, time: number) {
  const elapsed = Math.max(1, time - motion.time);
  const speed = (Math.abs(position - motion.position) * 1000) / elapsed;
  // Respond promptly to acceleration; restore detents more gently on slowing.
  const blend = 1 - Math.exp(-elapsed / (speed > motion.speed ? 60 : 180));
  motion.speed += (speed - motion.speed) * blend;
  motion.position = position;
  motion.time = time;
  return dragSnapStrength(motion.speed);
}

// Match the heading subpath used by Obsidian's own heading bookmarks.

export {
  scrubProgress,
  sectionDragProgress,
  dragSnapStrength,
  sampleDragSpeed,
};
