import { WikiLinkMode } from "./markdown-options";
export type PageSize = "A4" | "Letter";
export type Orientation = "portrait" | "landscape";

export interface ExportProfile {
  preset: "academic" | "report" | "manuscript";
  pageSize: PageSize;
  orientation: Orientation;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  bodyFont: string;
  headingFont: string;
  bodySize: number;
  lineHeight: number;
  paragraphSpacing: number;
  firstLineIndent: number;
  h1Size: number;
  h2Size: number;
  h3Size: number;
  h4Size: number;
  h5Size: number;
  h6Size: number;
  textColor: string;
  headingColor: string;
  linkColor: string;
  wikiLinkColor: string;
  wikiLinkMode: WikiLinkMode;
  paperColor: string;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
  avoidHeadingBreaks: boolean;
  keepFiguresTogether: boolean;
}

export const DEFAULT_PROFILE: ExportProfile = {
  preset: "academic",
  pageSize: "A4",
  orientation: "portrait",
  marginTop: 22,
  marginRight: 22,
  marginBottom: 24,
  marginLeft: 22,
  bodyFont: "source-serif",
  headingFont: "source-sans",
  bodySize: 11,
  lineHeight: 1.75,
  paragraphSpacing: 7,
  firstLineIndent: 0,
  h1Size: 24,
  h2Size: 19,
  h3Size: 16,
  h4Size: 14,
  h5Size: 12,
  h6Size: 11,
  textColor: "#242424",
  headingColor: "#17231e",
  linkColor: "#315f76",
  wikiLinkColor: "#315f76",
  wikiLinkMode: "link",
  paperColor: "#ffffff",
  headerText: "",
  footerText: "",
  showPageNumbers: true,
  avoidHeadingBreaks: true,
  keepFiguresTogether: true,
};

const FONT_STACKS: Record<string, string> = {
  "source-serif":
    '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", SimSun, Georgia, serif',
  "source-sans":
    '"Source Han Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif',
  lxgw: '"LXGW WenKai", "KaiTi", cursive',
  times: '"Times New Roman", "Source Han Serif SC", SimSun, serif',
  georgia: 'Georgia, "Source Han Serif SC", SimSun, serif',
};

export function presetProfile(preset: ExportProfile["preset"]): ExportProfile {
  const base = { ...DEFAULT_PROFILE, preset };
  if (preset === "report")
    return {
      ...base,
      bodyFont: "source-sans",
      bodySize: 10.5,
      lineHeight: 1.65,
      h1Size: 26,
      headingColor: "#173c4d",
      linkColor: "#176c88",
    };
  if (preset === "manuscript")
    return {
      ...base,
      bodyFont: "times",
      headingFont: "times",
      bodySize: 12,
      lineHeight: 2,
      h1Size: 20,
      h2Size: 16,
      h3Size: 14,
      textColor: "#111111",
      headingColor: "#111111",
    };
  return base;
}

