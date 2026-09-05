import test from "node:test";
import assert from "node:assert/strict";
import {
  bibliographyEntry,
  citationKeys,
  renderCitations,
  stripCitationTokens,
} from "../test-dist/citations.mjs";

const reference = {
  id: "1",
  citeKey: "smith2024",
  type: "article",
  authors: "Jane Smith; Wei Zhang",
  year: "2024",
  title: "Reliable Discovery",
  container: "Science",
  volume: "12",
  issue: "3",
  pages: "1-9",
  doi: "10.1000/example",
  url: "",
};

test("extracts unique Pandoc citation keys", () => {
  assert.deepEqual(
    citationKeys("A [@smith2024]. B [@doe2020, p. 2]. Again [@smith2024]."),
    ["smith2024", "doe2020"],
  );
});

test("renders citations and appends a bibliography", () => {
  const output = renderCitations("Finding [@smith2024].", [reference], "apa7");
  assert.match(output, /\(Smith &#38; Zhang, 2024\)/);
  assert.match(output, /## References/);
  assert.match(output, /https:\/\/doi.org\/10.1000\/example/);
});

test("formats GB-T 7714 document markers", () => {
  assert.match(bibliographyEntry(reference, "gb7714"), /\[J\/OL\]/);
  assert.match(
    renderCitations("结果 [@smith2024]。", [reference], "gb7714"),
    /结果 <sup>\[1\]<\/sup>/,
  );
});

test("removing the final citation also removes generated references", () => {
  const output = renderCitations("No citation remains.", [reference], "apa7");
  assert.equal(output, "No citation remains.");
});

test("renders page-note markers without a trailing bibliography", () => {
  const output = renderCitations(
    "Finding [@smith2024].",
    [reference],
    "apa7",
    "footnotes",
  );
  assert.match(output, /better-export-cite-marker/);
  assert.doesNotMatch(output, /## References/);
});

test("accepts spaces inside citation syntax and replaces missing records with a clear warning", () => {
  assert.match(
    renderCitations("Known [@  smith2024 ].", [reference], "apa7"),
    /Smith &#38; Zhang/,
  );
  assert.match(
    renderCitations("Unknown [@ missing].", [], "apa7"),
    /缺少文献：@missing/,
  );
  assert.match(renderCitations("Broken [@  ].", [], "apa7"), /空引用/);
});

test("removes accidentally saved citation source from page headers and footers", () => {
  assert.equal(stripCitationTokens("实验报告 [@ smith2024 ]"), "实验报告");
  assert.equal(stripCitationTokens("[@ ]"), "");
});
