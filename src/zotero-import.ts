import { ReferenceRecord } from "./citations";

export type ImportedReference = Omit<ReferenceRecord, "id">;

export function parseZotero(text: string): ImportedReference[] {
  const source = text.trim();
  if (!source) return [];
  if (source.startsWith("[") || source.startsWith("{")) {
    try {
      const json = JSON.parse(source);
      const values = Array.isArray(json) ? json : [json];
      const parsed = values
        .map(fromCsl)
        .filter((item): item is ImportedReference => Boolean(item));
      if (parsed.length) return parsed;
    } catch {
      /* fall through to other Zotero quick-copy formats */
    }
  }
  if (/^TY\s{0,2}-/m.test(source))
    return source
      .split(/\nER\s{0,2}-\s*/)
      .map(fromRis)
      .filter((item): item is ImportedReference => Boolean(item));
  const bib = bibEntries(source)
    .map(fromBibtex)
    .filter((item) => item.title.trim());
  if (bib.length) return bib;
  if (source.startsWith("@")) return [];
  return source
    .split(/\n\s*\n/)
    .map(fromFormatted)
    .filter((item): item is ImportedReference => Boolean(item));
}

function empty(
  citeKey: string,
  type: ReferenceRecord["type"] = "article",
): ImportedReference {
  return {
    citeKey,
    type,
    authors: "",
    year: "",
    title: "",
    container: "",
    volume: "",
    issue: "",
    pages: "",
    doi: "",
    url: "",
  };
}

function fromCsl(value: any): ImportedReference | null {
  if (!value || typeof value !== "object") return null;
  const authors = Array.isArray(value.author)
    ? value.author
        .map(
          (a: any) =>
            a.literal || [a.given, a.family].filter(Boolean).join(" "),
        )
        .join("; ")
    : "";
  const year = String(
    value.issued?.["date-parts"]?.[0]?.[0] ?? value.year ?? "",
  );
  const title = String(value.title ?? "").trim();
  if (!title) return null;
  return {
    ...empty(
      uniqueKey(String(value.id ?? ""), authors, year, title),
      cslType(value.type),
    ),
    authors,
    year,
    title,
    container: String(value["container-title"] ?? value.publisher ?? ""),
    volume: String(value.volume ?? ""),
    issue: String(value.issue ?? ""),
    pages: String(value.page ?? ""),
    doi: String(value.DOI ?? ""),
    url: String(value.URL ?? ""),
    csl: value,
  };
}

function fromRis(block: string): ImportedReference | null {
  const values = new Map<string, string[]>();
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9]{2})\s{0,2}-\s?(.*)$/);
    if (m) values.set(m[1]!, [...(values.get(m[1]!) ?? []), m[2]!.trim()]);
  }
  const title = (values.get("TI") ?? values.get("T1") ?? [""])[0]!;
  if (!title) return null;
  const authors = (values.get("AU") ?? values.get("A1") ?? []).join("; "),
    year = ((values.get("PY") ?? values.get("Y1") ?? [""])[0] ?? "").slice(
      0,
      4,
    );
  const item = empty(
    uniqueKey((values.get("ID") ?? [""])[0]!, authors, year, title),
    risType((values.get("TY") ?? [""])[0]!),
  );
  return {
    ...item,
    authors,
    year,
    title,
    container: (values.get("JO") ??
      values.get("JF") ??
      values.get("T2") ?? [""])[0]!,
    volume: (values.get("VL") ?? [""])[0]!,
    issue: (values.get("IS") ?? [""])[0]!,
    pages: [(values.get("SP") ?? [""])[0], (values.get("EP") ?? [""])[0]]
      .filter(Boolean)
      .join("-"),
    doi: (values.get("DO") ?? [""])[0]!,
    url: (values.get("UR") ?? [""])[0]!,
  };
}

function fromBibtex(match: RegExpMatchArray): ImportedReference {
  const fields = bibFields(match[3]!);
  const type = /book/.test(match[1]!)
    ? "book"
    : /thesis/.test(match[1]!)
      ? "thesis"
      : /incollection/.test(match[1]!)
        ? "chapter"
        : /misc/.test(match[1]!)
          ? "web"
          : "article";
  return {
    ...empty(match[2]!.trim(), type),
    authors: (fields.get("author") ?? "").replace(/\s+and\s+/gi, "; "),
    year: fields.get("year") ?? "",
    title: fields.get("title") ?? "",
    container:
      fields.get("journal") ??
      fields.get("booktitle") ??
      fields.get("publisher") ??
      "",
    volume: fields.get("volume") ?? "",
    issue: fields.get("number") ?? "",
    pages: fields.get("pages") ?? "",
    doi: fields.get("doi") ?? "",
    url: fields.get("url") ?? "",
  };
}

