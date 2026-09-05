import test from "node:test";
import assert from "node:assert/strict";
import {
  referenceFromVaultNote,
  vaultReferenceMatches,
} from "../test-dist/vault-reference.mjs";

test("builds a reference from Obsidian paper-note properties and DOI tag", () => {
  const ref = referenceFromVaultNote({
    path: "papers/Smith 2024.md",
    basename: "Smith 2024",
    frontmatter: {
      title: "Reliable Discovery",
      authors: ["Jane Smith", "Wei Zhang"],
      year: 2024,
      journal: "Science",
    },
    tags: ["#doi/10.1000/example"],
  });
  assert.equal(ref.doi, "10.1000/example");
  assert.equal(ref.authors, "Jane Smith; Wei Zhang");
  assert.match(ref.citeKey, /Smith2024/);
});

test("ignores ordinary notes without bibliographic metadata", () => {
  assert.equal(
    referenceFromVaultNote({
      path: "daily.md",
      basename: "daily",
      frontmatter: { tags: ["daily"] },
    }),
    null,
  );
});

test("searches vault references by DOI and source path", () => {
  const ref = referenceFromVaultNote({
    path: "papers/quantum.md",
    basename: "Quantum",
    frontmatter: { doi: "10.1000/q", author: "Ada Lovelace", year: "2025" },
  });
  assert.equal(vaultReferenceMatches(ref, "10.1000/q"), true);
  assert.equal(vaultReferenceMatches(ref, "papers/quantum"), true);
});
test("Paper-easy placeholder notes remain discoverable and diary year alone is ignored", () => {
  assert.ok(
    referenceFromVaultNote({
      path: "paper.md",
      basename: "Paper",
      frontmatter: {
        "ai4d-type": "paper",
        title: "Paper",
        doi: "",
        authors: [],
        year: "",
      },
      tags: ["Paper"],
    }),
  );
  assert.equal(
    referenceFromVaultNote({
      path: "diary.md",
      basename: "Diary",
      frontmatter: { year: 2026 },
    }),
    null,
  );
});
test("balanced DOI parentheses are preserved", () => {
  assert.equal(
    referenceFromVaultNote({
      path: "x.md",
      basename: "X",
      frontmatter: { doi: "10.1000/abc(1)" },
    }).doi,
    "10.1000/abc(1)",
  );
});
