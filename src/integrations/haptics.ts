const MAC_HAPTIC_SCRIPT = String.raw`
ObjC.import("AppKit");
var input = $.NSFileHandle.fileHandleWithStandardInput;
var output = $.NSFileHandle.fileHandleWithStandardOutput;
output.writeData($("ready\n").dataUsingEncoding($.NSUTF8StringEncoding));
while (true) {
  var data = input.readDataOfLength(1);
  if (!data.length) break;
  $.NSHapticFeedbackManager.defaultPerformer.performFeedbackPatternPerformanceTime(
    $.NSHapticFeedbackPatternAlignment, $.NSHapticFeedbackPerformanceTimeNow);
}
`;

class MacDragHaptics {
  declare spawn: any;
  declare now: () => number;
  declare child: any;
  declare owner: any;
  declare failed: boolean;
  declare ready: boolean;
  declare lastTick: number;
  declare startupTimer: NodeJS.Timeout | null;

  constructor(spawn: any, now: any = () => Date.now()) {
    this.spawn = spawn;
    this.now = now;
    this.child = null;
    this.owner = null;
    this.failed = false;
  }

  begin(owner: any) {
    this.end();
    if (this.failed) return;
    this.owner = owner;
    this.ready = false;
    this.lastTick = -Infinity;
    try {
      const child = (this.child = this.spawn(
        "/usr/bin/osascript",
        ["-l", "JavaScript", "-e", MAC_HAPTIC_SCRIPT],
        { stdio: ["pipe", "pipe", "ignore"], windowsHide: true },
      ));
      let output = "";
      child.stdout.on("data", (data: any) => {
        if (this.child !== child) return;
        output += data.toString();
        if (output.includes("ready\n")) {
          this.ready = true;
          if (this.startupTimer) clearTimeout(this.startupTimer);
          this.startupTimer = null;
        }
      });
      const fail = () => {
        if (this.child !== child) return;
        this.failed = true;
        this.end();
      };
      child.on("error", fail);
      child.on("exit", fail);
      child.stdin.on("error", fail);
      this.startupTimer = setTimeout(fail, 2000);
    } catch (_) {
      this.failed = true;
      this.end();
    }
  }

  tick(owner: any) {
    if (owner !== this.owner || !this.ready || !this.child?.stdin.writable)
      return;
    const now = this.now();
    if (now - this.lastTick < 80 || this.child.stdin.writableLength) return;
    this.lastTick = now;
    try {
      this.child.stdin.write("t");
    } catch (_) {
      this.failed = true;
      this.end();
    }
  }

  end(owner?: unknown) {
    if (owner && owner !== this.owner) return;
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.startupTimer = null;
    const child = this.child;
    this.child = null;
    this.owner = null;
    this.ready = false;
    if (child) {
      child.stdin.destroy();
      child.kill();
    }
  }
}

export { MAC_HAPTIC_SCRIPT, MacDragHaptics };
