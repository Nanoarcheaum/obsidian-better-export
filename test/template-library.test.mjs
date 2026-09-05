import test from "node:test";
import assert from "node:assert/strict";
import {
  captureGlobal,
  applyGlobal,
  deleteFurniture,
  currentHeader,
} from "../test-dist/template-library.mjs";
import {
  blankHeader,
  fillHeaderText,
  headerFields,
} from "../test-dist/export-header.mjs";
import { DEFAULT_PROFILE } from "../test-dist/export-style.mjs";
import { prepareWikiLinks } from "../test-dist/markdown-options.mjs";
const state = () => ({
  headerTemplates: [],
  coverTemplates: [],
  globalTemplates: [],
  documentHeaderIds: {},
  documentCoverIds: {},
  documentHeaderSnapshots: {},
  documentCoverSnapshots: {},
  documentHeaderValues: {},
  documentCoverValues: {},
  documentProfiles: {},
  documentCitationOptions: {},
  references: [],
});
test("deleting shared template retains isolated document snapshots", () => {
  const s = state(),
    h = blankHeader();
  s.headerTemplates.push(h);
  s.documentHeaderIds = { a: h.id, b: h.id };
  deleteFurniture(s, "header", h.id);
  assert.equal(s.headerTemplates.length, 0);
  assert.equal(currentHeader(s, "a").id, h.id);
  currentHeader(s, "a").name = "edited";
  assert.notEqual(currentHeader(s, "b").name, "edited");
});
test("global template round trips all options without shared mutable objects", () => {
  const s = state(),
    h = blankHeader();
  s.headerTemplates.push(h);
  s.documentHeaderIds.a = h.id;
  s.documentHeaderValues.a = { title: "Test" };
  const t = captureGlobal(
    s,
    "a",
    "Whole",
    { ...DEFAULT_PROFILE, bodySize: 19, wikiLinkMode: "text" },
    { style: "apa7", placement: "bibliography" },
  );
  h.name = "changed";
  assert.notEqual(t.header.name, h.name);
  applyGlobal(s, "b", t);
  assert.equal(s.documentProfiles.b.bodySize, 19);
  assert.equal(s.documentProfiles.b.wikiLinkMode, "text");
  assert.equal(s.documentHeaderValues.b.title, "Test");
  currentHeader(s, "b").name = "local";
  assert.notEqual(t.header.name, "local");
});
test("TeX braces survive field expansion in headers and covers", () => {
  const text = String.raw`{{name}} $\frac{{a}}{{b}}$`;
  assert.equal(
    fillHeaderText(text, { name: "Ada" }),
    String.raw`Ada $\frac{{a}}{{b}}$`,
  );
  const h = blankHeader();
  h.rows[0].cells[0].text = text;
  assert.deepEqual(headerFields(h), ["name"]);
});
test("wiki source output preserves code, math, escaped syntax and image embeds", () => {
  const source =
    "[[Page|Label]] ![[image.png]] `[[code]]` $[[math]]$ \\[[escaped]]\n```md\n[[code]]\n```";
  const output = prepareWikiLinks(source, "source");
  assert.equal((output.match(/better-export-wiki-source/g) || []).length, 1);
  assert.ok(output.includes("![[image.png]]"));
  assert.ok(output.includes("`[[code]]`"));
  assert.equal(prepareWikiLinks(source, "text"), source);
});
