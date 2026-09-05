import { ReferenceRecord } from "./citations";
import { ImportedReference } from "./zotero-import";
import { validCitationKey } from "./citation-syntax";

export function normalizeDoi(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .replace(/[.,;]+$/, "")
    .toLocaleLowerCase();
}
export function mergeReferences(
  library: ReferenceRecord[],
  items: ImportedReference[],
): ReferenceRecord[] {
  return items.map((item) => {
    const doi = normalizeDoi(item.doi);
    const existing = library.find(
      (r) =>
        (doi && normalizeDoi(r.doi) === doi) ||
        (item.sourcePath && r.sourcePath === item.sourcePath),
    );
    if (existing) {
      if (!existing.csl && item.csl) existing.csl = item.csl;
      for (const key of [
        "authors",
        "year",
        "title",
        "container",
        "volume",
        "issue",
        "pages",
        "doi",
        "url",
        "sourcePath",
      ] as const) {
        if (!existing[key] && item[key]) existing[key] = item[key]!;
      }
      return existing;
    }
    const base = validCitationKey(item.citeKey)
      ? item.citeKey
      : item.citeKey.replace(/[^\p{L}\p{N}_.:-]/gu, "-") || "reference";
    let citeKey = base,
      suffix = 2;
    while (library.some((r) => r.citeKey === citeKey))
      citeKey = `${base}-${suffix++}`;
    const record: ReferenceRecord = {
      ...item,
      doi,
      citeKey,
      id: crypto.randomUUID(),
    };
    library.push(record);
    return record;
  });
}
