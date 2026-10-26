import { context } from "esbuild";
import { builtinModules } from "node:module";

const watch = process.argv.includes("--watch");
const build = await context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2021",
  external: [
    "obsidian",
    "electron",
    ...builtinModules,
    ...builtinModules.map((name) => `node:${name}`),
  ],
  outfile: "main.js",
  sourcemap: watch ? "inline" : false,
  banner: {
    js: "/* Generated from src/main.ts by esbuild. Edit src/, not this file. */",
  },
  footer: { js: "module.exports = module.exports.default;" },
});
if (watch) await build.watch();
else {
  try {
    await build.rebuild();
  } finally {
    await build.dispose();
  }
}
