import test from "node:test";
import assert from "node:assert/strict";
import {
  fillHeaderText,
  headerFields,
  normalizeHeader,
  normalizeCover,
  setRowColumnCount,
  starterCover,
} from "../test-dist/export-header.mjs";

const template = {
  id: "1",
  name: "Custom",
  repeat: "all",
  logoPath: "",
  border: "grid",
  showRule: true,
  rows: [
    {
      cells: [
        {
          text: "姓名：{{姓名}} · {{课程}}",
          width: 2,
          fontSize: 12,
          align: "center",
          bold: true,
        },
      ],
    },
  ],
};

test("extracts reusable document fields and fills per-document values", () => {
  assert.deepEqual(headerFields(template), ["姓名", "课程"]);
  assert.equal(
    fillHeaderText(template.rows[0].cells[0].text, {
      姓名: "小明",
      课程: "分析化学",
    }),
    "姓名：小明 · 分析化学",
  );
});

test("normalizes unsafe grid widths", () => {
  const value = normalizeHeader({
    ...template,
    rows: [{ cells: [{ ...template.rows[0].cells[0], width: 99 }] }],
  });
  assert.equal(value.rows[0].cells[0].width, 12);
});

test("creates a real two-column header row in one action", () => {
  const row = setRowColumnCount(
    { gapBefore: 0, gapAfter: 0, cells: [template.rows[0].cells[0]] },
    2,
  );
  assert.equal(row.cells.length, 2);
  assert.equal(row.cells[0].width, 2);
  assert.equal(row.cells[1].width, 1);
});

test("cover templates expose per-document placeholder fields", () => {
  const fields = headerFields(starterCover());
  assert.ok(fields.includes("报告标题"));
  assert.ok(fields.includes("实验日期"));
});
test("reducing and restoring columns preserves hidden content", () => {
  const original = {
    gapBefore: 0,
    gapAfter: 0,
    cells: [
      { ...template.rows[0].cells[0], text: "姓名" },
      { ...template.rows[0].cells[0], text: "学号" },
    ],
  };
  const reduced = setRowColumnCount(original, 1);
  assert.equal(reduced.cells.length, 1);
  const restored = setRowColumnCount(reduced, 2);
  assert.deepEqual(restored.cells, original.cells);
});

test("cover spacing above 100 mm survives template normalization", () => {
  const cover = starterCover();
  cover.rows[0].gapBefore = 215;
  cover.rows[0].gapAfter = 135;
  const normalized = normalizeCover(cover);
  assert.equal(normalized.rows[0].gapBefore, 215);
  assert.equal(normalized.rows[0].gapAfter, 135);
});
