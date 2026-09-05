import { ImportedReference } from "./zotero-import";

export interface VaultReferenceNote {
  path: string;
  basename: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
}

export interface VaultReference extends ImportedReference {
  sourcePath: string;
}

const DOI_PATTERN = /10\.\d{4,9}\/[\w.()/:;-]+/i;

export function referenceFromVaultNote(
  note: VaultReferenceNote,
): VaultReference | null {
  const frontmatter = note.frontmatter ?? {},
    tags = note.tags ?? [];
  const doi = doiValue(
    text(read(frontmatter, "doi", "DOI", "digital-object-identifier")),
    tags.join(" "),
  );
  const explicitKey = text(
    read(
      frontmatter,
      "citekey",
      "cite-key",
      "citation-key",
      "citationKey",
      "zotero-key",
      "bibliography-key",
    ),
  );
  const authors = people(read(frontmatter, "authors", "author", "creators"));
  const year = yearValue(
    read(frontmatter, "year", "date", "issued", "publication-date"),
  );
  const title =
    text(read(frontmatter, "title", "paper-title", "article-title")) ||
    note.basename;
  const container = text(
    read(
      frontmatter,
      "container-title",
      "journal",
      "publication",
      "publisher",
      "booktitle",
    ),
  );
  const url = text(read(frontmatter, "url", "URL", "link"));
  const paperNote =
    text(frontmatter["ai4d-type"]) === "paper" ||
    tags.some((tag) => /^#?paper$/i.test(tag));
  if (!doi && !explicitKey && !paperNote && !(authors && (year || container)))
    return null;
  return {
    citeKey: explicitKey || makeKey(authors, year, title),
    type: itemType(text(read(frontmatter, "type", "itemType", "entry-type"))),
    authors,
    year,
    title,
    container,
    volume: text(read(frontmatter, "volume")),
    issue: text(read(frontmatter, "issue", "number")),
    pages: text(read(frontmatter, "pages", "page")),
    doi,
    url,
    sourcePath: note.path,
  };
}

export function vaultReferenceMatches(
  reference: VaultReference,
  query: string,
): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return [
    reference.citeKey,
    reference.title,
    reference.authors,
    reference.doi,
    reference.container,
    reference.sourcePath,
  ].some((value) => value.toLocaleLowerCase().includes(q));
}

function read(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (source[key] !== undefined) return source[key];
  return "";
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("; ");
  if (value && typeof value === "object")
    return Object.values(value as Record<string, unknown>)
      .map(text)
      .filter(Boolean)
      .join(" ");
  return String(value ?? "").trim();
}
function people(value: unknown): string {
  return text(value).replace(/\s*\|\s*/g, "; ");
}
function yearValue(value: unknown): string {
  return text(value).match(/(?:19|20)\d{2}/)?.[0] ?? "";
}
function doiValue(...values: string[]): string {
  for (const value of values) {
    let match = value.match(DOI_PATTERN)?.[0]?.replace(/[.,;]+$/g, "");
    if (
      match?.endsWith(")") &&
      (match.match(/\)/g)?.length ?? 0) > (match.match(/\(/g)?.length ?? 0)
    )
      match = match.slice(0, -1);
    if (match) return match;
  }
  return "";
}
function makeKey(authors: string, year: string, title: string): string {
  const author =
      authors
        .split(/[;,，、&]/)[0]
        ?.trim()
        .split(/\s+/)
        .at(-1) ?? "ref",
    word = title.match(/[A-Za-z0-9\u3400-\u9fff]+/)?.[0] ?? "work";
  return (
    `${author}${year || "nd"}${word}`
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9\u3400-\u9fff_.:-]/g, "")
      .slice(0, 48) || `ref${year}`
  );
}
function itemType(value: string): ImportedReference["type"] {
  return /book/i.test(value)
    ? "book"
    : /chapter|incollection/i.test(value)
      ? "chapter"
      : /thesis|dissertation/i.test(value)
        ? "thesis"
        : /web|blog|post/i.test(value)
          ? "web"
          : "article";
}
