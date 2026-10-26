import type ScrollspyRailPlugin from "../plugin";
import type { RailSettings, Settings } from "./model";
import type { App } from "obsidian";
import {
  PluginSettingTab,
  Setting,
  Menu,
  Notice,
  setIcon,
  Platform,
} from "obsidian";
import {
  DEFAULTS,
  SESSION_DEFAULTS,
  PRESET_KEYS,
  BUILTIN_PRESETS,
  NUMBER_RULES,
  SETTING_OPTIONS,
  WORKBENCH_GROUPS,
  PUBLIC_CSS,
  validatePreset,
  normalizeLegacySettings,
} from "./model";
import { PreviewRail, SAMPLE } from "../rail/preview-rail";
class ScrollspySettingTab extends PluginSettingTab {
  declare plugin: ScrollspyRailPlugin;
  declare draftName: string;
  declare updateTargetId: string | null;
  declare preview: PreviewRail | null;
  declare previewProgress: number;
  declare presetDrop: import("obsidian").DropdownComponent | null;
  declare sectionEl: HTMLDivElement | null;
  declare filesOpen: boolean;
  declare presetUpdateEl: HTMLDivElement;
  declare renderedKeys: Set<keyof Settings>;
  declare updateSimulation: () => void;
  declare previewTouch: boolean;
  declare previewReduced: boolean;
  declare jsonDraft: string | null;

  constructor(app: App, plugin: ScrollspyRailPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.draftName = "";
    this.updateTargetId =
      plugin.settings.activePreset === "custom"
        ? plugin.settings.sourcePresetId
        : plugin.settings.activePreset;
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
        (option) => option.value === "custom",
      );
      const unsaved = this.plugin.settings.activePreset === "custom";
      // Obsidian's addOption always appends, including on every slider event.
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
  edited(key: string) {
    if (Object.hasOwn(DEFAULTS, key)) {
      const active = this.plugin.settings.activePreset;
      if (active !== "custom") this.plugin.settings.sourcePresetId = active;
      this.plugin.settings.activePreset = "custom";
    }
  }

  capture() {
    return Object.fromEntries(
      PRESET_KEYS.map((key) => [key, this.plugin.settings[key]]),
    ) as RailSettings;
  }

  currentPreset() {
    return this.plugin.settings.presets.find(
      (preset) => preset.id === this.plugin.settings.activePreset,
    );
  }

