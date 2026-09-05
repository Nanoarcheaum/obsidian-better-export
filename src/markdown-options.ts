export type WikiLinkMode = "link" | "text" | "source";

/** Transform prose only; TeX braces and code examples are not template fields. */
export function mapProse(
  source: string,
  transform: (text: string) => string,
): string {
  const protectedParts =
    /(^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)|^ {0,3}`{3,}[^\n]*\n[\s\S]*?^ {0,3}`{3,}[^\n]*(?:\n|$)|^ {0,3}~{3,}[^\n]*\n[\s\S]*?^ {0,3}~{3,}[^\n]*(?:\n|$)|^ {4}[^\n]*(?:\n|$)|`+[^`]*`+|\$\$[\s\S]*?\$\$|(?<!\\)\$(?:\\.|[^$\n])+?\$|<!--[\s\S]*?-->|<[^>]*>|\\[\s\S])/gm;
  let output = "",
    last = 0;
  for (const match of source.matchAll(protectedParts)) {
    output += transform(source.slice(last, match.index)) + match[0];
    last = match.index! + match[0].length;
  }
  return output + transform(source.slice(last));
}
export function prepareWikiLinks(source: string, mode: WikiLinkMode): string {
  if (mode !== "source") return source;
  return mapProse(source, (text) =>
    text.replace(
      /(?<!!)\[\[[^\]\n]+\]\]/g,
      (link) =>
        `<span class="better-export-wiki-source">${link.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[/g, "&#91;").replace(/\]/g, "&#93;")}</span>`,
    ),
  );
}
export function applyWikiLinkMode(root: HTMLElement, mode: WikiLinkMode): void {
  if (mode !== "text") return;
  for (const anchor of Array.from(
    root.querySelectorAll<HTMLAnchorElement>("a.internal-link"),
  )) {
    const plain = root.ownerDocument.createElement("span");
    plain.className = "better-export-wiki-text";
    plain.textContent = anchor.textContent;
    anchor.replaceWith(plain);
  }
}
