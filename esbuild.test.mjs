import esbuild from "esbuild";
for (const name of ["markdown-options", "template-library", "cover-images"])
  await esbuild.build({
    loader: { ".csl": "text", ".xml": "text" },
    entryPoints: [`src/${name}.ts`],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: `test-dist/${name}.mjs`,
  });
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/citation-syntax.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/citation-syntax.mjs",
});
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/reference-library.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/reference-library.mjs",
});
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/media-layout.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/media-layout.mjs",
});
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/export-style.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/export-style.mjs",
});
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/citations.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/citations.mjs",
});
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/export-header.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/export-header.mjs",
});
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/zotero-import.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/zotero-import.mjs",
});
await esbuild.build({
  loader: { ".csl": "text", ".xml": "text" },
  entryPoints: ["src/vault-reference.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "test-dist/vault-reference.mjs",
});
