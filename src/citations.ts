import { formatWithCsl } from "./csl-engine";
import { citationTokens } from "./citation-syntax";
export type CitationStyle = "apa7" | "gb7714" | "chicago";
export type CitationPlacement = "bibliography" | "footnotes" | "both";

export interface ReferenceRecord {
  id: string;
  citeKey: string;
  type: "article" | "book" | "chapter" | "web" | "thesis";
  authors: string;
  year: string;
  title: string;
  container: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  url: string;
  sourcePath?: string;
  csl?: Record<string, unknown>;
}

export function citationKeys(markdown: string): string[] {
  return [
    ...new Set(
      citationTokens(markdown)
        .filter((t) => !t.error)
        .map((t) => t.key),
    ),
  ];
}
export function stripCitationTokens(text: string): string {
  return text
    .replace(/\[@[^\]\n]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
export function buildCitationDocument(
  markdown: string,
  references: ReferenceRecord[],
  style: CitationStyle,
  placement: CitationPlacement = "bibliography",
) {
  const byKey = new Map(references.map((r) => [r.citeKey, r]));
  const tokens = citationTokens(markdown),
    valid = tokens.filter((t) => !t.error && byKey.has(t.key));
  const keys = [...new Set(valid.map((t) => t.key))];
  const cited = keys.map((k) => byKey.get(k)!);
  const formatted = cited.length
    ? formatWithCsl(cited, style, valid)
    : { rendered: [], entries: new Map<string, string>(), bibliography: "" };
  const numbers = new Map(keys.map((k, i) => [k, i + 1]));
  let body = "",
    last = 0,
    index = 0;
  for (const token of tokens) {
    body += markdown.slice(last, token.start);
    last = token.end;
    if (token.error || !byKey.has(token.key))
      body += `<span class="better-export-missing-citation">${escapeAttribute(token.error || "缺少文献：@" + token.key)}</span>`;
    else {
      const inline = formatted.rendered[index++];
      body +=
        placement === "bibliography"
          ? inline
          : `<sup class="better-export-cite-marker" data-cite-key="${escapeAttribute(token.key)}" data-cite-number="${numbers.get(token.key)}" data-cite-locator="${escapeAttribute(token.locator)}">[${numbers.get(token.key)}]</sup>`;
    }
  }
  body += markdown.slice(last);
  if (cited.length && placement !== "footnotes")
    body +=
      "\n\n## " +
      (style === "gb7714" ? "参考文献" : "References") +
      "\n\n" +
      formatted.bibliography +
      "\n";
  return { markdown: body, notes: formatted.entries };
}
export function renderCitations(
  markdown: string,
  references: ReferenceRecord[],
  style: CitationStyle,
  placement: CitationPlacement = "bibliography",
): string {
  return buildCitationDocument(markdown, references, style, placement).markdown;
}
export function bibliographyEntry(
  reference: ReferenceRecord,
  style: CitationStyle,
): string {
  return (
    formatWithCsl([reference], style, []).entries.get(reference.citeKey) ?? ""
  );
}
function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