export function buildExportCss(profile: ExportProfile): string {
  const p = normalized(profile);
  const headingSizes = [
    p.h1Size,
    p.h2Size,
    p.h3Size,
    p.h4Size,
    p.h5Size,
    p.h6Size,
  ];
  const portrait = p.pageSize === "A4" ? [210, 297] : [215.9, 279.4];
  const [paperWidth, paperHeight] =
    p.orientation === "portrait" ? portrait : [portrait[1], portrait[0]];
  return `
@page { size: ${p.pageSize} ${p.orientation}; margin: 0; }
.better-export-document {
  --be-text: ${p.textColor}; --be-heading: ${p.headingColor}; --be-link: ${p.linkColor}; --be-paper: ${p.paperColor};
  color: var(--be-text);
  font-family: ${FONT_STACKS[p.bodyFont] ?? FONT_STACKS["source-serif"]};
  font-size: ${p.bodySize}pt; line-height: ${p.lineHeight};
}
.better-export-page {
  position: relative; box-sizing: border-box; width: ${paperWidth}mm; height: ${paperHeight}mm;
  padding: ${p.marginTop}mm ${p.marginRight}mm ${p.marginBottom}mm ${p.marginLeft}mm;
  overflow: hidden; color: var(--be-text); background: var(--be-paper);
}
.better-export-page-body { height: 100%; overflow: hidden; display: flex; flex-direction: column; }
.better-export-page-content { min-height: 0; flex: 1 1 auto; overflow: hidden; }
.better-export-page-notes { display: none; flex: 0 0 auto; margin-top: 5pt; padding-top: 4pt; border-top: .65pt solid #4f5552; font-size: 8.25pt; line-height: 1.35; }
.better-export-page-notes.is-visible { display: block; }
.better-export-page-note { display: grid; grid-template-columns: 1.6em 1fr; gap: .35em; margin: 0 0 2.5pt; }
.better-export-page-note-number { font-variant-numeric: tabular-nums; }
.better-export-cite-marker { color: inherit; font-size: .72em; line-height: 0; vertical-align: super; }
.better-export-missing-citation { padding: 0 .3em; border-bottom: 1pt wavy #b24b38; color: #a23f30; background: rgba(178,75,56,.08); font-size: .88em; }
.better-export-custom-header { position: relative; flex: 0 0 auto; margin: 0 0 9mm; padding: 0 0 4mm; font-family: ${FONT_STACKS[p.headingFont] ?? FONT_STACKS["source-sans"]}; font-size: 10.5pt; line-height: 1.3; }
.better-export-custom-header > .better-export-template-image { position: absolute; left: 0; top: 0; width: 18mm; height: 18mm; object-fit: contain; }
.better-export-custom-header:has(> .better-export-template-image) .better-export-header-grid { padding-left: 23mm; }
.better-export-header-row { display: flex; align-items: stretch; }
.better-export-header-cell { min-width: 0; padding: 2.2pt 5pt; white-space: pre-wrap; }
.better-export-header-cell.is-bold { font-weight: 700; }
.better-export-header-cell.is-underline { border-bottom: .6pt solid #303330; }
.better-export-custom-header.is-underline .better-export-header-cell { border-bottom: .6pt solid #303330; }
.better-export-custom-header.is-grid .better-export-header-cell { border: .6pt solid #303330; margin: -.3pt; }
.better-export-header-rule { margin-top: 5pt; border-top: 1pt solid #222; }
.better-export-cover { box-sizing: border-box; height: 100%; overflow: hidden; padding: 0 7%; font-family: ${FONT_STACKS[p.headingFont] ?? FONT_STACKS["source-sans"]}; color: var(--be-text); }
.better-export-cover > .better-export-template-image { display: block; width: auto; max-width: 48mm; max-height: 32mm; margin: 12mm auto 4mm; object-fit: contain; }
.better-export-cover-grid { width: 100%; }
.better-export-cover .better-export-header-cell { padding: 1.5pt 7pt; white-space: pre-wrap; }
.better-export-document .metadata-container { display: none; }
.better-export-document p { margin: 0 0 ${p.paragraphSpacing}pt; text-indent: ${p.firstLineIndent}em; orphans: 3; widows: 3; }
.better-export-document li > p, .better-export-document blockquote p, .better-export-document td p { text-indent: 0; }
.better-export-document h1, .better-export-document h2, .better-export-document h3,
.better-export-document h4, .better-export-document h5, .better-export-document h6 {
  color: var(--be-heading); font-family: ${FONT_STACKS[p.headingFont] ?? FONT_STACKS["source-sans"]};
  line-height: 1.28; margin: 1.25em 0 .55em; ${p.avoidHeadingBreaks ? "break-after: avoid; page-break-after: avoid;" : ""}
}
${headingSizes.map((size, index) => `.better-export-document h${index + 1} { font-size: ${size}pt; }`).join("\n")}
.better-export-document a { color: var(--be-link); text-decoration: none; }
.better-export-document a.internal-link,.better-export-document a.internal-link.is-unresolved {color:${p.wikiLinkColor} !important;opacity:1;text-decoration:none;}
.better-export-document .better-export-wiki-text,.better-export-document .better-export-wiki-source {color:inherit;}
.better-export-header-cell p {font-size:inherit;line-height:inherit;text-indent:0;margin:0 0 .3em;white-space:normal;}
.better-export-header-cell p:last-child {margin-bottom:0;}
.better-export-header-cell .math-block {margin:.25em 0;}
.better-export-page.better-export-image-cover {padding:0;}
.better-export-image-cover > img {display:block;width:100%;height:100%;max-width:none;}
.better-export-document img, .better-export-document video, .better-export-document svg { max-width: 100%; }
.better-export-document table { width: 100%; border-collapse: collapse; font-size: .92em; }
.better-export-document th, .better-export-document td { padding: .45em .55em; border: .5pt solid #aeb5b1; vertical-align: top; }
.better-export-document th { background: #eef1ef; color: var(--be-heading); font-weight: 700; }
.better-export-document pre, .better-export-document blockquote { break-inside: avoid; }
.better-export-document pre { padding: 10pt; border: .5pt solid #d5d9d7; background: #f5f6f5; white-space: pre-wrap; }
.better-export-document blockquote { margin-inline: 0; padding: 4pt 12pt; border-left: 2.5pt solid var(--be-link); color: #46504c; }
${p.keepFiguresTogether ? ".better-export-document .image-embed, .better-export-document .media-embed, .better-export-document figure { break-inside: avoid; page-break-inside: avoid; }" : ""}
.better-export-print-header, .better-export-print-footer { position: absolute; left: ${p.marginLeft}mm; right: ${p.marginRight}mm; display: block; color: #6f7773; font-size: 8pt; line-height: 1.2; }
.better-export-print-header { top: ${Math.max(3, p.marginTop * 0.38)}mm; }
.better-export-print-footer { bottom: ${Math.max(3, p.marginBottom * 0.38)}mm; display: flex; justify-content: center; gap: .45em; }
@media print {
  .better-export-page { margin: 0 !important; border: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .better-export-page:last-child { break-after: auto; page-break-after: auto; }
}
`;
}

