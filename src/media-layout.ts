export type MediaAlign = "left" | "center" | "right";
export type MediaWidth = "auto" | "25" | "33" | "50" | "66" | "75" | "100";
export type MediaGap = "s" | "m" | "l";

export interface MediaLayoutOptions {
  align: MediaAlign;
  width: MediaWidth;
  columns: 1 | 2 | 3 | 4;
  gap: MediaGap;
  crop: boolean;
}

export interface MediaLayoutResult {
  markdown: string;
  count: number;
}
export interface MediaAdjustment {
  weight: number;
  height: number | null;
  equal: boolean;
}
export interface MediaLineBlock {
  from: number;
  to: number;
  source: string;
  count: number;
}

const MEDIA_SOURCE = String.raw`!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\((?:[^()\n]|\([^\n)]*\))+\)`;
const AI4D_TOKEN =
  /^better-export-(?:media|align-(?:left|center|right)|width-(?:auto|25|33|50|66|75|100)|row|cols-[1-4]|gap-[sml]|crop|weight-\d{1,4}|height-\d{1,4}|equal)$/;
const ADJUST_TOKEN = /^better-export-(?:weight-\d{1,4}|height-\d{1,4}|equal)$/;

export function mediaEmbeds(markdown: string): string[] {
  return [...markdown.matchAll(new RegExp(MEDIA_SOURCE, "g"))]
    .filter((match) => isMedia(match[0]))
    .map((match) => match[0]);
}

function isMedia(embed: string): boolean {
  return (
    !embed.startsWith("![[") ||
    /\.(?:png|jpe?g|gif|webp|svg|bmp|avif|mp4|webm|mov|mkv|ogv)(?:[|#?\]]|$)/i.test(
      embed,
    )
  );
}
function mediaOnly(source: string): boolean {
  if (!mediaEmbeds(source).length) return false;
  return !source
    .replace(new RegExp(MEDIA_SOURCE, "g"), (embed) =>
      isMedia(embed) ? "" : embed,
    )
    .trim();
}
export function adjacentMediaBlock(
  lines: string[],
  line: number,
): MediaLineBlock | null {
  if (!mediaOnly(lines[line] ?? "")) return null;
  let from = line,
    to = line;
  const scan = (direction: -1 | 1) => {
    let cursor = line + direction,
      blanks = 0;
    while (cursor >= 0 && cursor < lines.length) {
      const source = lines[cursor] ?? "";
      if (!source.trim()) {
        if (++blanks > 2) break;
        cursor += direction;
        continue;
      }
      if (!mediaOnly(source)) break;
      direction < 0 ? (from = cursor) : (to = cursor);
      blanks = 0;
      cursor += direction;
    }
  };
  scan(-1);
  scan(1);
  const source = lines
      .slice(from, to + 1)
      .filter((value) => value.trim())
      .join("\n"),
    count = mediaEmbeds(source).length;
  return { from, to, source, count };
}

/** Make separately rendered, adjacent media-only paragraphs one visual grid. */
export function groupRenderedMediaRows(root: HTMLElement): void {
  const rowMedia = (paragraph: Element): HTMLElement[] => {
    if (!paragraph.matches("p") || paragraph.textContent?.trim()) return [];
    const children = Array.from(paragraph.children);
    if (
      !children.length ||
      children.some(
        (child) =>
          !child.matches(
            '.internal-embed[alt*="better-export-row"],img[alt*="better-export-row"]',
          ),
      )
    )
      return [];
    return children as HTMLElement[];
  };
  const signature = (media: HTMLElement) =>
    (media.getAttribute("alt") ?? "")
      .split(/\s+/)
      .filter((token) => /better-export-(?:cols-[1-4]|gap-[sml])/.test(token))
      .join(" ");
  for (const first of Array.from(root.querySelectorAll("p"))) {
    const media = rowMedia(first);
    if (!media.length) continue;
    for (const node of Array.from(first.childNodes))
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim())
        node.remove();
    const layout = signature(media[0]!);
    let next = first.nextElementSibling;
    while (next) {
      const following = rowMedia(next);
      if (
        !following.length ||
        following.some((item) => signature(item) !== layout)
      )
        break;
      const after = next.nextElementSibling;
      for (const item of following) first.append(item);
      next.remove();
      next = after;
    }
  }
}
export function readMediaLayout(source: string): MediaLayoutOptions {
  const columns = Number(
    source.match(/better-export-cols-([1-4])/)?.[1] ?? 1,
  ) as MediaLayoutOptions["columns"];
  return {
    align: (columns > 1
      ? "center"
      : (source.match(/better-export-align-(left|center|right)/)?.[1] ??
        "center")) as MediaAlign,
    width: (columns > 1
      ? "100"
      : (source.match(/better-export-width-(auto|25|33|50|66|75|100)/)?.[1] ??
        "75")) as MediaWidth,
    columns,
    gap: (source.match(/better-export-gap-([sml])/)?.[1] ?? "m") as MediaGap,
    crop: source.includes("better-export-crop"),
  };
}
export function readMediaAdjustment(source: string): MediaAdjustment {
  return {
    weight: clamp(Number(source.match(/better-export-weight-(\d{1,4})/)?.[1] ?? 1000), 200, 5000),
    height: source.match(/better-export-height-(\d{1,4})/)?.[1]
      ? clamp(Number(source.match(/better-export-height-(\d{1,4})/)?.[1]), 80, 1200)
      : null,
    equal: source.includes("better-export-equal"),
  };
}
export function setMediaAdjustment(
  embed: string,
  adjustment: MediaAdjustment,
): string {
  const tokens = [
    ...(adjustment.weight === 1000 ? [] : [`better-export-weight-${clamp(Math.round(adjustment.weight), 200, 5000)}`]),
    ...(adjustment.height === null ? [] : [`better-export-height-${clamp(Math.round(adjustment.height), 80, 1200)}`]),
    ...(adjustment.equal ? ["better-export-equal"] : []),
  ];
  if (embed.startsWith("![[")) {
    const parts = embed.slice(3, -2).split("|");
    const target = parts.shift() ?? "";
    const label = replaceAdjustment(parts.join(" "), tokens);
    return `![[${target}${label ? "|" + label : ""}]]`;
  }
  const match = embed.match(/^!\[([^\]]*)\](\([\s\S]*\))$/);
  if (!match) return embed;
  return `![${replaceAdjustment(match[1] ?? "", tokens)}]${match[2]}`;
}
export function alignMediaGroup(markdown: string): MediaLayoutResult | null {
  const embeds = mediaEmbeds(markdown);
  if (embeds.length < 2) return null;
  let index = 0;
  const aligned = embeds.map((embed) =>
    setMediaAdjustment(embed, { weight: 1000, height: null, equal: true }),
  );
  return {
    markdown: markdown.replace(new RegExp(MEDIA_SOURCE, "g"), (embed) =>
      isMedia(embed) ? (aligned[index++] ?? embed) : embed,
    ),
    count: embeds.length,
  };
}
export function clearMediaLayout(source: string): string {
  return source.replace(
    /!\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\](\([^\n]+\))/g,
    (embed, inner, label, target) => {
      if (!isMedia(embed)) return embed;
      if (inner !== undefined) {
        const [path, ...aliases] = inner.split("|");
        const clean = cleanLabel(aliases.join(" "));
        return `![[${path}${clean ? "|" + clean : ""}]]`;
      }
      return `![${cleanLabel(label)}]${target}`;
    },
  );
}

