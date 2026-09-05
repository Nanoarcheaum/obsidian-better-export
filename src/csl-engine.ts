import CSL from "citeproc";
import apa from "./csl/apa.csl";
import chicago from "./csl/chicago-author-date.csl";
import gb from "./csl/china-national-standard-gb-t-7714-2015-numeric.csl";
import en from "./csl/locales-en-US.xml";
import zh from "./csl/locales-zh-CN.xml";
import type { ReferenceRecord, CitationStyle } from "./citations";
import type { CitationToken } from "./citation-syntax";

function authorNames(
  authors: string,
): Array<{ literal?: string; family?: string; given?: string }> {
  return authors
    .split(/;|；|、|\s+and\s+|\s*&\s*/i)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      if (/[\u3400-\u9fff]/.test(name)) return { literal: name };
      if (name.includes(",")) {
        const [family, ...given] = name.split(",");
        return { family: family!.trim(), given: given.join(",").trim() };
      }
      const words = name.split(/\s+/);
      return words.length === 1
        ? { literal: name }
        : { family: words.pop()!, given: words.join(" ") };
    });
}
export function cslItem(reference: ReferenceRecord): Record<string, unknown> {
  const item: Record<string, unknown> = {
    ...reference.csl,
    id: reference.citeKey,
    type: (
      {
        article: "article-journal",
        book: "book",
        chapter: "chapter",
        web: "webpage",
        thesis: "thesis",
      } as const
    )[reference.type],
    title: reference.title,
    volume: reference.volume,
    issue: reference.issue,
    page: reference.pages,
    DOI: reference.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, ""),
    URL: reference.url,
  };
  if (!reference.csl?.author) item.author = authorNames(reference.authors);
  if (reference.year)
    item.issued = {
      "date-parts": [
        [Number(reference.year.match(/\d{4}/)?.[0]) || reference.year],
      ],
    };
  if (reference.type === "book" || reference.type === "thesis")
    item.publisher = reference.container;
  else item["container-title"] = reference.container;
  return item;
}
interface CslResult {
  rendered: string[];
  entries: Map<string, string>;
  bibliography: string;
}
const formatCache = new Map<string, CslResult>();
export function formatWithCsl(
  references: ReferenceRecord[],
  style: CitationStyle,
  tokens: CitationToken[],
): CslResult {
  const signature = JSON.stringify([
    references,
    style,
    tokens.map((t) => [t.key, t.locator]),
  ]);
  const cached = formatCache.get(signature);
  if (cached) return cached;
  const items = new Map(references.map((r) => [r.citeKey, cslItem(r)]));
  const engine = new CSL.Engine(
    {
      retrieveLocale: (lang: string) => (lang.startsWith("zh") ? zh : en),
      retrieveItem: (id: string) => items.get(id),
    },
    { apa7: apa, chicago, gb7714: gb }[style],
    style === "gb7714" ? "zh-CN" : "en-US",
  );
  engine.updateItems(references.map((r) => r.citeKey));
  const rendered: string[] = [],
    previous: Array<[string, number]> = [];
  tokens.forEach((token, i) => {
    const id = `cite-${i}`;
    const locator = token.locator.replace(/^(?:pp?\.?|页)\s*/i, "");
    const result = engine.processCitationCluster(
      {
        citationID: id,
        citationItems: [
          { id: token.key, ...(locator ? { locator, label: "page" } : {}) },
        ],
        properties: { noteIndex: 0 },
      },
      previous,
      [],
    );
    for (const [index, html] of result[1]) rendered[index] = html;
    previous.push([id, 0]);
  });
  const bibliography = engine.makeBibliography();
  const entries = new Map<string, string>();
  if (bibliography)
    bibliography[0].entry_ids.forEach((ids: string[], i: number) => {
      for (const id of ids) entries.set(id, bibliography[1][i]);
    });
  const result = {
    rendered,
    entries,
    bibliography: bibliography ? bibliography[1].join("") : "",
  };
  if (formatCache.size >= 4)
    formatCache.delete(formatCache.keys().next().value!);
  formatCache.set(signature, result);
  return result;
}

/** Keep typographic markup only; no imported HTML attributes become executable DOM. */
export function appendCitationHtml(target: HTMLElement, html: string): void {
  const document = target.ownerDocument,
    parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll(".csl-left-margin").forEach((el) => el.remove());
  const append = (source: Node, parent: Node) => {
    if (source.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(source.textContent ?? ""));
      return;
    }
    if (!(source instanceof Element)) return;
    const tag = source.tagName.toLowerCase();
    const next = ["i", "b", "em", "strong", "sup", "sub"].includes(tag)
      ? document.createElement(tag)
      : document.createDocumentFragment();
    Array.from(source.childNodes).forEach((child) => append(child, next));
    parent.appendChild(next);
  };
  Array.from(parsed.body.childNodes).forEach((child) => append(child, target));
}
