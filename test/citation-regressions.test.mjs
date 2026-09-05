import test from "node:test";
import assert from "node:assert/strict";
import {
  citationTokens,
  citationProblems,
} from "../test-dist/citation-syntax.mjs";
import { citationKeys, renderCitations } from "../test-dist/citations.mjs";
import { mergeReferences } from "../test-dist/reference-library.mjs";
const ref = {
  citeKey: "张三2024研究",
  id: "a",
  authors: "张三",
  year: "2024",
  title: "研究",
  type: "article",
  container: "",
  doi: "10.1000/ABC",
  url: "",
  volume: "",
  issue: "",
  pages: "",
};
test("Chinese generated keys have the same contract as inserted and rendered citations", () => {
  assert.deepEqual(citationKeys("正文 [@张三2024研究]"), [ref.citeKey]);
  assert.deepEqual(citationProblems("正文 [@张三2024研究]", [ref.citeKey]), []);
  assert.doesNotMatch(
    renderCitations("正文 [@张三2024研究]", [ref], "apa7"),
    /\[@/,
  );
});
test("Markdown examples, frontmatter, comments, escaped and HTML code are not live citations", () => {
  const source =
    '---\ntitle: "[@front]"\n---\n`[@inline]`\n```md\n[@fenced]\n```\n\\[@escaped]\n<!-- [@comment] -->\n<pre>[@pre]</pre>\n<a title="[@attribute]">link</a>\n正文 [@live]';
  assert.deepEqual(citationKeys(source), ["live"]);
  assert.equal(citationTokens(source).length, 1);
});
test("empty, unsupported grouped, invalid keys and unclosed citations cannot pass audit", () => {
  assert.equal(
    citationProblems("[@ ] [@a; @b] [@bad/key] [@open", []).length,
    4,
  );
  assert.match(renderCitations("[@a; @b]", [], "apa7"), /不支持的引用语法/);
});
test("deduplication is shared by DOI and source and preserves inserted keys", () => {
  const library = [{ ...ref, sourcePath: "论文.md" }];
  const [same] = mergeReferences(library, [
    {
      ...ref,
      citeKey: "different",
      doi: "https://doi.org/10.1000/abc",
      pages: "12-15",
    },
  ]);
  assert.equal(library.length, 1);
  assert.equal(same.citeKey, ref.citeKey);
  assert.equal(same.pages, "12-15");
  const [bySource] = mergeReferences(library, [
    { ...ref, doi: "", sourcePath: "论文.md" },
  ]);
  assert.equal(bySource.id, ref.id);
});
test("APA disambiguates two works with identical authors and year across all citations", () => {
  const a = { ...ref, citeKey: "a", authors: "Jane Smith", title: "Alpha" },
    b = { ...ref, citeKey: "b", authors: "Jane Smith", title: "Beta" };
  const output = renderCitations(
    "First [@a]. Second [@b]. Again [@a].",
    [a, b],
    "apa7",
  );
  assert.match(output, /First \(Smith, 2024a\)/);
  assert.match(output, /Second \(Smith, 2024b\)/);
  assert.match(output, /Again \(Smith, 2024a\)/);
});
test("CSL author structure preserves institutional authors and complex names", () => {
  const output = renderCitations(
    "Result [@org].",
    [
      {
        ...ref,
        citeKey: "org",
        csl: { author: [{ literal: "Research Council" }] },
      },
    ],
    "chicago",
  );
  assert.match(output, /Research Council/);
  assert.doesNotMatch(output, /\[@/);
});
