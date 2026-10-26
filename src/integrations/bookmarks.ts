import type { App } from "obsidian";

export interface HeadingBookmark {
  type: "file";
  path: string;
  subpath: string;
  ctime?: number;
}

export interface BookmarksCore {
  items: readonly unknown[];
  addItem(item: HeadingBookmark): void | Promise<void>;
  removeItem(item: HeadingBookmark): void | Promise<void>;
  on?(event: "changed", callback: () => void): unknown;
  off?(event: "changed", callback: () => void): unknown;
}

type BookmarksApp = App & {
  internalPlugins?: {
    getEnabledPluginById?(id: string): unknown;
  };
};

function headingSubpath(title: string) {
  return (
    "#" +
    title
      .replace(/([:#|^\\\r\n]|%%|\[\[|]])/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function findHeadingBookmark(
  items: readonly unknown[] | null | undefined,
  path: string,
  subpath: string,
): HeadingBookmark | null {
  for (const item of items || []) {
    if (!item || typeof item !== "object" || !("type" in item)) continue;
    if (
      item.type === "file" &&
      "path" in item &&
      item.path === path &&
      "subpath" in item &&
      item.subpath === subpath
    )
      return item as HeadingBookmark;
    if (item.type === "group" && "items" in item && Array.isArray(item.items)) {
      const found = findHeadingBookmark(item.items, path, subpath);
      if (found) return found;
    }
  }
  return null;
}

function bookmarksCore(app: App): BookmarksCore | null {
  // Bookmarks has no public API. Guard the enabled core plugin and its current
  // addItem/items shape; never write bookmarks.json directly.
  const core = (app as BookmarksApp).internalPlugins?.getEnabledPluginById?.(
    "bookmarks",
  );
  if (!core || typeof core !== "object") return null;
  const candidate = core as Partial<BookmarksCore>;
  return typeof candidate.addItem === "function" &&
    typeof candidate.removeItem === "function" &&
    Array.isArray(candidate.items)
    ? (candidate as BookmarksCore)
    : null;
}

export { headingSubpath, findHeadingBookmark, bookmarksCore };
