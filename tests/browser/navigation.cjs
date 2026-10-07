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
      window.NativeMarkdownView = class {
        setEphemeralState(state) {
          this.nativeState = state;
          const heading = this.app.metadataCache.getFileCache(this.file).headings.find(item => `#${item.heading}` === state.subpath);
          if (heading) this.currentMode.applyScroll(heading.position.start.line);
        }
      };
      window.require = () => ({ Plugin: class {}, PluginSettingTab: class {}, MarkdownView: NativeMarkdownView, setIcon() {},
        resolveSubpath(cache,subpath) { const item=cache.headings.find(item=>`#${item.heading}`===subpath);return item?{type:'heading',start:item.position.start}:null; } });
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'main.js'), 'utf8') + '\nwindow.testAPI = { RailView, DocumentRail, DEFAULTS };' });
    await page.evaluate(() => {
      const { RailView, DEFAULTS } = window.testAPI;
      const settings = { ...DEFAULTS, ...{ hierarchyMode: 'all', showBookmarkButton: false } };
      class TestRail extends RailView {
        labelFor(i) { return { title: `Section ${i + 1}`, preview: 'A heading preview', percent: i }; }
        activate(i) { window.jumped = i; }
        scrubTo(p) { window.scrubbed = p; }
        bookmarkState() { return {available: true, saved: false}; }
        async bookmarkHeading(index) { window.bookmarkedIndex = index; }
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
    await page.evaluate(() => { rail.settings.hierarchyMode = 'nearby'; rail.settings.idleLevels = 2; rail.settings.showLabels = false; rail.render([1, 2, 3, 4, 5, 6]); });
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
    // A real click focuses the button before its handler runs. Disabling it
    // must not erase the selected heading via focusout before the write.
    await page.locator('.scrollspy-bookmark-button').click();
    assert.equal(await page.evaluate(() => window.bookmarkedIndex), 1);
    assert.equal(await page.evaluate(()=>rail.flyout.classList.contains('is-visible')),true,'Bookmark click leaves the label open while pointed at');
    await page.mouse.move(950,650);
    await page.waitForFunction(()=>!rail.flyout.classList.contains('is-visible'));
    assert.equal(await page.evaluate(()=>rail.keyboardFocused),false,'Pointer departure clears retained keyboard selection');
    await page.locator('#before').focus();await page.keyboard.press('Tab');await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>rail.flyout.classList.contains('is-visible')),true,'Keyboard activation keeps its focused label available');
    await page.locator('.scrollspy-bookmark-button').click();
    await page.mouse.move(950,650);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>rail.flyout.classList.contains('is-visible')),true,'Resuming keyboard use cancels a pending pointer departure');
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
    // Unequal marks align independently of the rail's attachment side.
    await page.evaluate(() => {
      Object.assign(rail.settings, { hierarchyMode: 'all', tickWidth: 36, tickHeight: 4,
        levelIndent: 8, hoverStyle: 'none', activeBoost: 0, showSectionProgress: true });
      rail.activeIndex = 0; rail.render([1,2,3]); rail.paintActive(new Set([0]), 0); rail.paintProgress(0.25);
    });
    for (const side of ['left','right']) {
      for (const alignment of ['left','center','right']) {
        const coordinates=await page.evaluate(({side,alignment})=>{
          Object.assign(rail.settings,{side,markAlignment:alignment});rail.updatePresentation();
          return [...rail.el.querySelectorAll('.scrollspy-mark')].map(mark=>{
            const box=mark.getBoundingClientRect();
            return alignment==='center'?(box.left+box.right)/2:box[alignment];
          });
        },{side,alignment});
        assert.ok(Math.max(...coordinates)-Math.min(...coordinates)<0.5,`${side} rail / ${alignment} marks: ${coordinates}`);
      }
    }
    for (const direction of ['left','right','center']) {
      const fill=await page.evaluate(direction=>{
        rail.settings.progressDirection=direction;rail.updatePresentation();
        const mark=rail.el.querySelector('.is-current .scrollspy-mark');
        const css=getComputedStyle(mark,'::before');
        return {width:parseFloat(css.width),markWidth:mark.getBoundingClientRect().width,left:css.left,right:css.right,transform:css.transform};
      },direction);
      assert.ok(Math.abs(fill.width-fill.markWidth/4)<0.5,`${direction} keeps the progress fraction`);
      if(direction==='left')assert.equal(parseFloat(fill.left),0);
      if(direction==='right')assert.equal(parseFloat(fill.right),0);
      if(direction==='center'){
        assert.ok(Math.abs(parseFloat(fill.left)-fill.markWidth/2)<0.5);
        assert.notEqual(fill.transform,'none');
      }
    }
    await page.evaluate(()=>{
      Object.assign(rail.settings,{hoverStyle:'focus',animDuration:0});rail.updateSettings();
      rail.paintActive(new Set([0]),0);rail.setHovered(1);
    });
    await page.waitForTimeout(150);
    const focused=await page.evaluate(()=>[...rail.el.querySelectorAll('.scrollspy-mark')].map(mark=>{
      const css=getComputedStyle(mark);return {opacity:Number(css.opacity),outline:css.outlineStyle};
    }));
    assert.equal(focused[0].opacity,1,'Focus preserves the current heading');
    assert.equal(focused[1].opacity,1);
    assert.equal(focused[1].outline,'solid');
    assert.ok(focused[2].opacity<0.15,'Focus dims neighbours');
    await page.evaluate(()=>rail.onLeave());
    assert.equal(await page.locator('.scrollspy-rail').evaluate(el=>el.classList.contains('is-pointing')),false);
    await page.evaluate(()=>{
      Object.assign(rail.settings,{hoverStyle:'dot',expandHeight:14});rail.updateSettings();
      rail.keyboardFocused=true;rail.selectKeyboard(1);
    });
    const dot=await page.locator('.is-hover .scrollspy-mark').evaluate(mark=>{
      const box=mark.getBoundingClientRect();return {width:box.width,height:box.height,radius:getComputedStyle(mark).borderRadius};
    });
    assert.equal(dot.width,14);assert.equal(dot.height,14);assert.equal(dot.radius,'50%');
    assert.equal(await page.locator('.scrollspy-level').count(),0,'Dot has no heading badge text');
    await page.evaluate(()=>rail.dismissKeyboard());
    assert.equal(await page.locator('.scrollspy-rail').evaluate(el=>el.classList.contains('is-pointing')),false);
    assert.equal(await page.locator('.is-hover').count(),0,'Dismissal restores resting marks');
    await page.evaluate(()=>{
      rail.settings.hoverStyle='none';rail.updateSettings();
    });
    assert.equal(await page.locator('.hover-focus,.hover-dot').count(),0,'Switching styles clears effect classes');
    // Label motion has independent timing and remains immediately focusable.
    for(const side of ['left','right']) {
      const hidden=await page.evaluate(side=>{
        Object.assign(rail.settings,{side,labelMotion:'slide',labelDuration:0,showBookmarkButton:true});rail.updateSettings();rail.hideFlyout();
        return getComputedStyle(rail.flyout).transform;
      },side);
      assert.match(hidden,new RegExp(`, ${side==='left'?'-6':'6'},`),'Hidden slide starts toward the rail');
    }
    const opening=await page.evaluate(()=>{
      rail.settings.labelDuration=400;rail.plugin.applyStyles(rail);rail.showFlyout(1);
      rail.flyoutBookmark.focus();
      const css=getComputedStyle(rail.flyout);
      return {visibility:css.visibility,duration:css.transitionDuration,properties:css.transitionProperty,focused:document.activeElement===rail.flyoutBookmark};
    });
    assert.equal(opening.visibility,'visible');assert.equal(opening.focused,true);
    assert.match(opening.duration,/0.4s/);assert.match(opening.properties,/transform/);
    await page.waitForFunction(()=>Number(getComputedStyle(rail.flyout).opacity)===1);
    const restingTransform=await page.evaluate(()=>getComputedStyle(rail.flyout).transform);
    assert.match(restingTransform,/, 0,/,'Open label has no horizontal offset');
    await page.evaluate(()=>rail.hideFlyout());
    await page.waitForFunction(()=>getComputedStyle(rail.flyout).visibility==='hidden');
    await page.evaluate(()=>{rail.settings.labelMotion='none';rail.updateSettings();rail.showFlyout(1);});
    assert.equal(await page.evaluate(()=>getComputedStyle(rail.flyout).transitionDuration),'0s');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{rail.settings.labelMotion='slide';rail.updateSettings();rail.showFlyout(1);});
    assert.equal(await page.evaluate(()=>getComputedStyle(rail.flyout).transitionDuration),'0s');
    assert.match(await page.evaluate(()=>getComputedStyle(rail.flyout).transform),/, 0,/,'Reduced motion disables horizontal slide');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{
      Object.assign(rail.settings,{labelMotion:'none',labelMoveMotion:'slide',labelMoveDuration:400});
      rail.updateSettings();rail.showFlyout(0);
      rail.flyout.getBoundingClientRect();rail.showFlyout(2);
    });
    const moving=await page.evaluate(()=>({
      top:parseFloat(getComputedStyle(rail.flyout).top),target:parseFloat(rail.flyout.style.top),
      animations:rail.labelAnimations.length,index:rail.flyoutIndex,
    }));
    assert.equal(moving.index,2);assert.equal(moving.animations,1);
    assert.ok(Math.abs(moving.top-moving.target)>1,'Between-marks Slide animates the position');
    const retargeted=await page.evaluate(()=>{
      const before=parseFloat(getComputedStyle(rail.flyout).top);const previous=rail.labelAnimations[0];
      rail.showFlyout(1);
      return {before,after:parseFloat(getComputedStyle(rail.flyout).top),oldState:previous.playState};
    });
    assert.ok(Math.abs(retargeted.before-retargeted.after)<1,'Rapid movement starts from the visible position');
    assert.equal(retargeted.oldState,'idle');
    const existing=await page.evaluate(()=>{
      const animation=rail.labelAnimations[0];rail.showFlyout(1);return animation===rail.labelAnimations[0];
    });
    assert.equal(existing,true,'Refreshing the same heading does not restart motion');
    await page.evaluate(()=>rail.hideFlyout());
    assert.equal(await page.evaluate(()=>rail.labelAnimations.length),0);
    await page.evaluate(()=>{
      rail.settings.labelMoveMotion='none';rail.showFlyout(0);rail.showFlyout(2);
    });
    assert.equal(await page.evaluate(()=>rail.labelAnimations.length),0,'None switches between marks instantly');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{rail.settings.labelMoveMotion='slide';rail.hideFlyout();rail.showFlyout(0);rail.showFlyout(1);});
    assert.equal(await page.evaluate(()=>rail.labelAnimations.length),0,'Reduced motion disables between-mark effects');
    await page.emulateMedia({reducedMotion:'no-preference'});
    if (process.env.RAIL_SCREENSHOT) {
      await page.evaluate(() => { rail.keyboardFocused = true; rail.selectKeyboard(30); });
      await page.waitForTimeout(160);
      await page.screenshot({ path: process.env.RAIL_SCREENSHOT });
    }
    await page.evaluate(() => rail.destroy());
    assert.equal(await page.locator('[id$="-label"]').count(), 0, 'Accessible names are removed on unload');
    // Real DocumentRail navigation against a browser scroll container, with
    // source-heading positions deliberately different from equal allocations.
    for(const reading of [false,true]) {
      await page.evaluate(reading=>{
        const host=document.querySelector('#host');host.style.height='360px';
        const scroller=host.createDiv();Object.assign(scroller.style,{height:'300px',width:'500px',overflow:'auto'});
        scroller.createDiv().style.height='2100px';
        const headings=[10,20,80,95].map((line,index)=>({heading:`Synthetic ${index}`,level:1,position:{start:{line}}}));
        const view=new NativeMarkdownView();view.containerEl=host;view.file={path:'Synthetic.md'};
        view.app={metadataCache:{getFileCache:()=>({headings})}};view.getViewData=()=>Array(100).fill('synthetic').join('\n');
        const mode={type:reading?'preview':'source',getScroll:()=>scroller.scrollTop/(scroller.scrollHeight-scroller.clientHeight)*100,
          applyScroll(line){scroller.scrollTop=line/100*(scroller.scrollHeight-scroller.clientHeight);}};
        if(reading){mode.renderer={previewEl:scroller,onRendered(fn){fn();}};view.previewMode=mode;}else mode.cm={scrollDOM:scroller};
        view.currentMode=mode;
        const plugin=new module.exports();plugin.settings={...testAPI.DEFAULTS,trackingMode:'equal',hoverStyle:'none',hierarchyMode:'all',hideBelowWidth:0,minHeadings:1};
        plugin.applyStyles=module.exports.prototype.applyStyles;plugin.rails=new Map();plugin.refresh=()=>{};
        window.navigationCleanup=[];plugin.register=fn=>navigationCleanup.push(fn);
        window.documentRail=new testAPI.DocumentRail(plugin,view);plugin.rails.set(view,documentRail);documentRail.rebuild();
        plugin.installHeadingNavigation();window.navigationView=view;window.noteScroller=scroller;
      },reading);
      for(const mode of ['length','equal']) {
        await page.evaluate(mode=>{documentRail.plugin.settings.trackingMode=mode;documentRail.updateSettings();},mode);
        for(let index=0;index<4;index++) {
          const box=await page.locator('[role="option"]').nth(index).boundingBox();
          const bounds=await page.locator('[role="listbox"]').boundingBox();
          await page.mouse.click(bounds.x+bounds.width/2,box.y+box.height/2);
          assert.equal(await page.evaluate(()=>documentRail.activeIndex),index,`${mode}/${reading}: real click activates its mark`);
          await page.evaluate(index=>navigationView.setEphemeralState({subpath:`#Synthetic ${index}`,focus:true}),index);
          await page.waitForFunction(index=>documentRail.activeIndex===index,index);
          // Native jumps can already match some marks. Wait for the queued
          // correction as well before asserting its final scroll destination.
          await page.waitForFunction(()=>!documentRail.pendingNavigation);
          assert.equal(await page.evaluate(()=>documentRail.activeIndex),index,`${mode}/${reading}: bookmark final position activates its mark`);
        }
      }
      await page.evaluate(()=>{navigationCleanup.forEach(fn=>fn());documentRail.destroy();noteScroller.remove();});
    }
    console.log('Browser checks passed: 200 headings, every anchor/offset, resize, wheel/hover/click, full-range drag, single Tab stop, nested keyboard access, focus, labels, dismissal, color-mix.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
