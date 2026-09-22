import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMediaLayout,
  mediaEmbeds,
  readMediaLayout,
  clearMediaLayout,
  adjacentMediaBlock,
  readMediaAdjustment,
  setMediaAdjustment,
  alignMediaGroup,
} from "../test-dist/media-layout.mjs";

test("finds wiki images, videos, and standard Markdown images", () => {
  const source = "![[a.png]]\n![[clip.mp4]]\n![caption](./assets/b.png)";
  assert.equal(mediaEmbeds(source).length, 3);
});

test("turns two embeds into a portable two-column source line", () => {
  const result = formatMediaLayout("![[a.png]]\n![[b.png]]", {
    align: "center",
    width: "100",
    columns: 2,
    gap: "m",
    crop: true,
  });
  assert.equal(result?.count, 2);
  assert.doesNotMatch(result?.markdown ?? "", /\n/);
  assert.match(result?.markdown ?? "", /better-export-cols-2/);
  assert.match(result?.markdown ?? "", /better-export-crop/);
  assert.doesNotMatch(result?.markdown ?? "", /better-export-align-/);
  assert.doesNotMatch(result?.markdown ?? "", /better-export-width-/);
  assert.deepEqual(readMediaLayout(result?.markdown ?? ""), {
    align: "center",
    width: "100",
    columns: 2,
    gap: "m",
    crop: true,
  });
});

test("preserves human labels while replacing old layout tokens", () => {
  const result = formatMediaLayout(
    "![[a.png|实验结果 better-export-width-50]]",
    { align: "right", width: "75", columns: 1, gap: "s", crop: false },
  );
  assert.match(result?.markdown ?? "", /实验结果/);
  assert.doesNotMatch(result?.markdown ?? "", /better-export-width-50/);
  assert.match(result?.markdown ?? "", /better-export-width-75/);
});

test("rejects prose inside a multi-column selection", () => {
  assert.throws(
    () =>
      formatMediaLayout("说明\n![[a.png]]\n![[b.png]]", {
        align: "center",
        width: "100",
        columns: 2,
        gap: "m",
        crop: false,
      }),
    /只能包含/,
  );
});
test("editing media reads its existing options and clearing preserves normal links", () => {
  const source = "![[a.png|图一]]";
  const options = {
    align: "right",
    width: "50",
    columns: 1,
    gap: "m",
    crop: true,
  };
  const formatted = formatMediaLayout(source, options).markdown;
  assert.deepEqual(readMediaLayout(formatted), options);
  assert.equal(
    clearMediaLayout(formatted + " [[a.png]]"),
    source + " [[a.png]]",
  );
  assert.equal(mediaEmbeds("![[note.md]] ![[report.pdf]]").length, 0);
});

test("finds adjacent media paragraphs across blank lines without crossing prose", () => {
  const lines = [
    "正文",
    "",
    "![[a.png|better-export-row better-export-cols-2]]",
    "",
    "",
    "![[b.png|better-export-row better-export-cols-2]]",
    "",
    "下一段",
    "![[c.png]]",
  ];
  const block = adjacentMediaBlock(lines, 2);
  assert.deepEqual(block, {
    from: 2,
    to: 5,
    source:
      "![[a.png|better-export-row better-export-cols-2]]\n![[b.png|better-export-row better-export-cols-2]]",
    count: 2,
  });
});

test("stores per-image resize adjustments and one-click alignment resets the group", () => {
  const first = setMediaAdjustment(
    "![[a.png|图一 better-export-media better-export-row better-export-cols-2]]",
    { weight: 1350, height: 286, equal: false },
  );
  assert.deepEqual(readMediaAdjustment(first), {
    weight: 1350,
    height: 286,
    equal: false,
  });
  assert.match(first, /图一/);
  const aligned = alignMediaGroup(
    `${first} ![[b.png|better-export-media better-export-row better-export-cols-2]]`,
  );
  assert.equal(aligned?.count, 2);
  assert.equal((aligned?.markdown.match(/better-export-equal/g) ?? []).length, 2);
  assert.doesNotMatch(aligned?.markdown ?? "", /better-export-(?:weight|height)-/);
});