function normalized(profile: ExportProfile): ExportProfile {
  const number = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  const color = (value: string, fallback: string): string =>
    /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  return {
    ...profile,
    marginTop: number(profile.marginTop, 5, 60),
    marginRight: number(profile.marginRight, 5, 60),
    marginBottom: number(profile.marginBottom, 5, 60),
    marginLeft: number(profile.marginLeft, 5, 60),
    bodySize: number(profile.bodySize, 7, 24),
    lineHeight: number(profile.lineHeight, 1, 3),
    paragraphSpacing: number(profile.paragraphSpacing, 0, 30),
    firstLineIndent: number(profile.firstLineIndent, 0, 4),
    h1Size: number(profile.h1Size, 10, 48),
    h2Size: number(profile.h2Size, 10, 42),
    h3Size: number(profile.h3Size, 9, 36),
    h4Size: number(profile.h4Size, 8, 30),
    h5Size: number(profile.h5Size, 8, 26),
    h6Size: number(profile.h6Size, 8, 24),
    textColor: color(profile.textColor, DEFAULT_PROFILE.textColor),
    headingColor: color(profile.headingColor, DEFAULT_PROFILE.headingColor),
    linkColor: color(profile.linkColor, DEFAULT_PROFILE.linkColor),
    wikiLinkColor: color(
      profile.wikiLinkColor,
      profile.linkColor || DEFAULT_PROFILE.wikiLinkColor,
    ),
    wikiLinkMode: ["link", "text", "source"].includes(profile.wikiLinkMode)
      ? profile.wikiLinkMode
      : "link",
    paperColor: color(profile.paperColor, DEFAULT_PROFILE.paperColor),
  };
}
