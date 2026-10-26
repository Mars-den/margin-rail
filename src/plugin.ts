import type { Settings } from "./settings/model";
import type { RailView } from "./rail/rail-view";
import { Plugin, MarkdownView, Notice, resolveSubpath } from "obsidian";
import {
  DEFAULTS,
  SESSION_DEFAULTS,
  PRESET_KEYS,
  COLOR_SOURCES,
  NUMBER_RULES,
  PUBLIC_CSS,
  normalizeLegacySettings,
} from "./settings/model";
import { ScrollspySettingTab } from "./settings/settings-tab";
import { DocumentRail } from "./rail/document-rail";
export default class ScrollspyRailPlugin extends Plugin {
  declare settings: Settings;
  declare cleanedDocuments: WeakSet<Document>;
  declare rails: Map<MarkdownView, DocumentRail>;
  declare settingTab: ScrollspySettingTab;
  declare settingsTimer: number;
  declare settingsWrite: Promise<void> | undefined;
  declare previewBookmarks: Set<number> | undefined;

  async onload() {
    this.rails = new Map();
    const loaded: unknown = await this.loadData();
    this.settings = Object.assign(
      {},
      DEFAULTS,
      SESSION_DEFAULTS,
      loaded && typeof loaded === "object" ? loaded : {},
    );

    normalizeLegacySettings(this.settings);

    // Promote the saved v2 when it still matches the new built-in.
    // Keep the saved copy, and leave any later customizations untouched.
    const selected = this.settings.presets.find(
      (preset) => preset.id === this.settings.activePreset,
    );
    if (
      selected?.name === "v2" &&
      PRESET_KEYS.every((key) => this.settings[key] === DEFAULTS[key])
    ) {
      this.settings.activePreset = "default";
      await this.saveData(this.settings);
    }

    this.settingTab = new ScrollspySettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.applyStyles(); // Clear body variables left by an older hot-reloaded version.

    // layout-change covers pane splits, closes, and reading/editing mode switches.
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.refresh()),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.refresh()),
    );
    this.registerEvent(
      this.app.workspace.on("file-open", () => this.refresh()),
    );
    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        for (const rail of this.rails.values()) rail.updateSettings();
        if (this.settingTab?.preview) this.settingTab.renderWorkbench();
      }),
    );

    // A cold/mobile startup can finish indexing after layout is ready, without
    // emitting a per-file change for notes that were already cached on disk.
    this.registerEvent(
      this.app.metadataCache.on("resolved", () => this.refresh(false, true)),
    );

    this.addCommand({
      id: "refresh-rail",
      name: "Refresh rail and show status",
      callback: () => {
        this.refresh(true);
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        const rail = view ? this.rails.get(view) : null;
        if (!view || !rail) {
          new Notice("Open a Markdown note first.");
          return;
        }
        const count = rail.headings.length;
        const width = view.containerEl.clientWidth;
        const reason =
          rail.visibilityReason() ||
          (!rail.scroller
            ? "Waiting for the note’s scroll container."
            : "Rail ready.");
        new Notice(
          `Margin Rail: ${count} headings, ${width}px pane. ${reason}`,
          10000,
        );
      },
    });

    // Rebuild only the panes showing the edited file, so typing a heading
    // updates its own rail without touching the others.
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        for (const [view, rail] of this.rails) {
          if (view.file?.path === file.path) rail.rebuild();
        }
      }),
    );

    this.installHeadingNavigation();
    this.app.workspace.onLayoutReady(() => this.refresh());
  }

  installHeadingNavigation() {
    const proto = MarkdownView?.prototype;
    const candidate: unknown =
      proto &&
      Object.getOwnPropertyDescriptor(proto, "setEphemeralState")?.value;
    if (typeof candidate !== "function" || typeof resolveSubpath !== "function")
      return;
    const original = candidate as (
      this: MarkdownView,
      state: unknown,
      ...args: unknown[]
    ) => unknown;
    const rails = this.rails;
    const refresh = () => this.refresh();
    const trackingMode = () => this.settings.trackingMode;
    let enabled = true;
    function navigate(this: MarkdownView, state: unknown, ...args: unknown[]) {
      const data =
        state && typeof state === "object"
          ? (state as Record<string, unknown>)
          : null;
      if (
        enabled &&
        data &&
        ["subpath", "line", "scroll"].some((key) =>
          Object.prototype.hasOwnProperty.call(data, key),
        )
      ) {
        rails.get(this)?.cancelHeadingNavigation();
      }
      // Preserve native focus, cursor, history and heading resolution first.
      const result: unknown = Reflect.apply(original, this, [state, ...args]);
      if (
        !enabled ||
        !["length", "equal"].includes(trackingMode()) ||
        typeof data?.subpath !== "string" ||
        !this.file
      )
        return result;
      const cache = this.app.metadataCache.getFileCache(this.file);
      if (!cache) return result;
      const target = resolveSubpath(cache, data.subpath);
      if (target?.type !== "heading") return result;
      refresh();
      rails.get(this)?.queueHeadingNavigation(target.start.line);
      return result;
    }
    proto.setEphemeralState = navigate;
    this.register(() => {
      enabled = false;
      // Other plugins may also wrap this method. Never remove their wrapper.
      if (proto.setEphemeralState === navigate)
        proto.setEphemeralState = original;
    });
  }

  onunload() {
    void this.flushSettings();
    this.settingTab?.hide();
    for (const rail of this.rails.values()) rail.destroy();
    this.rails.clear();
  }

  saveSettings() {
    // Paint immediately; persist only once a slider has settled.
    for (const rail of this.rails.values()) rail.updateSettings();
    if (this.settingsTimer) window.clearTimeout(this.settingsTimer);
    this.settingsTimer = window.setTimeout(() => {
      void this.flushSettings();
    }, 250);
  }

  flushSettings() {
    if (!this.settingsTimer) return this.settingsWrite;
    window.clearTimeout(this.settingsTimer);
    this.settingsTimer = 0;
    const snapshot: unknown = JSON.parse(JSON.stringify(this.settings));
    // Serialize writes so an older save cannot overwrite a newer snapshot.
    this.settingsWrite = (this.settingsWrite || Promise.resolve())
      .then(() => this.saveData(snapshot))
      .catch(() => {
        new Notice("Could not save preferences. Try changing the value again.");
      });
    return this.settingsWrite;
  }

  // Scope variables to owned elements, including preview rails and popouts.
  applyStyles(rail?: RailView) {
    const s = { ...this.settings };
    // External tokens are read once per settings/CSS refresh, never per frame.
    // Resolve numeric pixels here so JS layout and painted geometry agree.
    const win = rail?.host.ownerDocument.defaultView;
    if (rail && typeof win?.getComputedStyle === "function") {
      const css = win.getComputedStyle(rail.el);
      for (const key of Object.keys(
        PUBLIC_CSS,
      ) as (keyof typeof PUBLIC_CSS)[]) {
        const token = PUBLIC_CSS[key];
        const text = css.getPropertyValue(`--margin-rail-${token}`).trim(),
          rule = NUMBER_RULES[key];
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
    const active =
      s.colorMode === "custom"
        ? s.customColor
        : COLOR_SOURCES[s.colorMode as keyof typeof COLOR_SOURCES];

    const vars: Record<string, string> = {
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
      "--ss-label-radius": `${s.labelRadius ?? 5}px`,
    };

    const doc =
      rail?.host.ownerDocument ||
      (typeof document !== "undefined" ? document : null);
    if (doc?.body && !(this.cleanedDocuments ||= new WeakSet()).has(doc)) {
      // Migrate the old global scope without touching unrelated inline styles.
      doc.body.setCssProps(
        Object.fromEntries(Object.keys(vars).map((name) => [name, ""])),
      );
      this.cleanedDocuments.add(doc);
    }
    if (!rail) return;
    for (const state of ["idle", "passed", "pointed", "focus"] as const) {
      const mode =
        state === "idle" && s.idleColorMode === "inherit"
          ? "text"
          : s[`${state}ColorMode`];
      const color =
        mode === "custom"
          ? s[`${state}Color`]
          : mode === "accent"
            ? "var(--text-accent)"
            : mode === "text"
              ? "var(--text-normal)"
              : "inherit";
      vars[`--ss-${state}-color`] = color;
      rail.el.dataset[`${state}ColorMode`] = mode || "text";
    }
    rail.flyout.dataset.surface = s.labelSurface || "theme";
    for (const el of [rail.el, rail.flyout]) el.setCssProps(vars);
  }

  refresh(force = false, checkMetadata = false) {
    const live = new Set<MarkdownView>();

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
}

/* nosourcemap */
