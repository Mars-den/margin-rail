// Optional real-layout checks: PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser/navigation.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.setContent(`<style>
      :root { --text-normal:#ddd; --interactive-accent:#58aaff; --background-secondary:#333; --background-modifier-hover:rgb(50,60,70); --layer-popover:10; }
      body { background:#222; color:#ddd; } #host { position:relative; height:360px; width:700px; border:1px solid gray; }
    </style><button id="before">Before</button><div id="host"></div><button id="after">After</button>`);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'styles.css'), 'utf8') });
    await page.evaluate(() => {
      // The small Obsidian DOM extensions used by the actual RailView.
      const p = HTMLElement.prototype;
      p.createDiv = function(o = {}) { return this.createEl('div', o); };
      p.createSpan = function(o = {}) { return this.createEl('span', o); };
      p.createEl = function(tag, o = {}) { const el = document.createElement(tag); el.className = o.cls || ''; el.textContent = o.text || ''; this.append(el); return el; };
      p.empty = function() { this.replaceChildren(); };
      p.setText = function(text) { this.textContent = text; };
      p.addClass = function(c) { this.classList.add(c); };
      p.removeClass = function(c) { this.classList.remove(c); };
      p.toggleClass = function(c,v) { this.classList.toggle(c,v); };
      window.module = { exports: {} };
      window.require = () => ({ Plugin: class {}, PluginSettingTab: class {}, setIcon() {} });
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'main.js'), 'utf8') + '\nwindow.testAPI = { RailView, DEFAULTS };' });
    await page.evaluate(() => {
      const { RailView, DEFAULTS } = window.testAPI;
      const settings = { ...DEFAULTS, ...{ hierarchyMode: 'all', showBookmarkButton: false } };
      class TestRail extends RailView {
        labelFor(i) { return { title: `Section ${i + 1}`, preview: 'A heading preview', percent: i }; }
        activate(i) { window.jumped = i; }
        scrubTo(p) { window.scrubbed = p; }
        bookmarkState() { return {available: true, saved: false}; }
      }
      window.rail = new TestRail({ settings, applyStyles: module.exports.prototype.applyStyles }, document.querySelector('#host'));
      rail.render(Array.from({ length: 200 }, (_, i) => i % 6 + 1));
    });
    assert.equal(await page.getByRole('listbox', { name: 'Note headings', exact: true }).count(), 1);
    assert.equal(await page.locator('[role="listbox"]').getAttribute('aria-label'), null,
      'The rail name must not trigger Obsidian hover tooltips');
    const layout = () => page.evaluate(() => {
      const box = rail.el.getBoundingClientRect(), host = rail.host.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, hostTop: host.top, hostBottom: host.bottom,
        dense: rail.dense, height: box.height, scrollHeight: rail.el.scrollHeight,
        target: rail.el.children[0].getBoundingClientRect().height };
    });
    for (const anchor of ['top', 'middle', 'bottom']) {
      for (const offset of [-180, 0, 180]) {
        await page.evaluate(({anchor, offset}) => { rail.settings.anchor = anchor; rail.settings.axisOffset = offset; rail.updateSettings(); }, {anchor, offset});
        const box = await layout();
        assert.ok(box.dense && box.scrollHeight > box.height && box.target >= 24);
        assert.ok(box.top >= box.hostTop && box.bottom <= box.hostBottom, JSON.stringify({anchor, offset, ...box}));
      }
    }
    await page.evaluate(() => { rail.settings.anchor = 'middle'; rail.settings.axisOffset = 0; rail.updateSettings(); });
    await page.locator('#before').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement === rail.el), true);
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => rail.keyboardIndex), 199);
    assert.match(await page.locator('[role="option"]').last().getAttribute('aria-label'), /Heading level 2: Section 200/);
    assert.equal(await page.evaluate(() => { const b = rail.el.lastElementChild.getBoundingClientRect(), r = rail.el.getBoundingClientRect(); return b.top >= r.top && b.bottom <= r.bottom; }), true);
    assert.equal(await page.evaluate(() => getComputedStyle(rail.el).outlineStyle), 'solid');
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => jumped), 199);
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => rail.keyboardIndex), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[role="listbox"]').getAttribute('aria-activedescendant'), null);
    assert.equal(await page.evaluate(() => rail.flyout.classList.contains('is-visible')), false);
    await page.keyboard.press('Tab'); assert.equal(await page.locator('#after').evaluate(el => el === document.activeElement), true);

    assert.equal(await page.evaluate(() => getComputedStyle(rail.el).touchAction), 'pan-y');
    assert.equal(await page.evaluate(() => {
      let prevented = false;
      rail.startDrag({button: 0, pointerType: 'touch', preventDefault() { prevented = true; }});
      return rail.drag === null && !prevented;
    }), true);
    // Wheel browsing must expose the last heading and invalidate old hit targets.
    await page.evaluate(() => { rail.el.scrollTop = 0; });
    const strip = await page.locator('[role="listbox"]').boundingBox();
    await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height / 2);
    await page.mouse.wheel(0, 10000);
    await page.waitForFunction(() => rail.el.scrollTop > 1000);
    await page.waitForTimeout(250);
    await page.evaluate(() => rail.measure());
    assert.equal(await page.evaluate(() => rail.nearestIndex(rail.el.getBoundingClientRect().bottom - 12)), 199);
    const last = await page.locator('[role="option"]').last().boundingBox();
    await page.mouse.move(strip.x + strip.width / 2, last.y + last.height / 2);
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => rail.flyoutTitle.textContent), 'Section 200');
    await page.evaluate(() => { window.jumped = -1; });
    await page.mouse.click(strip.x + strip.width / 2, last.y + last.height / 2);
    assert.equal(await page.evaluate(() => jumped), 199);
    await page.mouse.move(strip.x + strip.width / 2, strip.y + 12);
    await page.mouse.down();
    await page.mouse.move(strip.x + strip.width / 2, strip.y + strip.height - 1, { steps: 4 });
    await page.mouse.up();
    assert.ok(await page.evaluate(() => scrubbed > .98));

    // Nested headings stay folded at rest and are all keyboard reachable.
    await page.evaluate(() => { rail.settings.hierarchyMode = 'nearby'; rail.settings.showLabels = false; rail.render([1, 2, 3, 4, 5, 6]); });
    assert.equal(await page.evaluate(() => rail.el.children[5].hidden), true);
    await page.locator('#before').focus(); await page.keyboard.press('Tab'); await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => rail.keyboardIndex === 5 && !rail.el.children[5].hidden), true);
    assert.equal(await page.evaluate(() => rail.flyout.classList.contains('is-visible')), true);
    await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => rail.el.children[5].hidden), true);
    // A long folded outline can scroll to its final branch and reveal its children.
    await page.evaluate(() => {
      rail.host.style.height = '180px'; rail.settings.showLabels = true;
      rail.render(Array.from({length: 200}, (_, i) => i % 10 === 0 ? 1 : 3));
      rail.el.scrollTop = rail.el.scrollHeight;
    });
    const rootHeading = await page.locator('[role="option"]').nth(190).boundingBox();
    const outline = await page.locator('[role="listbox"]').boundingBox();
    await page.mouse.move(outline.x + outline.width / 2, rootHeading.y + rootHeading.height / 2);
    await page.waitForFunction(() => !rail.el.children[199].hidden);
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(200);
    await page.evaluate(() => rail.measure());
    assert.equal(await page.evaluate(() => rail.nearestIndex(rail.el.getBoundingClientRect().bottom - 12)), 199);
    for (const height of [180, 500]) {
      await page.evaluate(height => { rail.host.style.height = `${height}px`; rail.render(Array(200).fill(1)); rail.fitPane(); }, height);
      const box = await layout(); assert.ok(box.top >= box.hostTop && box.bottom <= box.hostBottom);
    }
    // Color-mix rule and legacy fallback are separate declarations.
    await page.evaluate(() => { rail.settings.showSectionProgress = true; rail.updateSettings(); rail.activeIndex = 0; rail.paintProgress(.5); });
    await page.waitForTimeout(160);
    assert.match(await page.evaluate(() => getComputedStyle(rail.el.firstElementChild.firstElementChild).backgroundColor), /color\(srgb/);
    await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
          if (sheet.cssRules[i] instanceof CSSSupportsRule) sheet.deleteRule(i);
        }
      }
    });
    await page.waitForTimeout(160);
    assert.equal(await page.evaluate(() => getComputedStyle(rail.el.firstElementChild.firstElementChild).backgroundColor), 'rgb(50, 60, 70)');
    await page.evaluate(() => { rail.settings.showBookmarkButton = true; });
    await page.locator('#before').focus(); await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement === rail.flyoutBookmark), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement === rail.el && rail.keyboardIndex === -1), true);
    // The settings sample has uneven branches. Crossing them repeatedly must
    // resolve each branch from the resting placement, without cumulative drift.
    const placements = await page.evaluate(() => {
      rail.dismissKeyboard(); rail.host.style.height = '360px';
      Object.assign(rail.settings, { hierarchyMode: 'nearby', idleLevels: 2, anchor: 'middle', axisOffset: 0 });
      rail.render([1,2,3,3,2,3,3,2,3,1,2]);
      const result = [];
      for (let cycle = 0; cycle < 4; cycle++) {
        for (const index of [0,1,4,7,9,10]) {
          rail.measure();
          rail.revealAt(rail.el.children[index].getBoundingClientRect().top + 4);
          result.push({ index, top: rail.el.getBoundingClientRect().top });
        }
      }
      rail.onLeave();
      return { result, shiftAfterLeave: rail.el.style.translate };
    });
    const first = new Map();
    for (const {index, top} of placements.result) {
      if (!first.has(index)) first.set(index, top);
      assert.ok(Math.abs(first.get(index) - top) < 0.5, `Hover moved branch ${index} from ${first.get(index)} to ${top}`);
    }
    assert.equal(placements.shiftAfterLeave, '');
    if (process.env.RAIL_SCREENSHOT) {
      await page.evaluate(() => { rail.keyboardFocused = true; rail.selectKeyboard(30); });
      await page.waitForTimeout(160);
      await page.screenshot({ path: process.env.RAIL_SCREENSHOT });
    }
    await page.evaluate(() => rail.destroy());
    assert.equal(await page.locator('[id$="-label"]').count(), 0, 'Accessible names are removed on unload');
    console.log('Browser checks passed: 200 headings, every anchor/offset, resize, wheel/hover/click, full-range drag, single Tab stop, nested keyboard access, focus, labels, dismissal, color-mix.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
