import test from "node:test";
import assert from "node:assert/strict";
import {
  coverImages,
  addCoverImages,
  normalizeCoverImage,
} from "../test-dist/cover-images.mjs";
test("legacy full-page cover migrates and appending preserves existing layout", () => {
  const t = { mode: "image", imagePath: "old.png", imageFit: "cover" };
  addCoverImages(t, ["new.png"]);
  assert.equal(t.images.length, 2);
  assert.equal(t.images[0].path, "old.png");
  assert.equal(t.images[0].width, 100);
  assert.equal(t.images[0].fit, "cover");
  t.images = [];
  assert.deepEqual(coverImages(t), []);
});
test("batch images tile and normalized image boxes stay inside paper", () => {
  const t = { mode: "image" };
  addCoverImages(t, ["a.png", "b.png"]);
  assert.equal(t.images[0].width, 50);
  assert.equal(t.images[1].x, 50);
  const v = normalizeCoverImage({
    ...t.images[0],
    x: 90,
    y: -10,
    width: 70,
    height: Infinity,
  });
  assert.equal(v.x, 30);
  assert.equal(v.y, 0);
  assert.equal(v.height, 50);
});
