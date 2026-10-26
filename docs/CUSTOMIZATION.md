# Customization

Use the Workbench first: choose a page, then a group. Changes affect the native
preview and open notes immediately. Rail states can be edited independently.

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
| `current-length`, `passed-length` | additional px |
| `idle-opacity`, `current-opacity`, `passed-opacity`, `hover-opacity` | 0–1 |
| `label-width`, `label-size`, `label-padding`, `label-radius`, `label-distance` | px |
| `current-color` | CSS colour |

Dimensions use the same bounds as their settings controls. Invalid values are
ignored. Geometry overrides also update pointer areas and layout. A control
shows CSS when a snippet supplies its effective value. Disable the snippet to
return to the saved setting. Use `body` to apply variables throughout the vault;
preview-only or per-element dimensional overrides are not supported.

## Preset files

Open the header menu → CSS snippets and preset JSON. Export the current preset
or load a JSON file as a new saved preset. Loading validates the entire file
before changing settings. Invalid files leave settings unchanged.

The format is an object with `version: 1`, a `name`, and a `values` object.
Export a preset to obtain the complete list of supported setting names. Missing
values use defaults; unknown keys, invalid types, out-of-range values, and
unsupported choices are rejected. Custom picker colours use six-digit hex.

Presets contain appearance and behaviour choices. Phone visibility, haptics,
cursor placement, destination highlighting, and Workbench navigation are device
preferences and are not imported or exported. CSS snippet overrides are not
baked into exported presets.
