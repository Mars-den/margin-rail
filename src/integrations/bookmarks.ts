function headingSubpath(title: any) {
  return (
    "#" +
    title
      .replace(/([:#|^\\\r\n]|%%|\[\[|]])/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function findHeadingBookmark(items: any, path: string, subpath: string): any {
  for (const item of items || []) {
    if (item.type === "file" && item.path === path && item.subpath === subpath)
      return item;
    if (item.type === "group" && Array.isArray(item.items)) {
      const found = findHeadingBookmark(item.items, path, subpath);
      if (found) return found;
    }
  }
  return null;
}

function bookmarksCore(app: any) {
  // Bookmarks has no public API. Guard the enabled core plugin and its current
  // addItem/items shape; never write bookmarks.json directly.
  const core = app.internalPlugins?.getEnabledPluginById?.("bookmarks");
  return core &&
    typeof core.addItem === "function" &&
    typeof core.removeItem === "function" &&
    Array.isArray(core.items)
    ? core
    : null;
}

export { headingSubpath, findHeadingBookmark, bookmarksCore };
