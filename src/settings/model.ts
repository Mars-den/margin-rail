export const DEFAULTS = {
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
  labelSurface: "theme",
};

// Not part of a preset: these describe the preset system and the settings tab
// itself, so copying them between presets would be meaningless.
export interface SavedPreset {
  id: string;
  name: string;
  values: Partial<RailSettings>;
  originBuiltinId?: string;
}
export interface SessionSettings {
  activePreset: string;
  presets: SavedPreset[];
  sourcePresetId: string | null;
  settingsSection: string;
  phoneVisibility: string;
  placeCursorOnNavigate: boolean;
  highlightOnNavigate: boolean;
  settingsState: string;
}
export type RailSettings = typeof DEFAULTS;
export type Settings = RailSettings & SessionSettings;
export const SESSION_DEFAULTS: SessionSettings = {
  activePreset: "default",
  presets: [], // [{ id, name, values }]
  sourcePresetId: null, // Saved preset being customized; survives Custom (unsaved).
  settingsSection: "appearance",
  phoneVisibility: "hidden", // hidden | landscape | always; independent of presets
  placeCursorOnNavigate: false,
  highlightOnNavigate: false,
  settingsState: "current",
};

export const PRESET_KEYS = Object.keys(DEFAULTS) as (keyof RailSettings)[];

// Shared by numeric controls, preset imports and external style overrides.
export type NumberRule = readonly [number, number, number, string];
export const NUMBER_RULES: Record<string, NumberRule> = {
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
  labelRadius: [0, 24, 1, "px"],
};
export const SETTING_OPTIONS: Record<string, Record<string, string>> = {
  side: { left: "Left", right: "Right" },
  anchor: { top: "Top", middle: "Middle", bottom: "Bottom" },
  markAlignment: {
    edge: "Follow rail side",
    left: "Left",
    center: "Centre",
    right: "Right",
  },
  progressDirection: {
    left: "Left to right",
    right: "Right to left",
    center: "From centre",
  },
  trackingMode: {
    length: "Section length · Recommended",
    position: "Heading position",
    equal: "Equal scroll steps",
    off: "Off",
  },
  activeMode: { single: "Current heading", visible: "Also on screen" },
  hoverStyle: {
    none: "Still",
    wave: "Swell",
    pill: "Heading badge",
    focus: "Focus",
    dot: "Dot",
  },
  hierarchyMode: { all: "All headings", nearby: "Reveal nearby" },
  colorMode: { neutral: "Text", accent: "Theme accent", custom: "Custom" },
  labelMotion: { none: "Instant", fade: "Fade", slide: "Slide" },
  labelMoveMotion: { none: "Instant", slide: "Slide" },
  labelSurface: { theme: "Theme", flat: "Flat", transparent: "Transparent" },
  phoneVisibility: {
    hidden: "Hidden",
    landscape: "Landscape only",
    always: "Always",
  },
};
for (const state of ["idle", "passed", "pointed", "focus"])
  SETTING_OPTIONS[`${state}ColorMode`] = {
    text: "Text",
    accent: "Theme accent",
    ...(state === "idle" ? {} : { inherit: "Inherit" }),
    custom: "Custom",
  };

// Keep settings and saved presets from earlier workbench builds usable.
export function normalizeLegacySettings(settings: Partial<RailSettings>) {
  if (settings.labelMoveMotion === "fade") settings.labelMoveMotion = "none";
  // Idle is the base state: it has no painted state from which to inherit.
  if (settings.idleColorMode === "inherit") settings.idleColorMode = "text";
}

export const WORKBENCH_GROUPS: Record<string, Record<string, string>> = {
  appearance: {
    shape: "Shape",
    states: "States",
    headings: "Heading hierarchy",
  },
  tracking: {
    tracking: "Tracking",
    pointer: "Hover",
    target: "Pointer area",
    navigation: "Navigation",
  },
  labels: { content: "Content", appearance: "Appearance", motion: "Motion" },
  placement: { position: "Position", visibility: "Visibility" },
};

export const PUBLIC_CSS = {
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
  labelOffset: "label-distance",
} as const satisfies Partial<Record<keyof RailSettings, string>>;

export function validatePreset(input: unknown): {
  name: string;
  values: RailSettings;
} {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Use a version 1 preset with a name and values.");
  const data = input as Record<string, unknown>;
  if (
    data.version !== 1 ||
    typeof data.name !== "string" ||
    !data.name.trim() ||
    data.name.length > 100 ||
    !data.values ||
    typeof data.values !== "object" ||
    Array.isArray(data.values)
  )
    throw Error("Use a version 1 preset with a name and values.");
  const values: Record<string, unknown> = { ...DEFAULTS };
  for (const [key, original] of Object.entries(
    data.values as Record<string, unknown>,
  )) {
    const value =
      key === "idleColorMode" && original === "inherit" ? "text" : original;
    if (!Object.hasOwn(DEFAULTS, key))
      throw Error(`Unknown preset option: ${key}`);
    if (typeof value !== typeof DEFAULTS[key as keyof RailSettings])
      throw Error(`Invalid value for ${key}`);
    const rule = NUMBER_RULES[key];
    if (
      rule &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < rule[0] ||
        value > rule[1])
    )
      throw Error(`Out of range: ${key}`);
    if (
      SETTING_OPTIONS[key] &&
      (typeof value !== "string" || !Object.hasOwn(SETTING_OPTIONS[key], value))
    )
      throw Error(`Unknown choice for ${key}`);
    if (
      key.toLowerCase().includes("color") &&
      !key.endsWith("Mode") &&
      (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value))
    )
      throw Error(`Use a six-digit hex colour for ${key}`);
    values[key] = value;
  }
  return { name: data.name.trim(), values: values as RailSettings };
}

export const BUILTIN_PRESETS = [
  {
    id: "default",
    name: "v2",
    description:
      "Default: slim neutral ticks, a focused wave, section-length tracking, and full labels with bookmarks.",
    values: DEFAULTS,
  },
  {
    id: "builtin-absolutely",
    name: "Absolutely",
    description:
      "Inspired by Claude’s restrained styling: fine, widely spaced marks on the left, with simple heading labels.",
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
      showPreview: false,
    },
  },
  {
    id: "builtin-quiet",
    name: "Quiet",
    description:
      "A minimal rail that follows the note, with a gentle hover and title-only labels.",
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
      showBookmarkButton: false,
    },
  },
  {
    id: "builtin-outline",
    name: "Outline",
    description:
      "Show every heading with depth indentation and H-level pills on hover.",
    values: {
      ...DEFAULTS,
      hierarchyMode: "all",
      levelIndent: 3,
      tickWidth: 24,
      hoverStyle: "pill",
      trackingMode: "position",
      colorMode: "accent",
      showPreview: false,
    },
  },
  {
    id: "builtin-progress",
    name: "Progress",
    description:
      "Equal scroll shares, square marks with a hover swell, and section progress filling from right to left.",
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
      labelMoveMotion: "none",
    },
  },
];

export function railVisibilityReason(
  settings: Pick<
    Settings,
    "phoneVisibility" | "hideBelowWidth" | "minHeadings"
  >,
  {
    phone,
    landscape,
    width,
    headings,
  }: { phone: boolean; landscape: boolean; width: number; headings: number },
) {
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

export const COLOR_SOURCES = {
  neutral: "var(--text-normal)",
  accent: "var(--text-accent)",
};
