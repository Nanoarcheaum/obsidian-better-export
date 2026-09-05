import esbuild from "esbuild";
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["test/support/browser-entry.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  outfile: "test-dist/browser.js",
  alias: { obsidian: "./test/support/obsidian.ts" },
});
