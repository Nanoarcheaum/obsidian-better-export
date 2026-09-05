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

const MEDIA_SOURCE = String.raw`!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\((?:[^()\n]|\([^\n)]*\))+\)`;
const AI4D_TOKEN =
  /^better-export-(?:media|align-(?:left|center|right)|width-(?:auto|25|33|50|66|75|100)|row|cols-[1-4]|gap-[sml]|crop)$/;

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
export function readMediaLayout(source: string): MediaLayoutOptions {
  return {
    align: (source.match(/better-export-align-(left|center|right)/)?.[1] ??
      "center") as MediaAlign,
    width: (source.match(
      /better-export-width-(auto|25|33|50|66|75|100)/,
    )?.[1] ?? "75") as MediaWidth,
    columns: Number(
      source.match(/better-export-cols-([1-4])/)?.[1] ?? 1,
    ) as MediaLayoutOptions["columns"],
    gap: (source.match(/better-export-gap-([sml])/)?.[1] ?? "m") as MediaGap,
    crop: source.includes("better-export-crop"),
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
    `better-export-align-${options.align}`,
    `better-export-width-${options.width}`,
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
