// Real touch tap regressions, including WebKit's compatibility mouse events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  for (const engine of ['chromium', 'webkit']) {
    const browser = await playwright[engine].launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:1024,height:768},hasTouch:true,isMobile:true});
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>#host{position:relative;width:800px;height:600px}</style><button id="before">Before</button><div id="host"></div>');
      // Obsidian's clickable-icon class fades SVG opacity on hover. The
      // bookmark action must stay steady while its label refreshes.
      await page.addStyleTag({content:`
        .clickable-icon svg { opacity: 0.5; transition: opacity 100ms ease-in-out; }
        .clickable-icon:hover svg { opacity: 1; }
      `});
      await page.addStyleTag({path:path.join(root,'styles.css')});
      await page.evaluate(() => {
        const p = HTMLElement.prototype;
        p.createDiv = function(o) { return this.createEl('div',o); };
        p.createSpan = function(o) { return this.createEl('span',o); };
        p.createEl = function(tag,o={}) { const el=document.createElement(tag);el.className=o.cls||'';el.textContent=o.text||'';this.append(el);return el; };
        p.empty = function() { this.replaceChildren(); };
        p.setText = function(text) { this.textContent=text; };
        p.addClass = function(c) { this.classList.add(c); };
        p.removeClass = function(c) { this.classList.remove(c); };
        p.toggleClass = function(c,v) { this.classList.toggle(c,v); };
        window.module={exports:{}};
        window.require=()=>({Plugin:class{},PluginSettingTab:class{},setIcon(){}});
      });
      await page.addScriptTag({content:fs.readFileSync(path.join(root,'main.js'),'utf8')+'\nwindow.api={RailView,DocumentRail,DEFAULTS,resolveCurrent,headingLandingStarts};'});
      await page.evaluate(() => {
        window.activations=[];
        class TouchRail extends api.RailView {
          labelFor(i) { return {title:`Heading ${i}`,percent:i}; }
          bookmarkState() { return {available:true,saved:!!window.saved}; }
          async bookmarkHeading() { window.saved=!window.saved; }
          activate(i) { activations.push(i);this.paintActive(new Set([i]),i); }
        }
        window.rail=new TouchRail({settings:{...api.DEFAULTS,hierarchyMode:'nearby',idleLevels:2},applyStyles:module.exports.prototype.applyStyles},document.querySelector('#host'));
        rail.render([1,2,3,3,2,3,1,2,3,2,1,2]);
      });
      // No sleeps between taps: each heading jump can change the visible hierarchy.
      for (const scrub of [true,false]) {
        await page.evaluate(scrub => {rail.settings.dragToScrub=scrub;rail.updateSettings();},scrub);
        for (let tap=0;tap<24;tap++) {
          const point=await page.evaluate(tap => {
            rail.measure();const visible=rail.centers.flatMap((y,i)=>y==null?[]:[{y,i}]);
            const target=visible[tap%visible.length],box=rail.el.getBoundingClientRect();
            return {x:box.left+box.width/2,y:target.y,index:target.i,count:activations.length};
          },tap);
          await page.touchscreen.tap(point.x,point.y);
          assert.deepEqual(await page.evaluate(count=>activations.slice(count),point.count),[point.index],`${engine}: rapid tap ${tap}, scrub ${scrub}`);
          assert.equal(await page.evaluate(()=>rail.keyboardFocused),false,`${engine}: tapping must not unfold keyboard hierarchy`);
        }
      }
      // Explicitly replay delayed compatibility events after a handled release.
      const delayed=await page.evaluate(() => {
        const count=activations.length;
        rail.el.focus();
        for(let i=0;i<3;i++) rail.el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientY:rail.el.getBoundingClientRect().bottom-5,detail:1}));
        return {extra:activations.length-count,keyboard:rail.keyboardFocused};
      });
      assert.deepEqual(delayed,{extra:0,keyboard:false},`${engine}: delayed focus/clicks cannot navigate again`);
      await page.locator('#before').focus();await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>rail.keyboardFocused),true,`${engine}: keyboard navigation still works after touch`);
      await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>activations.at(-1)),await page.evaluate(()=>rail.keyboardIndex));
      // A layout/active update during a press cannot move its original hit target.
      await page.evaluate(() => {
        rail.dismissKeyboard();rail.settings.dragToScrub=false;rail.updateSettings();rail.measure();
        const y=rail.centers.find(center=>center!=null);
        rail.startDrag({pointerType:'touch',pointerId:99,button:0,clientX:100,clientY:y,preventDefault(){}});
        const selected=rail.touch.index,before=rail.el.getBoundingClientRect().top;
        rail.paintActive(new Set([5]),5);
        if(rail.el.getBoundingClientRect().top!==before) throw Error('Pressed rail moved');
        rail.endDrag({pointerId:99,clientX:100,clientY:y});
        if(activations.at(-1)!==selected) throw Error('Pressed target changed');
      });
      // The icon registry stub deliberately provides no SVGs. An attached
      // pointer still gets a visible, working action on the touch-capable page.
      const pointer=await page.evaluate(()=>{
        rail.dismissKeyboard();rail.measure();const y=rail.centers.find(center=>center!=null),box=rail.el.getBoundingClientRect();
        return {x:box.left+box.width/2,y};
      });
      await page.mouse.move(pointer.x,pointer.y);
      await page.waitForFunction(()=>rail.flyout.classList.contains('is-visible'));
      const icon=page.locator('.scrollspy-bookmark-button svg');
      assert.equal(await icon.isVisible(),true,`${engine}: missing native icons get a visible fallback`);
      assert.equal(await icon.getAttribute('viewBox'),'0 0 24 24');
      assert.equal(await icon.evaluate(el=>getComputedStyle(el).width),'16px');
      assert.deepEqual(await icon.evaluate(el=>({opacity:getComputedStyle(el).opacity,duration:getComputedStyle(el).transitionDuration})),
        {opacity:'1',duration:'0s'},`${engine}: native icon hover fades cannot affect the bookmark`);
      assert.equal(await page.evaluate(()=>{
        const svg=rail.flyoutBookmark.querySelector('svg');
        for(let i=0;i<20;i++) rail.showFlyout(rail.flyoutIndex);
        return svg===rail.flyoutBookmark.querySelector('svg');
      }),true,`${engine}: repeated label updates retain the same SVG`);
      await page.locator('.scrollspy-bookmark-button').click();
      assert.equal(await page.evaluate(()=>window.saved),true);
      assert.equal(await icon.locator('path').last().getAttribute('d'),'m9 10 2 2 4-4');
      await page.locator('.scrollspy-bookmark-button').click();
      assert.equal(await page.evaluate(()=>window.saved),false);
      // Use a real scroll container: WebKit truncates near-integer scrollTop.
      const landing=await page.evaluate(()=>{
        const scroller=document.createElement('div');scroller.style.cssText='height:300px;overflow:auto';
        const content=document.createElement('div');content.style.height='1303px';scroller.append(content);document.body.append(scroller);
        const range=scroller.scrollHeight-scroller.clientHeight;
        const nav=Object.create(api.DocumentRail.prototype);nav.scroller=scroller;
        nav.plugin={settings:{...api.DEFAULTS,trackingMode:'length',lastAtBottom:false}};
        nav.headingLandingStarts=()=>[0,1/range,1];
        nav.syncActive=()=>{nav.activeIndex=api.resolveCurrent([0,1,100],101,nav.settings,
          {headingStarts:nav.headingLandingStarts(),progress:scroller.scrollTop/range,scrollable:true,atBottom:false});};
        nav.landAtHeading(1);
        const result={top:scroller.scrollTop,active:nav.activeIndex};
        // Also navigate actual adjacent leading headings using shared boundaries.
        nav.headingLandingStarts=()=>api.headingLandingStarts([0,18,36],range,300);
        for(const index of [0,1,2,1,0,2]) {
          nav.landAtHeading(index);
          if(nav.activeIndex!==index) throw Error(`Adjacent heading ${index} did not become active`);
        }
        scroller.remove();return result;
      });
      assert.deepEqual(landing,{top:1,active:1},`${engine}: normalized landing activates its own mark`);
      console.log(`${engine} touch checks passed: rapid taps, delayed focus/clicks, stable targets, keyboard recovery.`);
    } finally { await browser.close(); }
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
