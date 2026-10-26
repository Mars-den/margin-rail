# Contributing

For bugs, include your Obsidian version, device, reading or editing mode, and
steps to reproduce. A short recording helps with scrolling and layout issues.

For code changes:

```sh
npm ci
npm test
```

The checks cover Obsidian's recommended lint rules, type checking, and regression
tests. Include the generated `main.js` when changing plugin code.

For layout or interaction changes, also run the browser suites with Playwright
and its Chromium and WebKit browsers installed:

```sh
node tests/browser/settings.cjs
node tests/browser/navigation.cjs
node tests/browser/touch.cjs
```

Use `PLAYWRIGHT_MODULE` if Playwright is installed outside this project.
