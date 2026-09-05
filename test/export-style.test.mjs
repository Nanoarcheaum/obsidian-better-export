import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROFILE,
  buildExportCss,
  presetProfile,
} from "../test-dist/export-style.mjs";

test("generates paged academic CSS", () => {
  const css = buildExportCss(DEFAULT_PROFILE);
  assert.match(css, /@page \{ size: A4 portrait/);
  assert.match(css, /h1 \{ font-size: 24pt/);
  assert.match(css, /break-inside: avoid/);
});

test("provides visibly distinct export presets", () => {
  assert.equal(presetProfile("manuscript").lineHeight, 2);
  assert.equal(presetProfile("report").bodyFont, "source-sans");
});
