# Customization

Open Settings → Margin Rail to choose a preset and adjust its appearance and
behaviour. Changes appear in the preview and open notes immediately.

## CSS snippets

Create an Obsidian CSS snippet through Appearance → CSS snippets. For example:

```css
body {
  --margin-rail-mark-width: 24px;
  --margin-rail-mark-height: 4px;
  --margin-rail-label-radius: 8px;
  --margin-rail-current-color: var(--interactive-accent);
}
```

Supported variables all start with `--margin-rail-`:

| Suffix | Value |
| --- | --- |
| `mark-width`, `mark-height`, `mark-radius`, `mark-gap` | px |
| `level-indent`, `edge-offset`, `vertical-offset` | px |
| `top-padding`, `bottom-padding` | px |
| `current-length`, `passed-length` | additional px |
| `idle-opacity`, `current-opacity`, `passed-opacity`, `hover-opacity` | 0–1 |
| `label-width`, `label-size`, `label-padding`, `label-radius`, `label-distance` | px |
| `current-color` | CSS colour |

Dimensions use the same bounds as their settings controls. Invalid values are
ignored. Geometry overrides also update pointer areas and layout. A control
shows CSS when a snippet overrides its value in the preview. Disable the
snippet to return to the saved setting.

Top and bottom padding reserve space around the rail. The top padding starts
below the note toolbar.

To style specific notes, add a class to their `cssclasses` property in
[Obsidian](https://obsidian.md/help/snippets).

```yaml
---
cssclasses:
  - wide-rail
---
```

```css
.margin-rail-scope.wide-rail {
  --margin-rail-mark-width: 28px;
  --margin-rail-mark-gap: 10px;
  --margin-rail-label-width: 340px;
}
```

The class applies to the rail and label in both reading and editing mode.
You can also target `.scrollspy-rail` for rail variables and
`.scrollspy-flyout` for label variables. To scope a rule to the settings
preview, prefix its selector with `.scrollspy-workbench`.

## Preset files

Open the header menu → CSS snippets and preset JSON. Export the current preset
or load a JSON file as a new saved preset. Loading validates the entire file
before changing settings. Invalid files leave settings unchanged.

The format is an object with `version: 1`, a `name`, and a `values` object.
Export a preset to obtain the complete list of supported setting names. Missing
values use defaults; unknown keys, invalid types, out-of-range values, and
unsupported choices are rejected. Custom picker colours use six-digit hex.

Presets contain appearance and behaviour choices. Phone visibility,
cursor placement, destination highlighting, and Workbench navigation are device
preferences and are not imported or exported. CSS snippet overrides are not
baked into exported presets.
