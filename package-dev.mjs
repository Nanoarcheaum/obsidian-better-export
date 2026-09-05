import fs from "node:fs/promises";
import path from "node:path";
const root = path.dirname(
  new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"),
);
const project = JSON.parse(await fs.readFile("package.json", "utf8"));
const manifest = JSON.parse(await fs.readFile("manifest.json", "utf8"));
if (project.version !== manifest.version) throw Error("Version mismatch");
const destination = path.resolve(
  "release",
  `better-export-${project.version}`,
  "better-export",
);
if (!destination.startsWith(path.resolve("release") + path.sep))
  throw Error("Invalid destination");
await fs.mkdir(destination, { recursive: true });
await fs.cp("docs", path.join(destination, "docs"), { recursive: true });
for (const file of [
  "main.js",
  "manifest.json",
  "styles.css",
  "README.md",
  "THIRD_PARTY.md",
  "CHANGELOG.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "versions.json",
])
  await fs.copyFile(file, path.join(destination, file));
const source = path.join(destination, "source");
await fs.mkdir(source, { recursive: true });
for (const folder of ["src", "test", "docs", ".github"])
  await fs.cp(folder, path.join(source, folder), { recursive: true });
for (const file of [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "esbuild.config.mjs",
  "esbuild.test.mjs",
  "esbuild.browser.mjs",
  "playwright.config.mjs",
  "package-dev.mjs",
  "manifest.json",
  "versions.json",
  "styles.css",
  "README.md",
  "LICENSE",
  "THIRD_PARTY.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
])
  await fs.copyFile(file, path.join(source, file));
const vendor = path.join(destination, "third-party", "citeproc");
await fs.mkdir(vendor, { recursive: true });
for (const file of [
  "LICENSE",
  "README.rst",
  "package.json",
  "citeproc_commonjs.js",
])
  await fs.copyFile(
    path.join("node_modules", "citeproc", file),
    path.join(vendor, file),
  );
console.log(destination);