  display() {
    const s = this.plugin.settings,
      container = this.containerEl;
    const managerOpen = container.querySelector<HTMLDetailsElement>(
      ".scrollspy-preset-manager",
    )?.open;
    const previousSection = container.dataset.section;
    const contentScroll =
      previousSection === s.settingsSection ? container.scrollTop : 0;
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
      cls: "scrollspy-preset-manager",
    });
    manager.open = !!managerOpen;
    container.onpointerdown = (event) => {
      if (
        manager.open &&
        event.target &&
        !manager.contains(event.target as Node)
      )
        manager.open = false;
    };
    container.onkeydown = (event) => {
      if (event.key === "Escape") manager.open = false;
    };
    manager.createEl("summary", { text: "Save as…" });
    this.sectionEl = manager.createDiv({ cls: "scrollspy-preset-form" });
    this.renderPresets(s);
    this.sectionEl = null;
    this.presetUpdateEl = container.createDiv({
      cls: "scrollspy-preset-update",
    });
    this.renderPresetUpdate();
    const sections: Record<string, string> = {
      appearance: "Rail",
      tracking: "Behaviour",
      labels: "Labels",
      placement: "Placement",
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
        String(!this.filesOpen && key === s.settingsSection),
      );
      button.setAttribute("aria-controls", "scrollspy-settings-panel");
      button.tabIndex = key === s.settingsSection ? 0 : -1;
      const choose = (target: string) => {
        s.settingsSection = target;
        this.filesOpen = false;
        this.save(true);
        this.containerEl
          .querySelector<HTMLElement>(`#scrollspy-tab-${target}`)
          ?.focus({ preventScroll: true });
      };
      button.addEventListener("click", () => choose(key));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const keys = Object.keys(sections),
          index = keys.indexOf(key);
        choose(
          keys[
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? keys.length - 1
                : (index +
                    (event.key === "ArrowRight" ? 1 : -1) +
                    keys.length) %
                  keys.length
          ],
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
      `scrollspy-tab-${s.settingsSection}`,
    );
    const groups = this.filesOpen
      ? { css: "CSS snippets", json: "Preset JSON" }
      : WORKBENCH_GROUPS[s.settingsSection];
    for (const [group, title] of Object.entries(groups)) {
      const section = inspector.createEl("section", {
        cls: "scrollspy-settings-section",
      });
      section.dataset.group = group;
      const header = section.createDiv({ cls: "scrollspy-section-header" });
      const heading = header.createEl("h3", { text: title });
      heading.id = `scrollspy-section-${group}`;
      section.setAttribute("aria-labelledby", heading.id);
      const panel = section.createDiv({ cls: "scrollspy-panel" });
      this.sectionEl = panel;
      if (this.filesOpen) this.renderFiles(group);
      else {
        this.renderWorkbenchGroup(s.settingsSection, group);
        const keys = new Set(this.renderedKeys);
        this.iconButton(header, "rotate-ccw", `Reset ${title}`, () => {
          for (const key of keys) this.resetField(key);
          this.save(true);
        });
        section.addEventListener("focusin", () => {
          this.preview!.el.dataset.previewState =
            group === "states" ? s.settingsState : "";
          this.preview!.syncActive();
        });
      }
    }
    this.preview!.el.dataset.previewState = "";
    this.preview!.showSampleLabel =
      !this.filesOpen && s.settingsSection === "labels";
    this.preview!.syncActive();
    this.sectionEl = null;
    container.scrollTop = contentScroll;
  }

  iconButton(
    parent: HTMLElement,
    icon: string,
    label: string,
    action: (event: MouseEvent) => void,
    cls = "",
  ) {
    const button = parent.createEl("button", {
      type: "button",
      cls: `scrollspy-icon-button ${cls}`,
    });
    button.setAttribute("aria-label", label);
    button.title = label;
    setIcon(button, icon);
    button.addEventListener("click", action);
    return button;
  }

  resetField<K extends keyof Settings>(key: K) {
    this.plugin.settings[key] = { ...DEFAULTS, ...SESSION_DEFAULTS }[key];
    this.edited(key);
  }

  field(key: keyof Settings, name: string) {
    const s = this.plugin.settings,
      parent = this.sectionEl!;
    this.renderedKeys.add(key);
    const row = new Setting(parent).setName(name);
    row.settingEl.dataset.key = key;
    if (
      typeof (
        (DEFAULTS as Record<string, unknown>)[key] ??
        (SESSION_DEFAULTS as unknown as Record<string, unknown>)[key]
      ) === "boolean"
    )
      row.addToggle((control) => {
        control.toggleEl.dataset.setting = key;
        control
          .setValue(Boolean(s[key]))
          .onChange((value) => this.changeField(key, value, true));
      });
    else if (SETTING_OPTIONS[key])
      row.addDropdown((control) => {
        control.selectEl.dataset.setting = key;
        control
          .addOptions(SETTING_OPTIONS[key])
          .setValue(String(s[key]))
          .onChange((value) => this.changeField(key, value, true));
      });
    else if (NUMBER_RULES[key]) {
      const [min, max, step, unit] = NUMBER_RULES[key],
        percent = unit === "%",
        multiplier = percent ? 100 : 1;
      const effective = this.preview?.settings[key] ?? s[key];
      if (effective !== s[key]) {
        const source = row.controlEl.createEl("button", {
          type: "button",
          text: "CSS",
          cls: "scrollspy-css-source",
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
        cls: "scrollspy-number",
      });
      input.min = String(min * multiplier);
      input.max = String(max * multiplier);
      input.step = String(step * multiplier);
      input.value = String(Number((effective * multiplier).toFixed(2)));
      input.disabled = effective !== s[key];
      input.setAttribute("aria-label", name);
      const commit = () => {
        const value = Number(input.value) / multiplier;
        if (
          !input.value ||
          !Number.isFinite(value) ||
          value < min ||
          value > max
        ) {
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
      row.addColorPicker((control) =>
        control
          .setValue(String(s[key]))
          .onChange((value) => this.changeField(key, value, false)),
      );
    return row;
  }

  changeField<K extends keyof Settings>(
    key: K,
    value: Settings[K],
    render: boolean,
  ) {
    this.plugin.settings[key] = value;
    this.edited(key);
    this.save(render);
    if (render) this.focusSetting(key);
  }

  focusSetting(key: keyof Settings) {
    this.containerEl
      .querySelector<HTMLElement>(`[data-setting="${key}"]`)
      ?.focus({ preventScroll: true });
  }

  renderWorkbenchGroup(section: string, group: string) {
    const s = this.plugin.settings;
    this.renderedKeys = new Set();
    const fields = (entries: [keyof Settings, string][]) =>
      entries.forEach(([key, label]) => this.field(key, label));
    switch (`${section}/${group}`) {
      case "appearance/shape": {
        const row = new Setting(this.sectionEl!).setName("Shape"),
          choices: Record<string, [string, Record<string, number>]> = {
            bar: ["Bar", { tickHeight: 3, tickRadius: 1 }],
            fine: ["Hairline", { tickHeight: 1, tickRadius: 0 }],
            dot: ["Dot", { tickWidth: 6, tickHeight: 6, tickRadius: 16 }],
            capsule: ["Capsule", { tickHeight: 7, tickRadius: 4 }],
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
              Object.entries(values).every(([key, value]) => s[key] === value),
            ),
          );
          button.createSpan({ cls: `scrollspy-shape-icon shape-${id}` });
          button.addEventListener("click", () => {
            for (const [key, value] of Object.entries(values)) {
              s[key] = value;
              this.edited(key);
            }
            this.save(true);
            this.containerEl
              .querySelector<HTMLElement>(`[data-shape="${id}"]`)
              ?.focus({ preventScroll: true });
          });
        }
        fields([
          ["tickWidth", "Length"],
          ["tickHeight", "Thickness"],
          ["tickRadius", "Rounding"],
          ["tickGap", "Spacing"],
          ["markAlignment", "Alignment"],
        ]);
        break;
      }
      case "appearance/states": {
        const states = {
          idle: "Idle",
          current: "Current",
          passed: "Passed",
          hover: "Hover",
          focus: "Keyboard focus",
        };
        new Setting(this.sectionEl!)
          .setName("Editing state")
          .addDropdown((control) => {
            control.selectEl.dataset.setting = "settingsState";
            control
              .addOptions(states)
              .setValue(s.settingsState)
              .onChange((value) => {
                s.settingsState = value;
                this.save(true);
                this.preview!.el.dataset.previewState = value;
                this.preview!.syncActive();
                this.focusSetting("settingsState");
              });
          });
        const stateKeys: Record<
          string,
          [
            keyof RailSettings,
            keyof RailSettings | null,
            keyof RailSettings,
            keyof RailSettings,
          ]
        > = {
          idle: ["idleOpacity", null, "idleColorMode", "idleColor"],
          current: ["activeOpacity", "activeBoost", "colorMode", "customColor"],
          passed: [
            "passedOpacity",
            "passedBoost",
            "passedColorMode",
            "passedColor",
          ],
          hover: [
            "pointedOpacity",
            "pointedBoost",
            "pointedColorMode",
            "pointedColor",
          ],
          focus: ["focusOpacity", "focusBoost", "focusColorMode", "focusColor"],
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
          ["levelIndent", "Indent per level"],
        ]);
        break;
      case "tracking/tracking":
        fields([
          ["trackingMode", "Tracking"],
          ["showSectionProgress", "Section fill"],
        ]);
        if (s.showSectionProgress)
          this.field("progressDirection", "Fill direction");
        fields([
          ["activeMode", "Highlight"],
          ["lastAtBottom", "Finish on last heading"],
        ]);
        break;
      case "tracking/pointer":
        fields([
          ["hoverStyle", "On hover"],
          ["animDuration", "Duration"],
        ]);
        if (s.hoverStyle === "wave")
          fields([
            ["waveBoost", "Growth"],
            ["waveReach", "Reach"],
            ["waveFocus", "Focus"],
          ]);
        if (s.hoverStyle === "pill")
          fields([
            ["expandWidth", "Badge length"],
            ["expandHeight", "Badge height"],
            ["showLevel", "Heading level"],
          ]);
        if (s.hoverStyle === "dot") this.field("expandHeight", "Dot size");
        break;
      case "tracking/target":
        fields([
          ["hitbox", "Pointer area"],
          ["hoverOpacity", "Nearby visibility"],
          ["dragToScrub", "Drag to scroll"],
        ]);
        break;
      case "tracking/navigation":
        fields([
          ["placeCursorOnNavigate", "Place cursor at heading"],
          ["highlightOnNavigate", "Highlight destination"],
        ]);
        if (Platform?.isMacOS && Platform?.isDesktopApp)
          this.field("macDragHaptics", "Haptic ticks while dragging");
        break;
      case "labels/content":
        fields([
          ["showLabels", "Heading label"],
          ["showPreview", "Section excerpt"],
        ]);
        if (s.showPreview) this.field("previewLength", "Excerpt length");
        fields([
          ["showPercent", "Heading percentage"],
          ["showBookmarkButton", "Bookmark button"],
        ]);
        break;
      case "labels/appearance":
        fields([
          ["labelWidth", "Width"],
          ["labelFontSize", "Text size"],
          ["labelPadding", "Padding"],
          ["labelRadius", "Rounding"],
          ["labelOffset", "Distance"],
          ["labelSurface", "Surface"],
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
          ["axisOffset", "Vertical offset"],
        ]);
        break;
      case "placement/visibility":
        fields([
          ["minHeadings", "Minimum headings"],
          ["hideBelowWidth", "Minimum pane width"],
          ["phoneVisibility", "On phones"],
        ]);
        break;
    }
  }

  renderPreview(parent: HTMLElement) {
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
      // Uneven placeholder paragraphs preserve real section-length tracking
      // without filling the preview with readable filler text.
      const widths = [100, 87, 95, 72, 92, 100, 81, 58];
      for (let line = 0; line < (index % 3 === 0 ? 8 : 5); line++) {
        body.createSpan({ cls: "scrollspy-sample-line" }).style.width =
          `${widths[(line + index) % widths.length]}%`;
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
        const menu = new Menu();
        menu.addItem((item) =>
          item
            .setTitle("Touch preview")
            .setChecked(!!this.previewTouch)
            .onClick(() => {
              this.previewTouch = !this.previewTouch;
              this.preview!.simulateTouch = this.previewTouch;
              this.preview!.setInputMode(this.previewTouch ? "touch" : "mouse");
            }),
        );
        menu.addItem((item) =>
          item
            .setTitle("Reduced motion")
            .setChecked(!!this.previewReduced)
            .onClick(() => {
              this.previewReduced = !this.previewReduced;
              this.preview!.forceReducedMotion = this.previewReduced;
              stage.toggleClass("is-reduced-motion", this.previewReduced);
            }),
        );
        menu.showAtMouseEvent(event);
      },
    );
    this.preview.simulateTouch = !!this.previewTouch;
    this.preview.forceReducedMotion = !!this.previewReduced;
    stage.toggleClass("is-reduced-motion", !!this.previewReduced);
  }

  renderFiles(group: string) {
    const parent = this.sectionEl!;
    if (group === "css") {
      parent.createEl("p", {
        cls: "setting-item-description",
        text: "Use an Obsidian CSS snippet. Supported pixel variables override the matching controls and apply to both preview and notes.",
      });
      const code = parent.createEl("pre");
      code.createEl("code", {
        text: "body {\n  --margin-rail-mark-width: 24px;\n  --margin-rail-mark-height: 4px;\n  --margin-rail-label-radius: 8px;\n}",
      });
      const details = parent.createEl("details");
      details.createEl("summary", { text: "Supported variables" });
      const list = details.createEl("ul");
      for (const [key, token] of Object.entries(PUBLIC_CSS))
        list.createEl("li", {
          text: `--margin-rail-${token} (${NUMBER_RULES[key][3] || "number"})`,
        });
      list.createEl("li", { text: "--margin-rail-current-color (CSS colour)" });
      return;
    }
    const input = parent.createEl("textarea", { cls: "scrollspy-preset-json" });
    input.setAttribute("aria-label", "Preset JSON");
    input.spellcheck = false;
    input.value =
      this.jsonDraft ||
      JSON.stringify(
        {
          version: 1,
          name: this.currentPreset()?.name || "My rail",
          values: this.capture(),
        },
        null,
        2,
      );
    input.addEventListener("input", () => {
      this.jsonDraft = input.value;
    });
    const actions = parent.createDiv({ cls: "scrollspy-file-actions" });
    const message = parent.createDiv({ cls: "setting-item-description" });
    message.setAttribute("aria-live", "polite");
    const button = (name: string, action: () => void) =>
      actions
        .createEl("button", { text: name, type: "button" })
        .addEventListener("click", action);
    button("Load as preset", () => {
      try {
        const preset = validatePreset(JSON.parse(input.value));
        const id = `user-${Date.now().toString(36)}`;
        this.plugin.settings.presets.push({ id, ...preset });
        Object.assign(this.plugin.settings, preset.values);
        Object.assign(this.plugin.settings, {
          activePreset: id,
          sourcePresetId: id,
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
      const doc = parent.ownerDocument,
        win = doc.defaultView!;
      const url = win.URL.createObjectURL(
        new win.Blob([input.value], { type: "application/json" }),
      );
      const link = doc.createElement("a");
      link.href = url;
      link.download = "margin-rail-preset.json";
      link.click();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
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

  renderPresetPicker(parent: HTMLElement, s: Settings) {
    const options: Record<string, string> = {};
    for (const preset of BUILTIN_PRESETS)
      options[preset.id] =
        preset.name + (preset.id === "default" ? " (default)" : "");
    for (const preset of s.presets)
      options[preset.id] =
        preset.name +
        (BUILTIN_PRESETS.some((builtin) => builtin.name === preset.name)
          ? " (saved)"
          : "");
    const builtin = BUILTIN_PRESETS.find(
      (preset) => preset.id === s.activePreset,
    );
    if (s.activePreset === "custom") options.custom = "Custom (unsaved)";

    new Setting(parent)
      .setName("Preset")
      .setDesc(
        builtin
          ? builtin.description
          : "Appearance and behaviour from every section.",
      )
      .addDropdown((drop) => {
        this.presetDrop = drop;
        drop.selectEl.dataset.setting = "activePreset";
        const chevron = drop.selectEl.parentElement!.createSpan({
          cls: "scrollspy-preset-chevron",
        });
        setIcon(chevron, "chevron-down");
        return drop
          .addOptions(options)
          .setValue(s.activePreset)
          .onChange((value) => {
            const preset =
              BUILTIN_PRESETS.find((item) => item.id === value) ||
              s.presets.find((item) => item.id === value);
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
      type: "button",
    });
    setIcon(manage, "ellipsis");
    manage.setAttribute("aria-label", "Preset options");
    manage.setAttribute("aria-haspopup", "menu");
    manage.addEventListener("click", (event) => {
      const menu = new Menu();
      menu.addItem((item) =>
        item.setTitle("Save preset as…").onClick(() => {
          const manager = this.containerEl.querySelector<HTMLDetailsElement>(
            ".scrollspy-preset-manager",
          ) as HTMLDetailsElement;
          manager.open = true;
          manager.querySelector<HTMLInputElement>("input")?.focus();
        }),
      );
      menu.addItem((item) =>
        item.setTitle("CSS snippets and preset JSON…").onClick(() => {
          this.filesOpen = true;
          this.display();
        }),
      );
      menu.addItem((item) =>
        item.setTitle("Reset to v2").onClick(() => {
          Object.assign(s, DEFAULTS);
          s.activePreset = "default";
          s.sourcePresetId = null;
          this.updateTargetId = null;
          this.save(true);
        }),
      );
      const saved = s.presets.find(
        (preset) =>
          preset.id ===
          (s.activePreset === "custom" ? s.sourcePresetId : s.activePreset),
      );
      if (saved)
        menu.addItem((item) =>
          item.setTitle(`Delete “${saved.name}”`).onClick(() => {
            s.presets = s.presets.filter((preset) => preset.id !== saved.id);
            if (s.activePreset === saved.id) s.activePreset = "custom";
            if (s.sourcePresetId === saved.id) s.sourcePresetId = null;
            this.updateTargetId = null;
            this.save(true);
          }),
        );
      menu.showAtMouseEvent(event);
    });
  }

  updatePreset() {
    const s = this.plugin.settings;
    const source =
      s.activePreset === "custom" ? s.sourcePresetId : s.activePreset;
    const id = this.updateTargetId || source;
    const builtin = BUILTIN_PRESETS.find((item) => item.id === id);
    // Only copies explicitly created from this built-in can be reused.
    // Names are user-editable labels and cannot identify an update target.
    return (
      s.presets.find((item) => item.id === id) ||
      (builtin &&
        s.presets.find((item) => item.originBuiltinId === builtin.id)) ||
      builtin ||
      null
    );
  }

  renderPresetUpdate() {
    const group = this.presetUpdateEl;
    group.empty();
    const saved = this.updatePreset();
    group.hidden =
      this.plugin.settings.activePreset !== "custom" ||
      (!saved && !this.plugin.settings.presets.length);
    if (group.hidden) return;
    const update = group.createEl("button", { text: "Update", type: "button" });
    update.disabled = !saved;
    update.setAttribute(
      "aria-label",
      saved ? `Update preset “${saved.name}”` : "Update preset",
    );
    update.addEventListener("click", () => {
      let target = this.updatePreset();
      if (!target) return;
      if (!this.plugin.settings.presets.includes(target)) {
        target = {
          id: `user-${Date.now().toString(36)}`,
          name: target.name,
          originBuiltinId: target.id,
          values: {},
        };
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
      group
        .createSpan({ cls: "scrollspy-update-target" })
        .createSpan({ text: saved.name });
      return;
    }
    const picker = group.createEl("button", {
      cls: "scrollspy-update-target",
      type: "button",
    });
    picker.createSpan({ text: saved ? saved.name : "Choose preset" });
    setIcon(
      picker.createSpan({ cls: "scrollspy-update-chevron" }),
      "chevron-down",
    );
    picker.setAttribute(
      "aria-label",
      saved
        ? `Choose preset to update; currently “${saved.name}”`
        : "Choose preset to update",
    );
    picker.setAttribute("aria-haspopup", "menu");
    picker.addEventListener("click", (event) => {
      const menu = new Menu();
      for (const preset of destinations) {
        menu.addItem((item) =>
          item
            .setTitle(preset.name)
            .setChecked(preset.id === saved?.id)
            .onClick(() => {
              // Choosing a destination never loads it over the current edits.
              this.updateTargetId = preset.id;
              this.display();
              this.presetUpdateEl
                .querySelector<HTMLElement>("[aria-haspopup]")
                ?.focus({ preventScroll: true });
            }),
        );
      }
      menu.showAtMouseEvent(event);
    });
  }

  renderPresets(s: Settings) {
    const box = this.sectionEl || this.containerEl;
    new Setting(box)
      .setName("Save current settings")
      .setDesc(
        "Stores appearance and behaviour from every section under a name.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Preset name")
          .setValue(this.draftName)
          .onChange((value) => {
            this.draftName = value;
          }),
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
            const manager = this.containerEl.querySelector<HTMLDetailsElement>(
              ".scrollspy-preset-manager",
            );
            if (manager) manager.open = false;
            new Notice(`Saved preset “${name}”.`);
            this.save(true);
          }),
      );
  }
}

export { ScrollspySettingTab };
