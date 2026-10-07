// Optional real-layout checks: PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser/settings.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
  const browser = await chromium.launch({ headless: true });
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
    </style><div id="settings"></div>`);
    await page.addStyleTag({ content: fs.readFileSync(path.join(root, 'styles.css'), 'utf8') });
    await page.evaluate(() => {
      const p = HTMLElement.prototype;
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
      class Setting {
        constructor(parent) { this.settingEl=parent.createDiv({cls:'setting-item'});this.info=this.settingEl.createDiv({cls:'setting-item-info'});this.name=this.info.createDiv({cls:'setting-item-name'});this.desc=this.info.createDiv({cls:'setting-item-description'});this.controlEl=this.settingEl.createDiv({cls:'setting-item-control'}); }
        setName(v) { this.name.textContent=v;return this; } setDesc(v) { this.desc.textContent=v;return this; }
        setHeading() { this.settingEl.addClass('setting-item-heading');return this; }
        addDropdown(fn) { fn(new Component(this.controlEl.createEl('select',{cls:'dropdown'})));return this; }
        addToggle(fn) { fn(new Component(this.controlEl.createEl('input',{type:'checkbox'})));return this; }
        addText(fn) { fn(new Component(this.controlEl.createEl('input',{type:'text'})));return this; }
        addButton(fn) { fn(new Component(this.controlEl.createEl('button')));return this; }
        addColorPicker(fn) { fn(new Component(this.controlEl.createEl('input',{type:'color'})));return this; }
      }
      class Menu {
        constructor(){this.items=[];}
        addItem(fn){const item={setTitle(v){this.title=v;return this;},setChecked(){return this;},onClick(fn){this.click=fn;return this;}};fn(item);this.items.push(item);return this;}
        showAtMouseEvent(){const menu=document.body.createDiv();menu.setAttribute('role','menu');for(const item of this.items){const b=menu.createEl('button',{text:item.title});b.setAttribute('role','menuitem');b.onclick=()=>{menu.remove();item.click();};}}
      }
      window.module = {exports:{}};
      window.require = () => ({Plugin:class {}, PluginSettingTab:class {constructor(){this.containerEl=document.querySelector('#settings');}},Setting,Menu,Notice:class {},setIcon(){}});
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'main.js'), 'utf8') + '\nwindow.settingsAPI={ScrollspySettingTab,DEFAULTS,SESSION_DEFAULTS};' });
    await page.evaluate(() => {
      const {ScrollspySettingTab,DEFAULTS,SESSION_DEFAULTS}=settingsAPI;
      window.plugin={settings:{...DEFAULTS,...SESSION_DEFAULTS,settingsSection:'hover',showAdvanced:true},applyStyles:module.exports.prototype.applyStyles,saveSettings(){},saveData(){}};
      window.tab=new ScrollspySettingTab({},plugin);tab.display();
    });
    const checkUpdateAlignment = async () => {
      const alignment = await page.locator('.scrollspy-preset-update').evaluate(group => {
        const update = group.firstElementChild, target = group.lastElementChild;
        const textCenter = element => {
          const range = document.createRange();
          range.selectNodeContents(element.firstChild);
          const box = range.getBoundingClientRect();
          return box.top + box.height / 2;
        };
        return { delta: Math.abs(textCenter(update) - textCenter(target)),
          heightDelta: Math.abs(update.getBoundingClientRect().height - target.getBoundingClientRect().height) };
      });
      assert.ok(alignment.delta < 1, `Update text alignment: ${JSON.stringify(alignment)}`);
      assert.ok(alignment.heightDelta < 1, 'Split control halves have equal heights');
    };
    assert.equal(await page.locator('.scrollspy-preset-update').isVisible(),false);
    assert.deepEqual(await page.getByRole('tab').allTextContents(), ['Rail','Behaviour','Labels','Placement']);
    assert.equal(await page.getByRole('tab', {name:'Behaviour',exact:true}).getAttribute('aria-selected'), 'true');
    await page.locator('select[data-setting="hoverStyle"]').selectOption('pill');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.setting), 'hoverStyle');
    assert.equal(await page.locator('.scrollspy-panel').getByText('Opened thickness',{exact:true}).count(),1);
    await page.getByRole('tab',{name:'Rail',exact:true}).click();
    await page.getByRole('slider',{name:'Pointer nearby',exact:true}).fill('0.25');
    assert.equal(await page.evaluate(() => plugin.settings.hoverOpacity),.25);
    assert.equal(await page.getByRole('slider',{name:'Pointer nearby',exact:true}).getAttribute('aria-valuetext'),'25%');
    await page.locator('.scrollspy-settings-header select').selectOption('builtin-absolutely');
    assert.equal(await page.evaluate(() => plugin.settings.side),'left');
    // Built-in starting points are updateable even without any saved presets.
    for(const value of ['19','20','21','22'])await page.getByRole('slider',{name:'Length',exact:true}).fill(value);
    assert.equal(await page.locator('.scrollspy-settings-header option[value=custom]').count(),1);
    assert.equal(await page.evaluate(()=>plugin.settings.presets.length),0);
    await page.getByRole('button',{name:'Update preset “Absolutely”',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets.length),1);
    assert.equal(await page.evaluate(()=>plugin.settings.presets[0].values.tickWidth),22);
    assert.equal(await page.locator('.scrollspy-settings-header option[value=custom]').count(),0);
    await page.getByRole('slider',{name:'Length',exact:true}).fill('23');
    await page.getByRole('button',{name:'Update preset “Absolutely”',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets.length),1);
    // Keep the original test scenario independent.
    await page.evaluate(()=>{plugin.settings.presets=[];plugin.settings.activePreset='builtin-absolutely';plugin.settings.sourcePresetId=null;tab.updateTargetId=null;tab.display();});

    assert.equal(await page.getByRole('slider',{name:'Pointer nearby',exact:true}).inputValue(),'0.25');
    await page.getByText('Save as…',{exact:true}).click();
    await page.getByPlaceholder('Preset name').fill('Browser test');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    assert.equal(await page.evaluate(() => plugin.settings.presets[0].name),'Browser test');
    assert.equal(await page.locator('.scrollspy-preset-manager').getAttribute('open'),'');
    // The source survives edits, tab changes, and reopening the settings tab.
    await page.getByRole('slider',{name:'Length',exact:true}).fill('29');
    assert.equal(await page.evaluate(() => plugin.settings.activePreset),'custom');
    assert.equal(await page.locator('.scrollspy-update-target').textContent(),'Browser test');
    assert.equal(await page.locator('.scrollspy-update-chevron').count(),0);
    await page.evaluate(()=>{tab.hide();tab=new settingsAPI.ScrollspySettingTab({},plugin);tab.display();});
    await page.getByRole('button',{name:'Update preset “Browser test”',exact:true}).click();
    assert.equal(await page.evaluate(() => plugin.settings.presets[0].values.tickWidth),29);
    // A second destination can be selected without loading over the edits.
    await page.evaluate(()=>{plugin.settings.presets.push({id:'other',name:'Other',values:{...settingsAPI.DEFAULTS,tickWidth:12}});tab.display();});
    await page.getByRole('slider',{name:'Length',exact:true}).fill('35');
    await checkUpdateAlignment();
    await page.getByRole('button',{name:'Choose preset to update; currently “Browser test”',exact:true}).click();
    await page.getByRole('menuitem',{name:'Other',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.tickWidth),35);
    await page.getByRole('button',{name:'Update preset “Other”',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets.find(p=>p.id==='other').values.tickWidth),35);
    assert.equal(await page.evaluate(()=>plugin.settings.presets[0].values.tickWidth),29);
    assert.equal(await page.evaluate(()=>plugin.settings.activePreset),'other');
    await page.getByRole('tab',{name:'Labels',exact:true}).click();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'Placement',exact:true}).getAttribute('aria-selected'),'true');
    // Same-name presets are never mistaken for copies of a built-in.
    await page.evaluate(()=>{
      plugin.settings.presets=[{id:'handmade',name:'Quiet',values:{...settingsAPI.DEFAULTS,tickWidth:55}}];
      tab.updateTargetId=null;tab.display();
    });
    await page.locator('.scrollspy-settings-header select').selectOption('builtin-quiet');
    await page.getByRole('tab',{name:'Rail',exact:true}).click();
    await page.getByRole('slider',{name:'Length',exact:true}).fill('31');
    await page.getByRole('button',{name:'Update preset “Quiet”',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets.find(p=>p.id==='handmade').values.tickWidth),55);
    assert.equal(await page.evaluate(()=>plugin.settings.presets.find(p=>p.originBuiltinId==='builtin-quiet').values.tickWidth),31);
    // Re-select the built-in and reopen the tab: its copy is found by origin ID.
    await page.locator('.scrollspy-settings-header select').selectOption('builtin-quiet');
    await page.evaluate(()=>{tab.hide();tab=new settingsAPI.ScrollspySettingTab({},plugin);tab.display();});
    await page.getByRole('slider',{name:'Length',exact:true}).fill('32');
    await page.getByRole('button',{name:'Update preset “Quiet”',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets.length),2);
    assert.equal(await page.evaluate(()=>plugin.settings.presets.find(p=>p.originBuiltinId==='builtin-quiet').values.tickWidth),32);
    // An unknown legacy source requires a choice, even with just one preset.
    await page.evaluate(()=>{
      plugin.settings.presets=plugin.settings.presets.filter(p=>p.id==='handmade');
      plugin.settings.activePreset='custom';plugin.settings.sourcePresetId=null;
      tab.hide();tab=new settingsAPI.ScrollspySettingTab({},plugin);tab.display();
    });
    assert.equal(await page.getByRole('button',{name:'Update preset',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Choose preset to update',exact:true}).click();
    await page.getByRole('menuitem',{name:'Quiet',exact:true}).click();
    await page.getByRole('button',{name:'Update preset “Quiet”',exact:true}).click();
    assert.equal(await page.evaluate(()=>plugin.settings.presets[0].values.tickWidth),32);
    // Deleting the source must not silently select the next saved preset.
    await page.evaluate(()=>{
      plugin.settings.presets.push({id:'survivor',name:'Survivor',values:{...settingsAPI.DEFAULTS,tickWidth:44}});
      tab.display();document.querySelector('.scrollspy-preset-manager').open=true;
    });
    await page.getByRole('button',{name:'Preset options',exact:true}).click();
    await page.getByRole('menuitem',{name:'Delete “Quiet”',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Update preset',exact:true}).isDisabled(),true);
    assert.equal(await page.evaluate(()=>plugin.settings.presets[0].values.tickWidth),44);
    await page.getByPlaceholder('Preset name').fill('bb');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    // A stale Obsidian measurement must not clip even a two-letter name.
    await page.locator('.scrollspy-settings-header select').evaluate(select=>select.style.setProperty('--dropdown-fitted-width','28px'));
    assert.ok(await page.locator('.scrollspy-settings-header select').evaluate(select=>{
      const context=document.createElement('canvas').getContext('2d');
      context.font=getComputedStyle(select).font;
      return select.getBoundingClientRect().width>=context.measureText('bb').width+36;
    }), 'bb remains visible despite a stale fitted dropdown width');
    assert.equal(await page.locator('.scrollspy-preset-update').isVisible(),false);
    // A name that fits the pane must not be truncated by a fixed control cap.
    await page.getByPlaceholder('Preset name').fill('My carefully tuned reading configuration');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    assert.equal(await page.locator('.scrollspy-preset-update').isVisible(),false);
    const pickerFits = await page.locator('.scrollspy-settings-header select').evaluate(select=>{
      const canvas=document.createElement('canvas'), context=canvas.getContext('2d');
      context.font=getComputedStyle(select).font;
      return context.measureText(select.selectedOptions[0].text).width+36<=select.getBoundingClientRect().width;
    });
    assert.equal(pickerFits,true,'Selected preset can use the available header width');
    await page.getByPlaceholder('Preset name').fill('A very long custom preset name '.repeat(3));
    await page.getByRole('button',{name:'Save',exact:true}).click();
    // Keep management expanded while checking long names on small screens.
    for(const width of [800,390]) {
      await page.setViewportSize({width,height:1000});
      for(const name of ['Rail','Behaviour','Labels','Placement']) {
        await page.getByRole('tab',{name,exact:true}).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,`${name} overflow at ${width}`);
      }
    }
    await page.setViewportSize({width:800,height:1000});
    await page.getByRole('tab',{name:'Rail',exact:true}).click();
    const captured = await page.evaluate(() => JSON.stringify(tab.capture()));
    await page.getByRole('button',{name:'Normal',exact:true}).click();
    assert.equal(await page.evaluate(() => JSON.stringify(tab.capture())),captured,'Mode changes preserve every preset value');
    assert.equal(await page.locator('select[data-setting="markLength"]').inputValue(),'custom');
    await page.locator('select[data-setting="markLength"]').selectOption('extended');
    assert.equal(await page.evaluate(() => plugin.settings.tickWidth),18);
    await page.getByRole('button',{name:'Advanced',exact:true}).click();
    await page.getByRole('spinbutton',{name:'Length value',exact:true}).fill('19');
    await page.getByRole('spinbutton',{name:'Length value',exact:true}).press('Tab');
    await page.getByRole('button',{name:'Normal',exact:true}).click();
    assert.equal(await page.locator('select[data-setting="markLength"]').inputValue(),'custom');
    await page.getByRole('button',{name:'Advanced',exact:true}).click();
    await page.getByRole('spinbutton',{name:'Length value',exact:true}).fill('18');
    await page.getByRole('spinbutton',{name:'Length value',exact:true}).press('Tab');
    await page.getByRole('button',{name:'Normal',exact:true}).click();
    assert.equal(await page.locator('select[data-setting="markLength"]').inputValue(),'extended','Matching numeric values restore the named choice');
    // Group choices match only when every underlying value matches.
    await page.locator('select[data-setting="markShape"]').selectOption('rounded');
    await page.getByRole('button',{name:'Advanced',exact:true}).click();
    await page.getByRole('slider',{name:'Corner radius',exact:true}).fill('1.5');
    await page.getByRole('button',{name:'Normal',exact:true}).click();
    assert.equal(await page.locator('select[data-setting="markShape"]').inputValue(),'custom');
    await page.locator('select[data-setting="markAlignment"]').selectOption('center');
    assert.equal(await page.locator('.scrollspy-stage .scrollspy-rail').getAttribute('data-mark-alignment'),'center');
    await page.getByRole('tab',{name:'Behaviour',exact:true}).click();
    await page.locator('select[data-setting="hoverResponse"]').selectOption('focus');
    assert.equal(await page.locator('.scrollspy-stage .scrollspy-rail').evaluate(el=>el.classList.contains('hover-focus')),true);
    await page.locator('select[data-setting="hoverResponse"]').selectOption('dot');
    assert.equal(await page.evaluate(()=>plugin.settings.expandHeight),10);
    await page.getByRole('button',{name:'Advanced',exact:true}).click();
    assert.equal(await page.locator('select[data-setting="hoverStyle"]').inputValue(),'dot');
    await page.getByRole('spinbutton',{name:'Dot diameter value',exact:true}).fill('14');
    await page.getByRole('spinbutton',{name:'Dot diameter value',exact:true}).press('Tab');
    await page.getByRole('button',{name:'Normal',exact:true}).click();
    assert.equal(await page.locator('select[data-setting="hoverResponse"]').inputValue(),'custom');
    await page.locator('select[data-setting="hoverResponse"]').selectOption('dot');
    const progressRow=page.locator('.setting-item').filter({has:page.getByText('Show progress within the section',{exact:true})});
    await progressRow.getByRole('checkbox').check();
    await page.locator('select[data-setting="progressDirection"]').selectOption('right');
    assert.equal(await page.locator('.scrollspy-stage .scrollspy-rail').getAttribute('data-progress-direction'),'right');
    await page.locator('select[data-setting="progressDirection"]').selectOption('center');
    await page.getByRole('tab',{name:'Labels',exact:true}).click();
    const markDuration=await page.evaluate(()=>plugin.settings.animDuration);
    await page.locator('select[data-setting="labelMotion"]').selectOption('none');
    assert.equal(await page.locator('select[data-setting="labelSpeed"]').count(),0);
    await page.locator('select[data-setting="labelMotion"]').selectOption('slide');
    await page.locator('select[data-setting="labelSpeed"]').selectOption('relaxed');
    assert.equal(await page.evaluate(()=>plugin.settings.labelDuration),400);
    assert.equal(await page.evaluate(()=>plugin.settings.animDuration),markDuration,'Label speed is independent of mark speed');
    assert.equal(await page.locator('.scrollspy-stage .scrollspy-flyout').getAttribute('data-label-motion'),'slide');
    await page.getByRole('button',{name:'Advanced',exact:true}).click();
    await page.getByRole('spinbutton',{name:'Show and hide duration value',exact:true}).fill('340');
    await page.getByRole('spinbutton',{name:'Show and hide duration value',exact:true}).press('Tab');
    await page.getByRole('button',{name:'Normal',exact:true}).click();
    assert.equal(await page.locator('select[data-setting="labelSpeed"]').inputValue(),'custom');
    await page.locator('select[data-setting="labelMoveMotion"]').selectOption('slide');
    await page.locator('select[data-setting="labelMoveSpeed"]').selectOption('smooth');
    assert.equal(await page.evaluate(()=>plugin.settings.labelMoveDuration),220);
    assert.equal(await page.evaluate(()=>plugin.settings.labelDuration),340,'Between-marks speed preserves show/hide speed');
    assert.deepEqual(await page.locator('select[data-setting="labelMoveMotion"] option').allTextContents(),['None','Slide']);
    assert.equal(await page.evaluate(()=>plugin.settings.labelMotion),'slide','Between-marks effect preserves show/hide effect');
    await page.getByRole('button',{name:'Advanced',exact:true}).click();
    await page.getByRole('spinbutton',{name:'Between marks duration value',exact:true}).fill('180');
    await page.getByRole('spinbutton',{name:'Between marks duration value',exact:true}).press('Tab');
    await page.getByRole('button',{name:'Normal',exact:true}).click();
    assert.equal(await page.locator('select[data-setting="labelMoveSpeed"]').inputValue(),'custom');
    await page.locator('.scrollspy-settings-header select').selectOption('builtin-progress');
    assert.equal(await page.evaluate(()=>plugin.settings.labelMotion),'none');
    assert.equal(await page.evaluate(()=>plugin.settings.labelMoveMotion),'none');
    await page.locator('.scrollspy-settings-header select').selectOption('builtin-absolutely');
    assert.equal(await page.evaluate(()=>plugin.settings.labelMotion),'slide');
    assert.equal(await page.evaluate(()=>plugin.settings.labelMoveMotion),'slide');
    for (const width of [800,390]) {
      await page.setViewportSize({width,height:1000});
      for (const name of ['Rail','Behaviour','Labels','Placement']) {
        await page.getByRole('tab',{name,exact:true}).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth>innerWidth),false,`Normal ${name} overflow at ${width}`);
      }
    }
    await page.setViewportSize({width:800,height:1000});
    await page.getByRole('tab',{name:'Rail',exact:true}).click();
    if(process.env.SETTINGS_SCREENSHOT)await page.screenshot({path:process.env.SETTINGS_SCREENSHOT,fullPage:true});
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>tab.hide());
    console.log('Settings browser checks passed: one unsaved option, explicit update destinations, built-in origin IDs, same-name safety, deleted/legacy sources, keyboard focus, long-name narrow layout.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
