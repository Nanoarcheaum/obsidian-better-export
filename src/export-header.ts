import { mapProse } from "./markdown-options";
export type HeaderRepeat = "first" | "all";
export type HeaderBorder = "none" | "underline" | "grid";
export type HeaderAlign = "left" | "center" | "right";

export interface HeaderCell {
  text: string;
  width: number;
  fontSize: number;
  align: HeaderAlign;
  bold: boolean;
  underline: boolean;
}

export interface HeaderRow {
  cells: HeaderCell[];
  hiddenCells?: HeaderCell[];
  gapBefore: number;
  gapAfter: number;
}

export interface ExportHeaderTemplate {
  id: string;
  name: string;
  repeat: HeaderRepeat;
  logoPath: string;
  border: HeaderBorder;
  showRule: boolean;
  rows: HeaderRow[];
}

export interface ExportCoverTemplate {
  id: string;
  name: string;
  logoPath: string;
  showPageNumber: boolean;
  rows: HeaderRow[];
  mode?: "grid" | "image";
  imagePath?: string;
  imageFit?: "contain" | "cover";
}

export function starterHeader(): ExportHeaderTemplate {
  return {
    id: crypto.randomUUID(),
    name: "通用实验报告版头",
    repeat: "all",
    logoPath: "",
    border: "none",
    showRule: true,
    rows: [
      {
        gapBefore: 0,
        gapAfter: 2,
        cells: [
          {
            text: "{{学年学期}} 《{{课程名称}}》实验报告",
            width: 1,
            fontSize: 16,
            align: "center",
            bold: true,
            underline: false,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 0,
        cells: [
          {
            text: "实验名称：{{实验名称}}",
            width: 1,
            fontSize: 10.5,
            align: "left",
            bold: true,
            underline: true,
          },
          {
            text: "姓名/同组同学：{{姓名}}",
            width: 1,
            fontSize: 10.5,
            align: "left",
            bold: true,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 0,
        cells: [
          {
            text: "实验时间：{{实验时间}}",
            width: 1,
            fontSize: 10.5,
            align: "left",
            bold: true,
            underline: true,
          },
          {
            text: "指导老师/助教：{{指导老师}}",
            width: 1,
            fontSize: 10.5,
            align: "left",
            bold: true,
            underline: true,
          },
        ],
      },
    ],
  };
}

export function blankHeader(): ExportHeaderTemplate {
  return {
    id: crypto.randomUUID(),
    name: "未命名版头",
    repeat: "first",
    logoPath: "",
    border: "none",
    showRule: true,
    rows: [
      {
        gapBefore: 0,
        gapAfter: 0,
        cells: [
          {
            text: "{{标题}}",
            width: 1,
            fontSize: 14,
            align: "center",
            bold: true,
            underline: false,
          },
        ],
      },
    ],
  };
}

export function blankCover(): ExportCoverTemplate {
  return {
    id: crypto.randomUUID(),
    name: "未命名封面",
    logoPath: "",
    showPageNumber: false,
    rows: [
      {
        gapBefore: 40,
        gapAfter: 24,
        cells: [
          {
            text: "{{报告标题}}",
            width: 1,
            fontSize: 28,
            align: "center",
            bold: true,
            underline: false,
          },
        ],
      },
    ],
  };
}

export function starterCover(): ExportCoverTemplate {
  return {
    id: crypto.randomUUID(),
    name: "通用实验报告封面",
    logoPath: "",
    showPageNumber: false,
    rows: [
      {
        gapBefore: 32,
        gapAfter: 34,
        cells: [
          {
            text: "{{报告标题}}",
            width: 1,
            fontSize: 28,
            align: "center",
            bold: true,
            underline: false,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 7,
        cells: [
          {
            text: "实验名称：{{实验名称}}",
            width: 1,
            fontSize: 14,
            align: "left",
            bold: true,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 7,
        cells: [
          {
            text: "实验桌号：{{实验桌号}}",
            width: 1,
            fontSize: 14,
            align: "left",
            bold: true,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 30,
        cells: [
          {
            text: "指导教师：{{指导教师}}",
            width: 1,
            fontSize: 14,
            align: "left",
            bold: true,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 7,
        cells: [
          {
            text: "周次：{{周次}}",
            width: 1,
            fontSize: 13,
            align: "left",
            bold: false,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 7,
        cells: [
          {
            text: "姓名：{{姓名}}",
            width: 1,
            fontSize: 13,
            align: "left",
            bold: false,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 24,
        cells: [
          {
            text: "学号：{{学号}}",
            width: 1,
            fontSize: 13,
            align: "left",
            bold: false,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 34,
        cells: [
          {
            text: "实验日期：{{实验日期}}",
            width: 1,
            fontSize: 13,
            align: "left",
            bold: false,
            underline: true,
          },
        ],
      },
      {
        gapBefore: 0,
        gapAfter: 0,
        cells: [
          {
            text: "{{单位名称}}",
            width: 1,
            fontSize: 12,
            align: "center",
            bold: false,
            underline: false,
          },
        ],
      },
    ],
  };
}

export function headerFields(
  template:
    Pick<ExportHeaderTemplate, "rows"> | Pick<ExportCoverTemplate, "rows">,
): string[] {
  const found: string[] = [];
  for (const row of template.rows)
    for (const cell of row.cells) {
      mapProse(cell.text, (text) => {
        for (const match of text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)) {
          const key = match[1]?.trim();
          if (key && !found.includes(key)) found.push(key);
        }
        return text;
      });
    }
  return found;
}

export function fillHeaderText(
  text: string,
  values: Record<string, string>,
): string {
  return mapProse(text, (part) =>
    part.replace(
      /\{\{\s*([^{}]+?)\s*\}\}/g,
      (_, key: string) => values[key.trim()] ?? "",
    ),
  );
}

export function setRowColumnCount(row: HeaderRow, count: number): HeaderRow {
  const target = Math.max(1, Math.min(4, Math.round(count) || 1));
  const all = [...row.cells, ...(row.hiddenCells ?? [])];
  const cells = all.slice(0, target).map((cell) => ({ ...cell }));
  while (cells.length < target)
    cells.push({
      text: "",
      width: 1,
      fontSize: 10.5,
      align: "left",
      bold: false,
      underline: false,
    });
  return {
    ...row,
    cells,
    hiddenCells: all.slice(target).map((cell) => ({ ...cell })),
  };
}

export function normalizeHeader(
  template: ExportHeaderTemplate,
): ExportHeaderTemplate {
  return {
    ...template,
    name: template.name?.trim() || "未命名版头",
    repeat: template.repeat === "all" ? "all" : "first",
    border: ["none", "underline", "grid"].includes(template.border)
      ? template.border
      : "none",
    rows: normalizeRows(template.rows),
  };
}

export function normalizeCover(
  template: ExportCoverTemplate,
): ExportCoverTemplate {
  return {
    ...template,
    name: template.name?.trim() || "未命名封面",
    mode: template.mode === "image" ? "image" : "grid",
    imagePath: String(template.imagePath ?? ""),
    imageFit: template.imageFit === "cover" ? "cover" : "contain",
    showPageNumber: Boolean(template.showPageNumber),
    rows: normalizeRows(template.rows),
  };
}

function normalizeRows(rows: HeaderRow[]): HeaderRow[] {
  return Array.isArray(rows) && rows.length
    ? rows.map((row) => ({
        hiddenCells: Array.isArray(row.hiddenCells)
          ? row.hiddenCells.map((cell) => ({ ...cell }))
          : [],
        gapBefore: clampGap(row.gapBefore),
        gapAfter: clampGap(row.gapAfter),
        cells:
          Array.isArray(row.cells) && row.cells.length
            ? row.cells.map((cell) => ({
                text: String(cell.text ?? ""),
                width: Math.max(1, Math.min(12, Number(cell.width) || 1)),
                fontSize: Math.max(
                  6,
                  Math.min(36, Number(cell.fontSize) || 10.5),
                ),
                align: ["left", "center", "right"].includes(cell.align)
                  ? cell.align
                  : "left",
                bold: Boolean(cell.bold),
                underline: Boolean(cell.underline),
              }))
            : [
                {
                  text: "",
                  width: 1,
                  fontSize: 10.5,
                  align: "left",
                  bold: false,
                  underline: false,
                },
              ],
      }))
    : [
        {
          gapBefore: 0,
          gapAfter: 0,
          cells: [
            {
              text: "",
              width: 1,
              fontSize: 10.5,
              align: "left",
              bold: false,
              underline: false,
            },
          ],
        },
      ];
}

function clampGap(value: number): number {
  return Math.max(0, Math.min(80, Number(value) || 0));
}
