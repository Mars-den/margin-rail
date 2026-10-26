import type { EditorView } from "@codemirror/view";
import type { Editor, MarkdownSubView, MarkdownView } from "obsidian";

// Obsidian's renderer and CodeMirror handles are not part of MarkdownView's
// public API. Keep the optional internals used by the guarded fallbacks here.
export interface ReadingSection {
  el?: HTMLElement;
  lineStart: number;
  lineEnd: number;
  height?: number;
}

export interface ReadingRenderer {
  sections?: ReadingSection[];
  previewEl?: HTMLElement;
  topSpace?: number;
  getSectionTop?(section: ReadingSection): number;
  onRendered?(callback: () => void): void;
}

export interface RailMarkdownMode extends MarkdownSubView {
  type?: string;
  cm?: EditorView;
  renderer?: ReadingRenderer;
}

export type RailMarkdownView = MarkdownView & {
  currentMode: RailMarkdownMode;
  editor: Editor & { cm?: EditorView };
};
