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
  '\nmodule.exports.internals={DEFAULTS,DocumentRail,headingNavigationProgress,resolveCurrent,headingLandingStarts,sectionProgress};', context);
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
  rail.headingBounds=index=>({top:headingLines[index]*5,bottom:headingLines[index]*5+24});
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
    const {rail,view,scroller,render}=fixture(mode,reading);
    for(let index=0;index<headings.length;index++) {
      rail.activate(index);render();flushFrame();flushFrame();
      assert.equal(rail.activeIndex,index,`${mode}/${reading?'reading':'source'}: clicked mark becomes current`);
      assert.equal(scroller.style.scrollBehavior,'smooth','Temporary instant scroll restores theme behavior');
      assert.equal(view.jumpedLine,undefined,'Measured headings go directly to the landing without a native double jump');
      const landed=scroller.scrollTop;
      rail.activate(index);render();flushFrame();flushFrame();
      assert.equal(scroller.scrollTop,landed,'Repeated clicks retain the same final position');
      assert.equal(view.jumpedLine,undefined,'Repeated clicks never reveal and correct again');
    }
    const before=scroller.scrollTop;rail.activate(-1);rail.activate(99);assert.equal(scroller.scrollTop,before);
  }
}
for(const mode of ['position','off']) {
  const {rail,view}=fixture(mode);rail.activate(2);assert.equal(view.jumpedLine,80,'Physical navigation stays native');
  assert.equal(headingNavigationProgress(headingLines,100,mode,2),null);
}
// Landing preferences: remain in the active mark's range, preserve heading
// visibility, and prefer a small gap above the heading rather than mid-section.
const landing=(index,top,bottom,height=200)=>headingNavigationProgress([0,10,90],100,'length',index,
  {scrollRange:1000,viewportHeight:height,headingTop:top,headingBottom:bottom,preferredTop:top,lastAtBottom:true})*1000;
assert.equal(landing(1,100,124),100,'Long section lands at its heading, not its midpoint');
assert.equal(landing(1,400,424),376,'Prefer 24px of breathing room when the range permits it');
const nearBottom=headingNavigationProgress([0,25,50,75],100,'equal',1,
  {scrollRange:1000,viewportHeight:400,headingTop:800,headingBottom:824,preferredTop:800,lastAtBottom:true})*1000;
assert.equal(nearBottom,499,'Use the closest safe range edge when the heading cannot reach the top');
assert.ok(800>=nearBottom && 824<=nearBottom+400,'The complete heading remains visible');
assert.equal(headingNavigationProgress([0,25,50,75],100,'equal',1,
  {scrollRange:1000,viewportHeight:100,headingTop:50,headingBottom:74,preferredTop:50,lastAtBottom:true}),0.25,
  'When visibility and tracking cannot overlap, use the nearest range edge');
for(const mode of ['length','equal'])for(let index=0;index<headingLines.length;index++) {
  const progress=headingNavigationProgress(headingLines,100,mode,index,
    {scrollRange:800,viewportHeight:200,headingTop:headingLines[index]*5,headingBottom:headingLines[index]*5+24,preferredTop:headingLines[index]*5,lastAtBottom:true});
  assert.equal(context.module.exports.internals.resolveCurrent(headingLines,100,{...DEFAULTS,trackingMode:mode},
    {progress,scrollable:true,atBottom:800-progress*800<=2,first:0}),index,'Landing remains active under the unchanged rule');
}
// Rendered section tracking uses the same top-aligned anchors for clicking,
// scrolling and progress, independent of Markdown source-line proportions.
{
  const {headingLandingStarts,resolveCurrent,sectionProgress}=Plugin.internals;
  const starts=headingLandingStarts([0,400,900,1300],1400);
  assert.deepEqual(Array.from(starts),[0,376/1400,876/1400,1276/1400]);
  const settings={...DEFAULTS,trackingMode:'length',lastAtBottom:false};
  for(let index=0;index<starts.length;index++) {
    const viewport={headingStarts:starts,progress:starts[index],scrollable:true,atBottom:false};
    assert.equal(resolveCurrent(headingLines,100,settings,viewport),index);
    assert.equal(sectionProgress(headingLines,100,settings,viewport,index),0);
    if(index>0)assert.equal(resolveCurrent(headingLines,100,settings,{...viewport,progress:starts[index]-0.001}),index-1);
  }
  const trailing=headingLandingStarts([0,1000,1100,1200],1000);
  assert.deepEqual(Array.from(trailing),[0,0.9,0.95,1]);
  assert.ok(trailing.every((value,index)=>index===0||value>trailing[index-1]),'Trailing headings keep distinct attainable boundaries');
  const empty=headingLandingStarts([0,500,530,560,1000],1200,400);
  assert.deepEqual(Array.from(empty),[0,408/1200,472/1200,536/1200,976/1200]);
  for(let index=1;index<4;index++) {
    assert.ok((empty[index+1]-empty[index])*1200>=63.99,'Empty template headings receive useful scroll intervals');
    assert.equal(resolveCurrent(headingLines.concat(99),100,settings,
      {headingStarts:empty,progress:empty[index]+20/1200,scrollable:true,atBottom:false}),index);
    assert.ok([0,500,530,560,1000][index]+24-empty[index]*1200<=400,'Borrowed range keeps the heading visible');
  }
}
// Consecutive headings at the start trade breathing room for distinct ranges.
{
  const {headingLandingStarts,resolveCurrent}=Plugin.internals;
  for (const tops of [[0,18,36,1000],[0,21.5,43,1000]]) {
    const starts=headingLandingStarts(tops,1200,300);
    starts.forEach((start,index)=>{
      if(index) assert.ok(start>starts[index-1],'Adjacent leading headings have distinct ranges');
      assert.ok(start*1200<=tops[index],'A leading heading stays visible');
      assert.equal(resolveCurrent([0,1,2,50],100,{...DEFAULTS,trackingMode:'length',lastAtBottom:false},
        {headingStarts:starts,progress:start,scrollable:true,atBottom:false}),index);
    });
  }
}
// Model WebKit flooring scrollTop: integer landing survives normalization.
for (const mode of ['length','equal']) {
  const {rail,scroller}=fixture(mode);
  scroller.scrollHeight=1203;
  let top=0;
  Object.defineProperty(scroller,'scrollTop',{get:()=>top,set:value=>top=Math.floor(value)});
  for(let pixel=1;pixel<1000;pixel++) {
    rail.scrubTo(pixel/1003,true);
    assert.equal(scroller.scrollTop,pixel,`${mode}: exact landing pixel ${pixel}`);
  }
}
// Reading-mode virtualization preserves section offsets without mounted DOM.
{
  const {rail,view}=fixture('length',true);
  delete rail.headingBounds;
  const sections=headings.map((heading,index)=>({lineStart:heading.position.start.line,
    lineEnd:heading.position.start.line,height:50,el:{querySelectorAll:()=>[]}}));
  view.currentMode.renderer={sections,topSpace:12,getSectionTop:section=>sections.indexOf(section)*200};
  assert.equal(rail.headingBounds(2).top,412);
  assert.equal(rail.headingLandingStarts()[2],388/800);
  view.currentMode.renderer.topSpace=32;
  assert.equal(rail.headingLandingStarts()[2],408/800,'Layout changes update tracking boundaries');
  const starts=Plugin.internals.headingLandingStarts([0,400.4,900.8],1000);
  assert.equal(starts[1]*1000,377,'Fractional heading geometry rounds to a safe attainable scroll position');
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
    rail.activate(3);render();flushFrame();flushFrame();
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
