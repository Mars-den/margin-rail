# Margin Rail

Find your place in a long note without opening a sidebar. Margin Rail adds a slim
column of heading markers along the edge of your note. Hover to see a heading and a
little of what’s below it, click to jump there, or drag along the rail to scroll.

It works in reading mode and while you edit. This kind of navigation is also
called a **scrollspy**.

[![Margin Rail in action: scrolling, heading previews, and bookmarks](images/showcase.gif)](https://github.com/Mars-den/margin-rail/blob/main/images/margin-showcase.mp4)

[Watch the full video](https://github.com/Mars-den/margin-rail/blob/main/images/margin-showcase.mp4).

## Install

In Obsidian, open **Settings → Community plugins → Browse**, search for
**Margin Rail**, then install and enable it. You can also find it on the
[community plugins page](https://community.obsidian.md/plugins/scrollspy-rail).

Requires **Obsidian 1.2.7 or later**. See [compatibility](#compatibility-and-privacy)
for details about testing.

<details>
<summary>Install manually</summary>

Download `main.js`, `manifest.json`, and `styles.css` from the
[latest release](https://github.com/Mars-den/margin-rail/releases/latest).
Inside your vault’s `.obsidian/plugins/` folder, create a folder with the name
shown in the `id` field of `manifest.json`. Put the three files there, restart
Obsidian, and enable **Margin Rail** in Community plugins.

</details>

## Using the rail

Open a note with a few headings. Each small bar represents a heading, and the
highlighted bar shows where you are.

- **Hover** over a bar to see its heading. Labels can also show a short text
  preview and how far down the note the heading is.
- **Click** to jump to that heading.
- **Drag** up or down along the rail to scroll through the note.
- **Bookmark** a heading with the button on its label. Click it again to remove
  the bookmark. Saved headings have a dot beside their bar.

Bookmarks use Obsidian’s **Bookmarks** core plugin, so it needs to be enabled.
You can show or hide the bookmark button under **Settings → Margin Rail → Labels**.

## Make it yours

Open **Settings → Margin Rail** to try changes in the live preview. Hover over
its sample rail or move the scroll slider to see how your choices feel. Changes
also appear in your open notes as you make them. You can collapse the preview
if you want more room for the controls.

Start with a preset, then adjust whatever you like:

| Preset | What it looks and feels like |
|---|---|
| **v1** · default | Slim bars that grow near your pointer, with heading previews and a bookmark button. |
| **Quiet** | A subtle rail with simple heading labels. |
| **Outline** | Indented bars and heading-level labels to show your note’s structure. |
| **Progress** | Each heading gets an equal share of scrolling, with a bar that fills as you move through it. |

You can save your own presets, update them, or delete them. If you change a
preset, it becomes **Custom (unsaved)** until you save it. Switching presets
keeps your phone visibility and settings-panel preferences.

The settings are grouped into six sections:

- **Scroll tracking** — choose which heading is highlighted and whether its bar
  shows progress.
- **Rail & colour** — change the bars’ size, spacing, colour, and visibility.
  Show every heading or reveal deeper headings as you hover nearby.
- **Pointer & motion** — choose the hover effect, adjust its animation, and
  turn dragging on or off.
- **Labels** — choose what appears when you hover: the title, percentage,
  text preview, and bookmark button.
- **Placement** — move the rail, choose when it appears, and set phone visibility.
- **Presets** — switch between looks or save your own.

## How headings follow your scrolling

There are four ways to choose the current heading. Try them with the preview’s
scroll slider to see which you prefer.

| Setting | What happens |
|---|---|
| **Follow the note** | A heading becomes current when it reaches the top of the note area. |
| **By section length** | Longer sections stay current for more of your scrolling. Every heading gets a turn. |
| **Equal shares** | Every heading stays current for the same amount of scrolling. |
| **No tracking** | Use the rail to navigate without highlighting a current heading. |

**By section length** is the default. Section length is measured in lines of
Markdown, so resizing your window doesn’t change each heading’s share. Nested
headings get their own shares too.

**Finish on the last heading** highlights the final heading when you reach the
bottom of a scrollable note. It works with any rule, including **No tracking**
if you only want a highlight at the very end.

You can also highlight other headings that are on screen, fade sections you’ve
passed, or let the current bar fill as you move through its section.

## On your phone

The rail is hidden on phones by default to leave more room for your note.
To enable it, go to **Settings → Margin Rail → Placement → On phones** and choose
**Landscape only** or **Show on phones**.

This choice stays the same when you switch presets. The settings preview is
available even when the rail is hidden.

## If the rail doesn’t appear

Check **Placement** in the plugin settings. The rail can hide when a note has
too few headings, a desktop or tablet pane is too narrow, or your phone visibility
setting hides it. On phones, the minimum pane width doesn’t apply.

You can also open Obsidian’s command palette and run
**Margin Rail: Refresh rail and show status**. It refreshes the rail and tells
you what might be keeping it hidden.

Still having trouble? [Open an issue](https://github.com/Mars-den/margin-rail/issues)
with your Obsidian version, device, whether you were reading or editing, and
what happened.

## Compatibility and privacy

Margin Rail works locally. It doesn’t send network requests or collect usage data.

Desktop testing includes Obsidian **1.12.7** and **1.14.4**, and the plugin has
also been tested on iPhone. Support back to **1.2.7** is based on checking that
version’s code and APIs; it hasn’t been tested by hand on that version. Reports
from older versions, Android devices, and tablets are welcome.

Scrolling and bookmarks rely on some parts of Obsidian that aren’t official
plugin APIs. Those can change when Obsidian updates, so an update could affect
these features.

<details>
<summary>For developers</summary>

The plugin is plain JavaScript and CSS, with no build step. Headings come from
Obsidian’s metadata cache. Reading and editing modes use the same tracking rules,
and the settings preview shares the rail code used in notes.

Scroll updates run at most once per animation frame. Existing rails are reused
when the workspace changes, and appearance settings apply to popout windows too.

Run the automated checks with:

```sh
node scripts/verify.cjs
```

The checks cover tracking, bookmarks, dragging, phone visibility, startup,
performance, and cleanup.

To publish a release, commit your changes on the branch tracking `origin/main`,
then run `node scripts/release.cjs` followed by the next version number. The
script updates the version, tags it, and pushes it. GitHub Actions checks and
attests the three plugin files before publishing them.

</details>

## License

[MIT](LICENSE) — you’re welcome to use, modify, and share it under that license.

Developed with AI assistance. Maintained by [Mars-den](https://github.com/Mars-den).
