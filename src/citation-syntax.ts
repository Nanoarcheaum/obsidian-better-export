export interface CitationToken {
  start: number;
  end: number;
  key: string;
  locator: string;
  error?: string;
}
export const validCitationKey = (key: string): boolean =>
  /^[\p{L}\p{N}_.:-]+$/u.test(key);

/** Preserve offsets while excluding Markdown code, escaped text, frontmatter and HTML attributes. */
export function citationTokens(source: string): CitationToken[] {
  const chars = source.split("");
  const hide = (start: number, end: number) => {
    for (let i = start; i < end; i++) if (chars[i] !== "\n") chars[i] = " ";
  };
  const frontmatter = source.match(
    /^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$)/,
  );
  if (frontmatter) hide(0, frontmatter[0].length);
  let offset = 0,
    fence: { char: string; length: number } | null = null;
  for (const line of source.split(/(?<=\n)/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      hide(offset, offset + line.length);
      if (
        marker &&
        marker[1]![0] === fence.char &&
        marker[1]!.length >= fence.length &&
        line.slice(marker[0].length).trim() === ""
      )
        fence = null;
    } else if (marker) {
      fence = { char: marker[1]![0]!, length: marker[1]!.length };
      hide(offset, offset + line.length);
    } else if (/^(?: {4}|\t)/.test(line)) hide(offset, offset + line.length);
    offset += line.length;
  }
  const masked = () => chars.join("");
  for (const match of masked().matchAll(
    /<!--[\s\S]*?-->|<(pre|code|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]*>/gi,
  ))
    hide(match.index!, match.index! + match[0].length);
  for (const match of masked().matchAll(/(`+)([\s\S]*?)\1(?!`)/g))
    hide(match.index!, match.index! + match[0].length);
  for (const match of masked().matchAll(/\\[\s\S]/g))
    hide(match.index!, match.index! + match[0].length);
  const result: CitationToken[] = [];
  for (const match of masked().matchAll(/\[@([^\]\n]*)(?:\]|(?=\n|$))/g)) {
    const inner = match[1]!.trim(),
      comma = inner.indexOf(",");
    const key = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const locator = comma < 0 ? "" : inner.slice(comma + 1).trim();
    result.push({
      start: match.index!,
      end: match.index! + match[0].length,
      key,
      locator,
      error: !match[0].endsWith("]")
        ? "引用缺少右括号"
        : !key
          ? "空引用"
          : !validCitationKey(key)
            ? "不支持的引用语法，请逐条插入引用"
            : undefined,
    });
  }
  return result;
}

export function citationProblems(source: string, keys: string[]): string[] {
  const available = new Set(keys);
  return citationTokens(source).flatMap((token) =>
    token.error
      ? [token.error]
      : available.has(token.key)
        ? []
        : [`缺少文献：@${token.key}`],
  );
}
