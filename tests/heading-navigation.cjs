const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
class MarkdownView {
  setEphemeralState(state) { this.nativeState = state; return 'native result'; }
}
const context = { require: () => ({ Plugin: class {}, PluginSettingTab: class {}, MarkdownView,
  resolveSubpath(cache, subpath) {
    const heading = cache.headings.find(item => `#${item.heading}` === subpath);
    return heading ? { type: 'heading', start: heading.position.start } : null;
  } }), module: { exports: {} } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8') +
  '\nmodule.exports.internals={DEFAULTS,DocumentRail,headingNavigationProgress};', context);
const Plugin = context.module.exports;
const { DEFAULTS, DocumentRail, headingNavigationProgress } = Plugin.internals;
const headingLines = [10, 20, 80, 95];
const headings = headingLines.map((line, index) => ({heading: `Heading ${index}`,position:{start:{line}}}));
const frames = new Map(); let nextFrame = 0;
const win = { requestAnimationFrame(fn) { frames.set(++nextFrame,fn);return nextFrame; },
  cancelAnimationFrame(id) { frames.delete(id); } };
const flushFrame = () => { const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn()); };
function fixture(mode, reading = false) {
  const plugin = new Plugin();plugin.settings={...DEFAULTS,trackingMode:mode};plugin.rails=new Map();
  const view = new MarkdownView();view.file={path:'Synthetic.md'};
  view.app={metadataCache:{getFileCache:()=>({headings})}};
  let rendered;
  const scroller={style:{scrollBehavior:'smooth'},scrollTop:0,scrollHeight:1000,clientHeight:200};
  const nativeMode={applyScroll(line){view.jumpedLine=line;scroller.scrollTop=line*5;}};
  if(reading)nativeMode.renderer={onRendered(callback){rendered=callback;}};
  view.currentMode=nativeMode;
  const rail=Object.create(DocumentRail.prototype);
  Object.assign(rail,{plugin,view,headings,lines:Array(100).fill(''),sourceReady:true,scroller,host:{ownerDocument:{defaultView:win}}});
  rail.attachScroller=()=>{};rail.scrollTopLine=()=>scroller.scrollTop/5;
  rail.visibleRange=()=>[rail.scrollTopLine(),rail.scrollTopLine()+20];
  rail.paintActive=(active,current)=>{rail.activeIndex=current;};rail.paintProgress=()=>{};
  plugin.rails.set(view,rail);plugin.refresh=()=>{};
  const cleanup=[];plugin.register=fn=>cleanup.push(fn);
  return {plugin,view,rail,scroller,cleanup,render(){rendered?.();}};
}
// Physical/source positions deliberately disagree with the scroll allocations.
for (const mode of ['length','equal']) {
  for (const reading of [false,true]) {
    const {rail,view,scroller}=fixture(mode,reading);
    for(let index=0;index<headings.length;index++) {
      rail.activate(index);
      assert.equal(rail.activeIndex,index,`${mode}/${reading?'reading':'source'}: clicked mark becomes current`);
      assert.equal(scroller.style.scrollBehavior,'smooth','Temporary instant scroll restores theme behavior');
      assert.equal(view.jumpedLine,undefined,'Allocation navigation does not perform a conflicting source-line jump');
    }
    const before=scroller.scrollTop;rail.activate(-1);rail.activate(99);assert.equal(scroller.scrollTop,before);
  }
}
for(const mode of ['position','off']) {
  const {rail,view}=fixture(mode);rail.activate(2);assert.equal(view.jumpedLine,80,'Physical navigation stays native');
  assert.equal(headingNavigationProgress(headingLines,100,mode,2),null);
}
const original=MarkdownView.prototype.setEphemeralState;
for(const mode of ['length','equal']) {
  for(const reading of [false,true]) {
    const {plugin,view,rail,cleanup,render}=fixture(mode,reading);
    plugin.installHeadingNavigation();
    // This is the same heading subpath state Obsidian supplies when opening a bookmark.
    const state={subpath:'#Heading 2',focus:true};
    assert.equal(view.setEphemeralState(state),'native result');
    assert.equal(view.nativeState,state,'Focus/history/cursor state is passed through unchanged');
    render();flushFrame();flushFrame();
    assert.equal(rail.activeIndex,2,`${mode}: bookmark opening uses the clicked mark's allocation`);
    view.setEphemeralState({subpath:'#Heading 1'});render();
    view.setEphemeralState({subpath:'#Heading 3'});render();flushFrame();flushFrame();
    assert.equal(rail.activeIndex,3,'A newer navigation supersedes the previous queued jump');
    view.setEphemeralState({subpath:'#Heading 0'});render();
    view.file={path:'Other.md'};flushFrame();flushFrame();
    assert.equal(rail.activeIndex,3,'Queued navigation cannot move a different file');
    view.file={path:'Synthetic.md'};
    rail.sourceReady=false;view.setEphemeralState({subpath:'#Heading 1'});render();flushFrame();flushFrame();
    assert.ok(rail.pendingNavigation,'Wait for source data before computing length allocations');
    rail.sourceReady=true;rail.syncActive();assert.equal(rail.activeIndex,1);
    view.setEphemeralState({subpath:'#Heading 0'});render();
    view.setEphemeralState({subpath:'#^block-id'});flushFrame();flushFrame();
    assert.equal(rail.activeIndex,1,'A block link cancels a pending heading allocation');
    view.setEphemeralState({subpath:'#Heading 0'});render();
    view.setEphemeralState({scroll:50});flushFrame();flushFrame();
    assert.equal(rail.activeIndex,1,'History restoration cancels a pending heading allocation');
    view.setEphemeralState({subpath:'#Heading 0'});render();
    rail.activate(3);flushFrame();flushFrame();
    assert.equal(rail.activeIndex,3,'A rail click supersedes a queued bookmark jump');
    const before=rail.activeIndex;
    view.setEphemeralState({subpath:'#^block-id'});render();flushFrame();flushFrame();assert.equal(rail.activeIndex,before);
    view.setEphemeralState({subpath:'#Missing'});render();flushFrame();flushFrame();assert.equal(rail.activeIndex,before);
    view.setEphemeralState({scroll:50});render();flushFrame();flushFrame();assert.equal(rail.activeIndex,before);
    cleanup.forEach(fn=>fn());assert.equal(MarkdownView.prototype.setEphemeralState,original,'Unload restores the native method');
  }
}
// Preserve wrappers installed by another plugin after ours, and disable our
// behavior if it remains in that plugin's call chain during unload.
{
  const {plugin,view,rail,cleanup}=fixture('equal');plugin.installHeadingNavigation();
  const wrapped=MarkdownView.prototype.setEphemeralState;
  const other=function(state){return wrapped.call(this,state);};
  MarkdownView.prototype.setEphemeralState=other;cleanup.forEach(fn=>fn());
  assert.equal(MarkdownView.prototype.setEphemeralState,other);
  view.setEphemeralState({subpath:'#Heading 2'});assert.equal(rail.pendingNavigation,undefined);
  MarkdownView.prototype.setEphemeralState=original;
}
console.log('Heading navigation checks passed: tracking inverse, every mark, both modes, bookmark subpaths, native state, late source, supersession, stale files, and hook cleanup.');
