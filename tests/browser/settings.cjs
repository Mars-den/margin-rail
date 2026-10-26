// Optional real-layout checks: PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser/settings.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent(`<style>
      :root { --background-primary:#202020; --background-secondary:#262626; --text-normal:#ddd;
        --text-muted:#aaa; --interactive-accent:#a78be0; --text-on-accent:#202020;
        --background-modifier-border:#383838; --background-modifier-hover:#333;
        --font-ui-small:13px; --font-ui-smaller:12px; --radius-m:8px; --layer-popover:10; }
      body { background:var(--background-primary); color:var(--text-normal); font:14px/1.45 system-ui; }
      #settings { max-width:680px; margin:auto; padding:20px; }
      .setting-item { display:flex; align-items:center; justify-content:space-between; border-top:1px solid #383838; padding:12px 0; gap:18px; }
      .setting-item-info { flex:1; } .setting-item-description { color:#aaa; font-size:12px; }
      .setting-item-control { display:flex; align-items:center; gap:8px; }
      .setting-item-heading { font-weight:600; } button,select,input { font:inherit; }
      button,select,input[type=text] { background:#303030; color:#ddd; border:1px solid #444; border-radius:5px; padding:6px 10px; }
      /* Obsidian's DropdownComponent applies a cached measured width. */
      .setting-item-control select.dropdown { width:var(--dropdown-fitted-width,inherit); }
      input[type=range] { accent-color:#a78be0; } h2 { font-size:22px; }
      .checkbox-container { width:28px; height:18px; background:#555; border-radius:10px; }
      .checkbox-container.is-enabled { background:#a78be0; }
    </style><div id="settings"></div>`);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'styles.css'), 'utf8') });
    await page.evaluate(() => {
      const p = HTMLElement.prototype;
      p.setCssStyles = function(styles) { Object.assign(this.style, styles); };
      p.setCssProps = function(props) { for (const [key,value] of Object.entries(props)) this.style.setProperty(key,value); };
      p.createDiv = function(o = {}) { return this.createEl('div', o); };
      p.createSpan = function(o = {}) { return this.createEl('span', o); };
      p.createEl = function(tag, o = {}) { const e = document.createElement(tag); e.className = o.cls || ''; e.textContent = o.text || ''; if(o.type)e.type=o.type; this.append(e); return e; };
      p.empty = function() { this.replaceChildren(); };
      p.setText = function(text) { this.textContent = text; };
      p.addClass = function(c) { this.classList.add(c); };
      p.removeClass = function(c) { this.classList.remove(c); };
      p.toggleClass = function(c,v) { this.classList.toggle(c,v); };
      class Component {
        constructor(el) { this.el=el; this.selectEl=el; }
        setValue(v) { if(this.el.type==='checkbox')this.el.checked=v;else this.el.value=v;return this; }
        addOption(k,v) { const o=new Option(v,k);this.el.add(o);return this; }
        addOptions(o) { for(const [k,v] of Object.entries(o))this.addOption(k,v);return this; }
        onChange(fn) { this.el.addEventListener(this.el.type==='text'?'input':'change',()=>fn(this.el.type==='checkbox'?this.el.checked:this.el.value));return this; }
        setPlaceholder(v) { this.el.placeholder=v;return this; }
        setButtonText(v) { this.el.textContent=v;return this; }
        setCta() { return this; } setWarning() { return this; }
        onClick(fn) { this.el.addEventListener('click',fn);return this; }
      }
      // Obsidian uses a focusable div for ToggleComponent, with no input.
      class Toggle {
        constructor(el) {
          this.toggleEl=el;el.tabIndex=0;el.setAttribute('role','checkbox');
          const toggle=()=>{this.setValue(!this.value);this.change?.(this.value);};
          el.addEventListener('click',toggle);
          el.addEventListener('keydown',event=>{
            if(event.key===' '||event.key==='Enter'){event.preventDefault();toggle();}
          });
        }
        setValue(value) {this.value=value;this.toggleEl.classList.toggle('is-enabled',value);this.toggleEl.setAttribute('aria-checked',String(value));return this;}
        onChange(fn) {this.change=fn;return this;}
      }
      class Setting {
        constructor(parent) { this.settingEl=parent.createDiv({cls:'setting-item'});this.info=this.settingEl.createDiv({cls:'setting-item-info'});this.name=this.nameEl=this.info.createDiv({cls:'setting-item-name'});this.desc=this.info.createDiv({cls:'setting-item-description'});this.controlEl=this.settingEl.createDiv({cls:'setting-item-control'}); }
        setName(v) { this.name.textContent=v;return this; } setDesc(v) { this.desc.textContent=v;return this; }
        setHeading() { this.settingEl.addClass('setting-item-heading');return this; }
        addDropdown(fn) { fn(new Component(this.controlEl.createEl('select',{cls:'dropdown'})));return this; }
        addToggle(fn) { fn(new Toggle(this.controlEl.createDiv({cls:'checkbox-container'})));return this; }
        addText(fn) { fn(new Component(this.controlEl.createEl('input',{type:'text'})));return this; }
        addButton(fn) { fn(new Component(this.controlEl.createEl('button')));return this; }
        addColorPicker(fn) { fn(new Component(this.controlEl.createEl('input',{type:'color'})));return this; }
      }
      class Menu {
        constructor(){this.items=[];}
        addItem(fn){const item={setTitle(v){this.title=v;return this;},setChecked(){return this;},onClick(fn){this.click=fn;return this;}};fn(item);this.items.push(item);return this;}
        showAtMouseEvent(){const menu=document.body.createDiv();menu.setAttribute('role','menu');for(const item of this.items){const b=menu.createEl('button',{text:item.title});b.setAttribute('role','menuitem');b.onclick=()=>{menu.remove();item.click();};}}
      }
      window.createEl = (tag, options) => document.body.createEl(tag, options);
      window.module = {exports:{}};
      window.testPlatform={isMacOS:true,isDesktopApp:true};
      window.require = () => ({Platform:testPlatform,Plugin:class {}, PluginSettingTab:class {constructor(){this.containerEl=document.querySelector('#settings');}},Setting,Menu,Notice:class {},setIcon(){}});
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'main.js'), 'utf8') + '\nwindow.settingsAPI={ScrollspySettingTab,DEFAULTS,SESSION_DEFAULTS};' });
    await page.evaluate(() => {
      const {ScrollspySettingTab,DEFAULTS,SESSION_DEFAULTS}=settingsAPI;
      window.plugin={settings:{...DEFAULTS,...SESSION_DEFAULTS,settingsSection:'hover'},applyStyles:module.exports.prototype.applyStyles,saveSettings(){},saveData(){}};
      window.tab=new ScrollspySettingTab({},plugin);tab.display();
    });
    assert.deepEqual(await page.getByRole('tab').allTextContents(),['Rail','Behaviour','Labels','Placement']);
    assert.equal(await page.locator('input[type=range]').count(),0,'No default sliders');
    assert.equal(await page.locator('.scrollspy-preset-chevron').evaluate(el=>{
      const box=el.getBoundingClientRect();
      return document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.tagName==='SELECT';
    }),true,'Preset chevron clicks reach the native select');
    assert.equal(await page.locator('.scrollspy-settings-header select').evaluate(el=>{
      const box=el.getBoundingClientRect();
      return [2,box.width-2].every(x=>[2,box.height-2].every(y=>document.elementFromPoint(box.x+x,box.y+y)===el));
    }),true,'Preset padding is part of the clickable select');
    assert.deepEqual(await page.locator('select[data-setting="trackingMode"] option').allTextContents(),['Section length · Recommended','Heading position','Equal scroll steps','Off']);
    const field = key => page.locator(`.setting-item[data-key="${key}"]`);
    const number = async (key,value) => {const input=field(key).locator('input[type=number]');await input.fill(String(value));await input.press('Tab');};
    const group = value => page.locator(`.scrollspy-settings-section[data-group="${value}"]`).scrollIntoViewIfNeeded();
    await group('navigation');
    const deviceHighlight=field('highlightOnNavigate').getByRole('checkbox');await deviceHighlight.check();
    assert.equal(await page.evaluate(()=>plugin.settings.activePreset),'default','Device edits do not dirty presets');
    // Real keyboard activation survives the redraw and reaches newly revealed controls.
    await group('tracking');
    await field('trackingMode').getByRole('combobox').focus();await page.keyboard.press('Tab');
    const sectionFill=()=>field('showSectionProgress').getByRole('checkbox');
    assert.equal(await sectionFill().evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(()=>plugin.settings.showSectionProgress),true);
    assert.equal(await sectionFill().evaluate(el=>el===document.activeElement),true,'Toggle redraw preserves keyboard focus');
    await page.keyboard.press('Tab');
    assert.equal(await field('progressDirection').getByRole('combobox').evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Shift+Tab');await page.keyboard.press('Space');
    assert.equal(await page.evaluate(()=>plugin.settings.showSectionProgress),false);
    assert.equal(await sectionFill().evaluate(el=>el===document.activeElement),true,'A second keyboard edit keeps focus');
    await page.keyboard.press('Tab');
    assert.equal(await field('activeMode').getByRole('combobox').evaluate(el=>el===document.activeElement),true);
    await page.getByRole('tab',{name:'Rail',exact:true}).click();
    await number('tickWidth',29);
    assert.equal(await page.evaluate(()=>plugin.settings.tickWidth),29);
    assert.equal(await page.locator('.scrollspy-settings-header option[value=custom]').count(),1);
    // Saving remains available in the one header menu.
    await page.getByRole('button',{name:'Preset options',exact:true}).click();
    await page.getByRole('menuitem',{name:'Save preset as…',exact:true}).click();
    await page.getByPlaceholder('Preset name').fill('Browser test');await page.getByRole('button',{name:'Save',exact:true}).click();
    await number('tickWidth',31);
    await page.getByRole('button',{name:'Update preset “Browser test”',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets[0].values.tickWidth),31);
    // Full presets leave device preferences alone.
    await page.locator('.scrollspy-settings-header select').selectOption('builtin-absolutely');
    assert.equal(await page.evaluate(()=>plugin.settings.highlightOnNavigate),true);
    assert.equal(await page.locator('select[data-setting=activePreset]').evaluate(el=>el===document.activeElement),true,'Preset changes preserve focus');
    await page.getByRole('button',{name:'Dot',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Dot',exact:true}).evaluate(el=>el===document.activeElement),true,'Shape changes preserve focus');
    assert.equal(await page.evaluate(()=>plugin.settings.tickWidth),6);
    await group('states');
    await page.locator('[data-group=states] select').first().selectOption('hover');
    assert.equal(await page.locator('select[data-setting=settingsState]').evaluate(el=>el===document.activeElement),true,'Editing-state changes preserve focus');
    await number('pointedOpacity',65);
    assert.equal(await page.evaluate(()=>plugin.settings.pointedOpacity),.65);
    await page.locator('[data-group=states] select').first().selectOption('idle');
    assert.equal(await field('idleColorMode').locator('option[value=inherit]').count(),0,'Idle has no transparent inherit choice');
    // Previously saved presets remain usable and display a valid base colour.
    await page.evaluate(()=>{
      plugin.settings.presets.push({id:'legacy-idle',name:'Legacy idle',values:{idleColorMode:'inherit'}});
      tab.display();
    });
    await page.locator('.scrollspy-settings-header select').selectOption('legacy-idle');
    assert.equal(await page.evaluate(()=>plugin.settings.idleColorMode),'text');
    assert.equal(await field('idleColorMode').getByRole('combobox').inputValue(),'text');
    assert.equal(await page.locator('.scrollspy-stage .scrollspy-mark').last().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(221, 221, 221)');
    // Native scrolling moves the note; the preview rail uses the same geometry.
    const note=page.locator('.scrollspy-preview-note');
    await note.evaluate(el=>el.scrollTop=0);
    await page.waitForFunction(()=>document.querySelector('.scrollspy-preview-progress').textContent==='0%');
    await note.hover();await page.mouse.wheel(0,200);
    await page.waitForFunction(()=>document.querySelector('.scrollspy-preview-note').scrollTop>100);
    // Inspect every group at desktop and phone widths, checking a stable control edge.
    for(const width of [800,390]) {
      await page.setViewportSize({width,height:1000});
      for(const tab of ['Rail','Behaviour','Labels','Placement']) {
        await page.getByRole('tab',{name:tab,exact:true}).click();
        assert.equal(await page.locator('#scrollspy-group').count(),0,'Sections are visible without a group picker');
        const sections=page.locator('.scrollspy-settings-section');
        assert.ok(await sections.count()>=2);
        for(let index=0;index<await sections.count();index++) {
          const section=sections.nth(index);
          await section.scrollIntoViewIfNeeded();
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${tab} at ${width}`);
          assert.ok(await section.locator('.setting-item').count()>0);
          assert.equal(await section.getByRole('heading').count(),1);
          if(index===0 && width===800) {
            const preview=await page.locator('.scrollspy-preview-column').boundingBox();
            const box=await section.boundingBox();
            assert.ok(Math.abs(box.y-preview.y)<1 && box.x>preview.x+preview.width,'Main controls sit beside the preview');
          }
          if(index>0) {
            const full=await page.locator('.scrollspy-workbench-body').boundingBox();
            const box=await section.boundingBox();
            assert.ok(Math.abs(box.x-full.x)<1 && Math.abs(box.width-full.width)<1,'Sections below the preview use the full width');
          }
        }
      }
    }
    // CSS uses the same effective settings for geometry and hit testing.
    await page.setViewportSize({width:800,height:1000});
    await page.addStyleTag({content:'body { --margin-rail-mark-width: 24px; }'});
    await page.getByRole('tab',{name:'Rail',exact:true}).click();
    await group('shape');
    assert.equal(await field('tickWidth').getByRole('spinbutton').isDisabled(),true);
    assert.equal(await page.evaluate(()=>tab.preview.settings.tickWidth),24);
    // Export/import uses validated preset data and keeps device settings out.
    await page.getByRole('button',{name:'Preset options',exact:true}).click();
    await page.getByRole('menuitem',{name:'CSS snippets and preset JSON…',exact:true}).click();
    await group('json');
    const json=page.getByRole('textbox',{name:'Preset JSON',exact:true});
    const exported=JSON.parse(await json.inputValue());
    assert.equal('highlightOnNavigate' in exported.values,false);assert.equal('phoneVisibility' in exported.values,false);
    await json.fill(JSON.stringify({...exported,values:{...exported.values,tickWidth:900}}));
    await page.getByRole('button',{name:'Load as preset',exact:true}).click();
    assert.match(await page.getByRole('alert').innerText(),/Out of range/);
    await json.fill(JSON.stringify({...exported,name:'Imported'}));
    await page.getByRole('button',{name:'Load as preset',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets.at(-1).name),'Imported');
    assert.equal(await page.evaluate(()=>plugin.settings.highlightOnNavigate),true);
    // Placeholder content stays out of the rail's expanded lane on either side.
    for (const width of [800,390]) {
      await page.setViewportSize({width,height:1000});
      for (const side of ['left','right']) {
        await page.evaluate(side=>{
          Object.assign(plugin.settings,settingsAPI.DEFAULTS,{side,settingsSection:'appearance'});
          tab.filesOpen=false;tab.display();
        },side);
        assert.equal(await page.locator('.scrollspy-preview-note p').count(),0);
        assert.ok(await page.locator('.scrollspy-sample-line').count()>0);
        const mark=page.locator('.scrollspy-stage .scrollspy-mark').first();
        const box=await mark.boundingBox();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(250);
        const clear=await page.evaluate(side=>{
          const mark=document.querySelector('.scrollspy-stage .scrollspy-mark').getBoundingClientRect();
          return [...document.querySelectorAll('.scrollspy-sample-line')].every(line=>{
            const box=line.getBoundingClientRect();
            return side==='left'?box.left>=mark.right+8:box.right<=mark.left-8;
          });
        },side);
        assert.equal(clear,true,`Placeholder and expanded rail stay separate: ${side}, ${width}`);
        if(width===800) assert.equal(await page.locator('.scrollspy-stage').evaluate(el=>el.clientHeight),300);
      }
    }
    // Native declarative rendering remains searchable and owns its preview cleanup.
    await page.evaluate(() => {
      tab.hide();tab.containerEl.empty();
      const definitions = tab.getSettingDefinitions();
      window.nativeDefinition = definitions[0];
      window.nativeCleanup = nativeDefinition.render(new (require().Setting)(tab.containerEl));
    });
    assert.ok((await page.evaluate(()=>nativeDefinition.aliases)).includes('bookmark'));
    assert.equal(await page.locator('.scrollspy-workbench-host .scrollspy-stage').count(),1);
    await page.getByRole('tab',{name:'Labels',exact:true}).click();
    assert.equal(await page.locator('.scrollspy-stage').count(),1,'Internal redraw stays inside the native definition host');
    await page.setViewportSize({width:800,height:1000});
    await page.getByRole('tab',{name:'Rail',exact:true}).click();
    if(process.env.RAIL_SETTINGS_SCREENSHOT) await page.screenshot({path:process.env.RAIL_SETTINGS_SCREENSHOT,fullPage:true});
    await page.evaluate(()=>nativeCleanup());
    assert.equal(await page.evaluate(()=>tab.preview),null,'Native cleanup releases the latest preview after internal redraw');
    assert.deepEqual(errors,[]);await page.evaluate(()=>tab.hide());
    console.log('Workbench checks passed: visible sections, exact controls, presets, isolated device preferences, native scrolling, CSS geometry, validated JSON, and phone/desktop layouts.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
