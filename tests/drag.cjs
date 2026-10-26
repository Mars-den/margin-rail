const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../main.js'), 'utf8');
const platform={isMacOS:true,isDesktopApp:true};
const context={module:{exports:{}},setTimeout,clearTimeout,cancelAnimationFrame(){},require(){
  return{Plugin:class{},PluginSettingTab:class{},Platform:platform};
}};
vm.createContext(context);
vm.runInContext(source+'\nmodule.exports.internals={RailView,SESSION_DEFAULTS,PRESET_KEYS,sectionDragProgress,dragSnapStrength,sampleDragSpeed};',context);
const Plugin=context.module.exports;
const {RailView,SESSION_DEFAULTS,PRESET_KEYS}=Plugin.internals;
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
console.log('Drag checks passed: section landings, monotonic detents, speed adaptation, reversal, and paused drags.');
