import test from "node:test";
import assert from "node:assert/strict";
import { parseZotero } from "../test-dist/zotero-import.mjs";

test("imports Zotero BibTeX quick copy", () => {
  const [item] = parseZotero(
    `@article{smith2024,\n author = {Jane Smith and Wei Zhang},\n title = {Reliable Discovery},\n journal = {Science},\n year = {2024},\n doi = {10.1000/example}\n}`,
  );
  assert.equal(item.citeKey, "smith2024");
  assert.equal(item.authors, "Jane Smith; Wei Zhang");
  assert.equal(item.doi, "10.1000/example");
});

test("imports Zotero RIS quick copy", () => {
  const [item] = parseZotero(
    `TY  - JOUR\nAU  - Smith, Jane\nTI  - Reliable Discovery\nPY  - 2024\nJO  - Science\nDO  - 10.1000/example\nER  -`,
  );
  assert.equal(item.title, "Reliable Discovery");
  assert.equal(item.year, "2024");
});

test("imports CSL JSON", () => {
  const [item] = parseZotero(
    JSON.stringify({
      id: "smith2024",
      type: "article-journal",
      title: "Reliable Discovery",
      author: [{ given: "Jane", family: "Smith" }],
      issued: { "date-parts": [[2024]] },
    }),
  );
  assert.equal(item.citeKey, "smith2024");
  assert.equal(item.authors, "Jane Smith");
});
test("BibTeX handles single line entries, numeric year, nested title and multiple records", () => {
  const items = parseZotero(
    '@article{a, author={Smith, Jane}, title={A {Nested} title},year=2024}\n@book{b,title="Second",year=2025}',
  );
  assert.equal(items.length, 2);
  assert.equal(items[0].year, "2024");
  assert.equal(items[0].title, "A Nested title");
  assert.equal(items[1].year, "2025");
});
test("formatted prose without bibliographic evidence is not imported as a paper", () => {
  assert.deepEqual(parseZotero("这是一段普通文字，并不是参考文献。"), []);
});