export function formatMediaLayout(
  markdown: string,
  options: MediaLayoutOptions,
): MediaLayoutResult | null {
  const embeds = mediaEmbeds(markdown);
  if (!embeds.length) return null;
  if (options.columns > 1) {
    const remainder = markdown
      .replace(new RegExp(MEDIA_SOURCE, "g"), (embed) =>
        isMedia(embed) ? "" : embed,
      )
      .trim();
    if (remainder) throw new Error("多列布局的选区中只能包含图片或视频链接");
  }
  let index = 0;
  const decorated = embeds.map((embed) => decorateEmbed(embed, options));
  const replaced = markdown.replace(new RegExp(MEDIA_SOURCE, "g"), (embed) =>
    isMedia(embed) ? (decorated[index++] ?? embed) : embed,
  );
  return {
    markdown: options.columns > 1 ? decorated.join(" ") : replaced,
    count: embeds.length,
  };
}

function decorateEmbed(embed: string, options: MediaLayoutOptions): string {
  const tokens = [
    "better-export-media",
    ...(options.columns === 1
      ? [
          `better-export-align-${options.align}`,
          `better-export-width-${options.width}`,
        ]
      : []),
    ...(options.columns > 1
      ? [
          "better-export-row",
          `better-export-cols-${options.columns}`,
          `better-export-gap-${options.gap}`,
        ]
      : []),
    ...(options.crop ? ["better-export-crop"] : []),
  ];
  if (embed.startsWith("![[")) {
    const parts = embed.slice(3, -2).split("|");
    const target = parts.shift() ?? "";
    return `![[${target}|${[cleanLabel(parts.join(" ")), ...tokens].filter(Boolean).join(" ")}]]`;
  }
  const match = embed.match(/^!\[([^\]]*)\](\([\s\S]*\))$/);
  if (!match) return embed;
  return `![${[cleanLabel(match[1] ?? ""), ...tokens].filter(Boolean).join(" ")}]${match[2]}`;
}

function cleanLabel(label: string): string {
  return label
    .split(/\s+/)
    .filter((token) => token && !AI4D_TOKEN.test(token))
    .join(" ");
}
function replaceAdjustment(label: string, tokens: string[]): string {
  return [
    ...label.split(/\s+/).filter((token) => token && !ADJUST_TOKEN.test(token)),
    ...tokens,
  ].join(" ");
}
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
