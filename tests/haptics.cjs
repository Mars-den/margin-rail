const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');
let nodeImports=0;
const platform={isMacOS:true,isDesktopApp:true};
const context={module:{exports:{}},setTimeout,clearTimeout,cancelAnimationFrame(){},require(name){
  if(name==='child_process'){nodeImports++;return{spawn:fakeSpawn};}
  return{Plugin:class{},PluginSettingTab:class{},Platform:platform};
}};
vm.createContext(context);
vm.runInContext(source+'\nmodule.exports.internals={MacDragHaptics,MAC_HAPTIC_SCRIPT,RailView,SESSION_DEFAULTS,PRESET_KEYS,sectionDragProgress,dragSnapStrength,sampleDragSpeed};',context);
const Plugin=context.module.exports;
const {MacDragHaptics,MAC_HAPTIC_SCRIPT,RailView,SESSION_DEFAULTS,PRESET_KEYS}=Plugin.internals;
const {sectionDragProgress}=Plugin.internals;
const centers=[100,200,300],ranges=[{start:0,end:.1},{start:.1,end:.9},{start:.9,end:1}];
for(const [y,index] of [[100,0],[149,0],[150,1],[200,1],[249,1],[250,2],[300,2]]) {
  const progress=sectionDragProgress(y,centers,ranges,100,300);
  const current=ranges.findIndex(range=>progress<range.end);
  assert.equal(current<0?2:current,index,'Unequal scroll ranges follow the mark under the cursor');
}
assert.equal(sectionDragProgress(150,centers,ranges,100,300),.1,'Crossing a mark band snaps to its heading landing');
assert.equal(sectionDragProgress(160,centers,ranges,100,300),.1,'Small detent holds the landing briefly');
let previous=0;
for(let y=100;y<=300;y+=.1) {
  const value=sectionDragProgress(y,centers,ranges,100,300);
  assert.ok(value>=previous,'Drag mapping remains monotonic across detents');previous=value;
}
const {dragSnapStrength,sampleDragSpeed}=Plugin.internals;
assert.equal(dragSnapStrength(1),1,'Slow reading retains the full heading hold');
assert.equal(dragSnapStrength(10),0,'Fast skimming removes the heading hold');
assert.ok(dragSnapStrength(4)>dragSnapStrength(6),'Feedback fades continuously across medium speeds');
assert.ok(Math.abs(sectionDragProgress(160,centers,ranges,100,300,0)-.18)<1e-12,'Fast dragging moves through the entrance without stopping');
const motion={position:0,time:0,speed:0};
assert.ok(sampleDragSpeed(motion,3,100)<.05,'Fast movement promptly suppresses feedback');
const restored=sampleDragSpeed(motion,3.01,130);
assert.ok(restored<1,'Slowing does not abruptly restore full snapping');
assert.equal(sampleDragSpeed(motion,3.02,1500),1,'Gentle movement restores snapping');
// A change in speed must not reverse scroll direction or move a paused drag.
const speedRail=Object.create(RailView.prototype);
speedRail.levels=[1,1,1];speedRail.dense=false;speedRail.dragRanges=()=>ranges;
speedRail.prepareDragTrack=()=>{};
let clock=0;speedRail.dragNow=()=>clock;
speedRail.drag={centers,start:100,end:300,prepared:true,motion:{position:0,time:0,speed:0}};
let last=0;
for(const [y,time] of [[120,20],[160,40],[170,600],[171,1200],[180,1800],[200,2400]]) {
  clock=time;const progress=speedRail.dragProgressAt(y);
  assert.ok(progress>=last,'Restoring a heading hold never scrolls backwards');last=progress;
}
clock+=1000;assert.equal(speedRail.dragProgressAt(200),last,'Pausing/releasing never pulls the note back to a detent');
clock+=100;assert.ok(speedRail.dragProgressAt(180)<=last,'Reversing the pointer can scroll backwards normally');
new vm.Script(MAC_HAPTIC_SCRIPT); // Embedded JXA must retain its escaped newline.
assert.equal(SESSION_DEFAULTS.macDragHaptics,false);
assert.ok(!PRESET_KEYS.includes('macDragHaptics'),'Device haptics are independent of presets');
const children=[];
function fakeSpawn(command,args,options){
  assert.equal(command,'/usr/bin/osascript');assert.equal(args[0],'-l');assert.equal(args[1],'JavaScript');
  assert.equal(args[3],MAC_HAPTIC_SCRIPT);assert.equal(options.shell,undefined,'Native code is a fixed argument, never a shell command');
  const child=new EventEmitter();child.stdout=new EventEmitter();child.stdin=new EventEmitter();
  Object.assign(child.stdin,{writable:true,writableLength:0,writes:[],write(value){this.writes.push(value);},destroy(){this.writable=false;}});
  child.kill=()=>{child.killed=true;};children.push(child);return child;
}
let time=1000;
const backend=new MacDragHaptics(fakeSpawn,()=>time),one={},two={};
backend.begin(one);const first=children.at(-1);
backend.tick(one);assert.equal(first.stdin.writes.length,0,'Never queue ticks while starting');
first.stdout.emit('data',Buffer.from('rea'));assert.equal(backend.ready,false);
first.stdout.emit('data',Buffer.from('dy\n'));assert.equal(backend.ready,true);
backend.tick(two);assert.equal(first.stdin.writes.length,0,'Other panes cannot trigger ticks');
backend.tick(one);assert.deepEqual(first.stdin.writes,['t']);
time+=20;backend.tick(one);assert.equal(first.stdin.writes.length,1,'Fast crossings are coalesced without delayed playback');
time+=80;backend.tick(one);assert.equal(first.stdin.writes.length,2);
time+=100;first.stdin.writableLength=1;backend.tick(one);assert.equal(first.stdin.writes.length,2,'Drop a tick instead of queuing behind backpressure');
backend.end(two);assert.equal(first.killed,undefined);
backend.begin(two);const second=children.at(-1);assert.equal(first.killed,true,'New drag stops the previous native helper');
first.stdout.emit('data',Buffer.from('ready\n'));assert.equal(backend.ready,false,'Stale helper cannot mark a new drag ready');
second.stdout.emit('data',Buffer.from('ready\n'));backend.end(two);backend.tick(two);
assert.equal(second.killed,true);assert.equal(second.stdin.writes.length,0,'Release cancels pending feedback');
backend.begin(one);children.at(-1).stdin.emit('error',new Error('EPIPE'));assert.equal(backend.failed,true);
const count=children.length;backend.begin(one);assert.equal(children.length,count,'Failed native support leaves dragging usable without respawning');
const plugin=new Plugin();plugin.settings={macDragHaptics:false};plugin.beginDragHaptics(one);assert.equal(nodeImports,0);
plugin.settings.macDragHaptics=true;platform.isDesktopApp=false;plugin.beginDragHaptics(one);assert.equal(nodeImports,0,'Mobile never imports Node');
platform.isDesktopApp=true;platform.isMacOS=false;plugin.beginDragHaptics(one);assert.equal(nodeImports,0,'Other desktops never launch the Mac helper');
platform.isMacOS=true;plugin.beginDragHaptics(one);assert.equal(nodeImports,1);plugin.endDragHaptics(one);
// Only scrubbing as part of a drag emits section-crossing ticks.
const rail=Object.create(RailView.prototype),ticks=[];
rail.activeIndex=0;rail.plugin={tickDragHaptics:owner=>ticks.push(owner)};
rail.scrubTo=progress=>{rail.activeIndex=Math.floor(progress*4);};rail.drag={hapticIndex:0};
rail.scrubDragTo(.1);assert.equal(ticks.length,0);
rail.scrubDragTo(.3);assert.equal(ticks.length,1);
rail.scrubDragTo(.4);assert.equal(ticks.length,1);
rail.scrubDragTo(.9);assert.equal(ticks.length,2,'Crossing several sections in one frame produces one tick');
rail.scrubDragTo(.3);assert.equal(ticks.length,3,'Reverse dragging also ticks');
rail.drag.strength=0;rail.scrubDragTo(.8);assert.equal(ticks.length,3,'Fast section crossings suppress haptic feedback');
rail.drag=null;rail.scrubTo(.8);assert.equal(ticks.length,3,'Ordinary scrolling and click navigation never tick');
(async()=>{
  if(process.platform==='darwin'&&process.env.RAIL_NATIVE_HAPTIC_CHECK==='1') {
    // Tests the actual macOS bridge; physical sensation needs a trackpad user.
    const native=new MacDragHaptics(spawn);native.begin(one);
    try {
      await new Promise((resolve,reject)=>{
        const started=Date.now();
        const check=()=>{
          if(native.ready)return resolve();
          if(native.failed||Date.now()-started>2500)return reject(Error('Native AppKit haptic bridge failed to start'));
          setTimeout(check,20);
        };check();
      });
      native.tick(one);
      await new Promise(resolve=>setTimeout(resolve,100));
      assert.equal(native.failed,false,'Native tick call runs without error');
    } finally {native.end(one);}
  }
  console.log('Haptics checks passed: default off, platform guards, fixed native script, readiness, rate limiting, backpressure, section crossings, reversal, cancellation, supersession, and failure cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