function bibEntries(source: string): RegExpMatchArray[] {
  const result: RegExpMatchArray[] = [];
  const start =
    /@(article|book|incollection|phdthesis|mastersthesis|misc)\s*\{\s*([^,]+),/gi;
  let match: RegExpExecArray | null;
  while ((match = start.exec(source))) {
    let depth = 1,
      quote = false,
      end = start.lastIndex;
    for (; end < source.length; end++) {
      const c = source[end];
      if (c === "\\") {
        end++;
        continue;
      }
      if (c === '"') quote = !quote;
      if (quote) continue;
      if (c === "{") depth++;
      if (c === "}" && --depth === 0) break;
    }
    if (depth !== 0) break;
    result.push([
      match[0],
      match[1]!.toLowerCase(),
      match[2]!,
      source.slice(start.lastIndex, end),
    ] as RegExpMatchArray);
    start.lastIndex = end + 1;
  }
  return result;
}
function bibFields(source: string): Map<string, string> {
  const result = new Map<string, string>(),
    pattern = /(\w+)\s*=\s*/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const start = pattern.lastIndex,
      opener = source[start];
    let end = start,
      value = "";
    if (opener === "{" || opener === '"') {
      let depth = 1;
      end++;
      const begin = end;
      for (; end < source.length; end++) {
        const c = source[end];
        if (c === "\\") {
          end++;
          continue;
        }
        if (opener === "{" && c === "{") depth++;
        if ((opener === "{" && c === "}") || (opener === '"' && c === '"')) {
          depth--;
          if (!depth) break;
        }
      }
      if (depth) break;
      value = source.slice(begin, end);
      end++;
    } else {
      while (end < source.length && source[end] !== ",") end++;
      value = source.slice(start, end);
    }
    result.set(match[1]!.toLowerCase(), clean(value));
    pattern.lastIndex = end;
  }
  return result;
}

function fromFormatted(source: string): ImportedReference | null {
  const one = source.replace(/\s+/g, " ").trim();
  if (one.length < 8) return null;
  const doi =
    one.match(
      /(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i,
    )?.[1] ?? "";
  const url = doi
    ? ""
    : (one.match(/https?:\/\/\S+/)?.[0]?.replace(/[.,;)]$/, "") ?? "");
  const year =
    one.match(/(?:\(|\b)((?:19|20)\d{2})(?:[a-z]?\)|\b)/i)?.[1] ?? "";
  if (!year && !doi && !url) return null;
  const parts = one.split(/\.\s+/);
  const authors = (parts.shift() ?? "").replace(/,$/, "");
  if (parts[0]?.match(/^\(?\d{4}[a-z]?\)?$/i)) parts.shift();
  const title = parts.shift()?.replace(/[. ]+$/, "") ?? one;
  return {
    ...empty(uniqueKey("", authors, year, title), url ? "web" : "article"),
    authors,
    year,
    title,
    container: parts
      .join(". ")
      .replace(/https?:\/\/\S+|doi:\s*\S+/gi, "")
      .trim(),
    doi,
    url,
  };
}

function uniqueKey(
  input: string,
  authors: string,
  year: string,
  title: string,
): string {
  const supplied = input.trim().replace(/\s+/g, "-");
  if (supplied) return supplied;
  const author =
    authors
      .split(/[;,，、&]/)[0]
      ?.trim()
      .split(/\s+/)
      .at(-1) ?? "ref";
  const word = title.match(/[A-Za-z0-9\u3400-\u9fff]+/)?.[0] ?? "work";
  return (
    `${author}${year || "nd"}${word}`
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9\u3400-\u9fff_.:-]/g, "")
      .slice(0, 48) || `ref${year}`
  );
}
function clean(value: string): string {
  return value
    .replace(/[{}]/g, "")
    .replace(/\\["'`]/g, "")
    .trim();
}
function cslType(type: string): ReferenceRecord["type"] {
  return /book/.test(type)
    ? "book"
    : /chapter/.test(type)
      ? "chapter"
      : /thesis/.test(type)
        ? "thesis"
        : /web|post/.test(type)
          ? "web"
          : "article";
}
function risType(type: string): ReferenceRecord["type"] {
  return /BOOK/.test(type)
    ? "book"
    : /CHAP/.test(type)
      ? "chapter"
      : /THES/.test(type)
        ? "thesis"
        : /ELEC|WEB/.test(type)
          ? "web"
          : "article";
}
