import { prepareWikiLinks, applyWikiLinkMode } from "./markdown-options";
import {
  CitationOptions,
  GlobalTemplate,
  currentHeader,
  currentCover,
  captureGlobal,
  applyGlobal,
  normalizeGlobal,
  deleteFurniture,
  copy,
} from "./template-library";
import { appendCitationHtml } from "./csl-engine";
import { mergeReferences } from "./reference-library";
import { paginate, waitForAssets, LayoutError } from "./pagination";
import {
  citationProblems,
  citationTokens,
  validCitationKey,
} from "./citation-syntax";
import {
  App,
  Component,
  Editor,
  MarkdownRenderer,
  finishRenderMath,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  setIcon,
} from "obsidian";
import {
  MediaLayoutOptions,
  formatMediaLayout,
  mediaEmbeds,
  readMediaLayout,
  clearMediaLayout,
} from "./media-layout";
import {
  DEFAULT_PROFILE,
  ExportProfile,
  buildExportCss,
  presetProfile,
} from "./export-style";
import {
  CitationPlacement,
  CitationStyle,
  ReferenceRecord,
  bibliographyEntry,
  citationKeys,
  buildCitationDocument,
  stripCitationTokens,
} from "./citations";
import {
  ExportCoverTemplate,
  ExportHeaderTemplate,
  HeaderRow,
  blankCover,
  blankHeader,
  fillHeaderText,
  headerFields,
  normalizeCover,
  normalizeHeader,
  setRowColumnCount,
} from "./export-header";
import { ImportedReference, parseZotero } from "./zotero-import";
import {
  VaultReference,
  referenceFromVaultNote,
  vaultReferenceMatches,
} from "./vault-reference";

interface PanelState {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Settings {
  globalTemplates: GlobalTemplate[];
  documentHeaderSnapshots: Record<string, ExportHeaderTemplate>;
  documentCoverSnapshots: Record<string, ExportCoverTemplate>;
  documentCitationOptions: Record<string, CitationOptions>;
  hideAttachmentFolders: boolean;
  attachmentFolderName: string;
  exportProfile: ExportProfile;
  citationStyle: CitationStyle;
  citationPlacement: CitationPlacement;
  references: ReferenceRecord[];
  headerTemplates: ExportHeaderTemplate[];
  documentHeaderIds: Record<string, string>;
  documentHeaderValues: Record<string, Record<string, string>>;
  coverTemplates: ExportCoverTemplate[];
  documentCoverIds: Record<string, string>;
  documentCoverValues: Record<string, Record<string, string>>;
  panel: PanelState;
  documentProfiles: Record<string, ExportProfile>;
}
const DEFAULTS: Settings = {
  globalTemplates: [],
  documentHeaderSnapshots: {},
  documentCoverSnapshots: {},
  documentCitationOptions: {},
  hideAttachmentFolders: true,
  attachmentFolderName: "",
  exportProfile: DEFAULT_PROFILE,
  citationStyle: "apa7",
  citationPlacement: "bibliography",
  references: [],
  headerTemplates: [],
  documentHeaderIds: {},
  documentHeaderValues: {},
  coverTemplates: [],
  documentCoverIds: {},
  documentCoverValues: {},
  documentProfiles: {},
  panel: { x: 80, y: 60, width: 1180, height: 760 },
};

export default class BetterExportPlugin extends Plugin {
  settings: Settings = DEFAULTS;
  private folderStyle: HTMLStyleElement | null = null;
  private panel: ExportPanel | null = null;
  private popover: HTMLElement | null = null;
  private opening = 0;
  async onload(): Promise<void> {
    await this.loadSettings();
    this.addRibbonIcon(
      "file-output",
      "Better Export",
      () => void this.openPanel(),
    );
    this.addCommand({
      id: "open-export-window",
      name: "打开 PDF 导出悬浮窗",
      callback: () => void this.openPanel(),
    });
    this.addCommand({
      id: "format-media-layout",
      name: "排版选中的图片 / 视频",
      editorCallback: (e) => this.mediaPopover(e),
    });
    this.addCommand({
      id: "format-selected-text",
      name: "设置选中文字样式",
      editorCallback: (e) => this.textPopover(e),
    });
    this.addCommand({
      id: "insert-page-break",
      name: "插入导出分页符",
      editorCallback: (e) =>
        e.replaceSelection(
          '\n\n<div class="better-export-page-break"></div>\n\n',
        ),
    });
    this.registerDomEvent(
      document,
      "contextmenu",
      (e) => this.context(e),
      true,
    );
    this.registerDomEvent(
      document,
      "pointerdown",
      (e) => {
        if (
          this.popover &&
          !(e.target as HTMLElement)?.closest(".better-export-context-toolbar")
        )
          this.closePopover();
      },
      true,
    );
    this.registerDomEvent(
      document,
      "keydown",
      (e) => {
        if (e.key === "Escape") this.closePopover();
      },
      true,
    );
    this.app.workspace.onLayoutReady(() => this.applyFolderVisibility());
    this.addSettingTab(new SettingsTab(this.app, this));
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        const remap = (path: string) =>
          path === oldPath || path.startsWith(oldPath + "/")
            ? file.path + path.slice(oldPath.length)
            : path;
        for (const map of [
          this.settings.documentProfiles,
          this.settings.documentHeaderSnapshots,
          this.settings.documentCoverSnapshots,
          this.settings.documentCitationOptions,
          this.settings.documentHeaderIds,
          this.settings.documentCoverIds,
          this.settings.documentHeaderValues,
          this.settings.documentCoverValues,
        ]) {
          for (const key of Object.keys(map)) {
            const next = remap(key);
            if (next !== key) {
              Object.assign(map, { [next]: map[key] });
              delete map[key];
            }
          }
        }
        for (const template of [
          ...this.settings.headerTemplates,
          ...this.settings.coverTemplates,
          ...Object.values(this.settings.documentHeaderSnapshots),
          ...Object.values(this.settings.documentCoverSnapshots),
          ...this.settings.globalTemplates.flatMap(
            (t) =>
              [t.header, t.cover].filter(Boolean) as (
                ExportHeaderTemplate | ExportCoverTemplate
              )[],
          ),
        ]) {
          template.logoPath = remap(template.logoPath || "");
          if ("imagePath" in template)
            template.imagePath = remap(template.imagePath || "");
        }
        for (const ref of [
          ...this.settings.references,
          ...this.settings.globalTemplates.flatMap((t) => t.references ?? []),
        ])
          if (ref.sourcePath) ref.sourcePath = remap(ref.sourcePath);
        void this.save();
        this.panel?.invalidate();
      }),
    );
  }
  onunload(): void {
    this.opening++;
    this.panel?.close();
    this.closePopover();
    this.folderStyle?.remove();
    document.body.removeClass("better-export-printing");
  }
  async loadSettings(): Promise<void> {
    const s = (await this.loadData()) as Partial<Settings> | null;
    this.settings = {
      ...DEFAULTS,
      ...s,
      globalTemplates: (s?.globalTemplates ?? []).map(normalizeGlobal),
      documentHeaderSnapshots: s?.documentHeaderSnapshots ?? {},
      documentCoverSnapshots: s?.documentCoverSnapshots ?? {},
      documentCitationOptions: s?.documentCitationOptions ?? {},
      documentProfiles: s?.documentProfiles ?? {},
      exportProfile: { ...DEFAULT_PROFILE, ...s?.exportProfile },
      panel: { ...DEFAULTS.panel, ...s?.panel },
      references: Array.isArray(s?.references) ? s.references : [],
      headerTemplates: Array.isArray(s?.headerTemplates)
        ? s.headerTemplates.map(normalizeHeader)
        : [],
      documentHeaderIds: s?.documentHeaderIds ?? {},
      documentHeaderValues: s?.documentHeaderValues ?? {},
      coverTemplates: Array.isArray(s?.coverTemplates)
        ? s.coverTemplates.map(normalizeCover)
        : [],
      documentCoverIds: s?.documentCoverIds ?? {},
      documentCoverValues: s?.documentCoverValues ?? {},
    };
  }
  private saving: Promise<void> = Promise.resolve();
  async save(): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(this.settings));
    this.saving = this.saving
      .catch(() => {})
      .then(() => this.saveData(snapshot));
    try {
      await this.saving;
    } catch (error) {
      new Notice("设置未保存，请检查库目录是否可写");
      throw error;
    }
  }
  applyFolderVisibility(): void {
    this.folderStyle?.remove();
    this.folderStyle = null;
    if (!this.settings.hideAttachmentFolders) return;
    const n = this.folderName();
    if (!n) return;
    const q = n.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    this.folderStyle = document.head.createEl("style");
    this.folderStyle.textContent = `.nav-folder-title[data-path="${q}"],.nav-folder-title[data-path="${q}"]+.nav-folder-children,.nav-folder-title[data-path$="/${q}"],.nav-folder-title[data-path$="/${q}"]+.nav-folder-children{display:none!important}`;
  }
  private folderName(): string {
    if (this.settings.attachmentFolderName.trim())
      return this.settings.attachmentFolderName.trim();
    const v = this.app.vault as typeof this.app.vault & {
      getConfig?: (k: string) => unknown;
    };
    return (
      String(v.getConfig?.("attachmentFolderPath") ?? "")
        .replace(/\\/g, "/")
        .replace(/\/$/, "")
        .split("/")
        .filter((x) => x && x !== ".")
        .at(-1) ?? ""
    );
  }
  private async openPanel(): Promise<void> {
    const opening = ++this.opening;
    const f = this.app.workspace.getActiveFile();
    if (!(f instanceof TFile) || f.extension !== "md") {
      new Notice("请先打开需要导出的 Markdown 文档");
      return;
    }
    const markdown = await this.app.vault.read(f);
    if (opening !== this.opening) return;
    this.panel?.close();
    this.panel = new ExportPanel(this, f, markdown, () => (this.panel = null));
    this.panel.open();
  }
  private context(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (!t?.closest(".markdown-source-view,.markdown-preview-view")) return;
    const v = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!v) return;
    if (!this.locateMedia(v.editor, t)) return;
    const s =
      v.editor.getSelection() || v.editor.getLine(v.editor.getCursor().line);
    if (!v.editor.getSelection().trim() && !mediaEmbeds(s).length) return;
    e.preventDefault();
    e.stopPropagation();
    mediaEmbeds(s).length
      ? this.mediaPopover(v.editor, e.clientX, e.clientY)
      : this.textPopover(v.editor, e.clientX, e.clientY);
  }
  private locateMedia(e: Editor, t: HTMLElement): boolean {
    if (e.getSelection().trim()) return true;
    const embed = t.closest<HTMLElement>(".internal-embed");
    if (!embed) return true;
    const src =
      embed.getAttribute("src") ?? embed.getAttribute("data-href") ?? "";
    let name = "";
    try {
      name =
        decodeURIComponent(src)
          .replace(/\\/g, "/")
          .split("/")
          .at(-1)
          ?.split("?")[0] ?? "";
    } catch {
      return false;
    }
    if (!name) return false;
    const matches: number[] = [];
    for (let i = 0; i < e.lineCount(); i++)
      if (
        mediaEmbeds(e.getLine(i)).some(
          (link) => link.includes(src) || link.includes(name),
        )
      )
        matches.push(i);
    if (matches.length !== 1) {
      new Notice("这张媒体有多处引用，请在正文选中需要调整的链接");
      return false;
    }
    e.setCursor({ line: matches[0]!, ch: 0 });
    return true;
  }
  private basePopover(x: number, y: number, title: string): HTMLElement {
    this.closePopover();
    const p = document.body.createDiv({ cls: "better-export-context-toolbar" });
    p.createEl("strong", { text: title });
    this.popover = p;
    requestAnimationFrame(() => place(p, x, y));
    return p;
  }
  private mediaPopover(
    e: Editor,
    x = innerWidth / 2,
    y = innerHeight / 2,
  ): void {
    const from = e.getCursor("from"),
      to = e.getCursor("to");
    const selected = e.getSelection(),
      c = e.getCursor(),
      src = selected || e.getLine(c.line),
      count = mediaEmbeds(src).length;
    if (!count) {
      new Notice("请选中媒体链接，或在媒体上点击右键");
      return;
    }
    const o: MediaLayoutOptions = {
      align: "center",
      width: count > 1 ? "100" : "75",
      columns: count > 1 ? (Math.min(count, 4) as 2 | 3 | 4) : 1,
      gap: "m",
      crop: false,
      ...(src.includes("better-export-media") ? readMediaLayout(src) : {}),
    };
    const p = this.basePopover(x, y, "媒体排版");
    select(
      p,
      { "1": "1列", "2": "2列", "3": "3列", "4": "4列" },
      String(o.columns),
      (v) => (o.columns = Number(v) as 1 | 2 | 3 | 4),
    );
    select(
      p,
      { left: "左", center: "中", right: "右" },
      o.align,
      (v) => (o.align = v as typeof o.align),
    );
    select(
      p,
      {
        auto: "原始",
        "25": "25%",
        "33": "33%",
        "50": "50%",
        "66": "66%",
        "75": "75%",
        "100": "100%",
      },
      o.width,
      (v) => (o.width = v as typeof o.width),
    );
    select(
      p,
      { s: "窄", m: "中", l: "宽" },
      o.gap,
      (v) => (o.gap = v as typeof o.gap),
    );
    const l = p.createEl("label");
    const ck = l.createEl("input");
    ck.type = "checkbox";
    ck.checked = o.crop;
    l.appendText("4:3");
    ck.onchange = () => (o.crop = ck.checked);
    button(p, "清除排版", () => {
      if ((selected ? e.getRange(from, to) : e.getLine(c.line)) !== src) {
        new Notice("内容已变化，请重新选择");
        return;
      }
      e.replaceRange(
        clearMediaLayout(src),
        selected ? from : { line: c.line, ch: 0 },
        selected ? to : { line: c.line, ch: src.length },
      );
      this.closePopover();
    });
    button(
      p,
      "应用",
      () => {
        try {
          const r = formatMediaLayout(src, o);
          if (!r) return;
          if ((selected ? e.getRange(from, to) : e.getLine(c.line)) !== src) {
            new Notice("选区内容已变化，请重新选择后排版");
            return;
          }
          selected
            ? e.replaceRange(r.markdown, from, to)
            : e.replaceRange(
                r.markdown,
                { line: c.line, ch: 0 },
                { line: c.line, ch: src.length },
              );
          this.closePopover();
        } catch (err) {
          new Notice(err instanceof Error ? err.message : "排版失败");
        }
      },
      true,
    );
  }
  private textPopover(
    e: Editor,
    x = innerWidth / 2,
    y = innerHeight / 2,
  ): void {
    const from = e.getCursor("from"),
      to = e.getCursor("to");
    const s = e.getSelection();
    if (!s.trim()) {
      new Notice("请先选中文字");
      return;
    }
    const p = this.basePopover(x, y, "文字排版"),
      color = p.createEl("input"),
      size = p.createEl("input");
    color.type = "color";
    color.value = "#242424";
    size.type = "number";
    size.min = "7";
    size.max = "36";
    size.step = ".5";
    size.value = "11";
    size.className = "better-export-size-input";
    wheelNumber(size);
    const state = { b: false, i: false, u: false };
    toggle(p, "B", (v) => (state.b = v));
    toggle(p, "I", (v) => (state.i = v));
    toggle(p, "U", (v) => (state.u = v));
    button(
      p,
      "应用",
      () => {
        const st = [
          `color:${color.value}`,
          `font-size:${Number(size.value) || 11}pt`,
          state.b ? "font-weight:700" : "",
          state.i ? "font-style:italic" : "",
          state.u ? "text-decoration:underline" : "",
        ]
          .filter(Boolean)
          .join(";");
        if (e.getRange(from, to) !== s) {
          new Notice("选区内容已变化，请重新选择后排版");
          return;
        }
        e.replaceRange(`<span style="${st}">${s}</span>`, from, to);
        this.closePopover();
      },
      true,
    );
  }
  private closePopover(): void {
    const p = this.popover;
    this.popover = null;
    if (p) {
      p.addClass("is-closing");
      window.setTimeout(() => p.remove(), 110);
    }
  }
}

class ExportPanel extends Component {
  private el!: HTMLElement;
  private side!: HTMLElement;
  private preview!: HTMLElement;
  private statusEl!: HTMLElement;
  private style: HTMLStyleElement | null = null;
  private profile: ExportProfile;
  private markdown: string;
  private tab: "layout" | "header" | "cite" = "layout";
  private templatesOpen = false;
  private citationOptions: CitationOptions;
  private undoDeletion: (() => void) | null = null;
  private templateUndo: string[] = [];
  private furnitureMode: "cover" | "header" = "cover";
  private vaultReferences: VaultReference[] | null = null;
  private timer = 0;
  private saveTimer = 0;
  private renderVersion = 0;
  private isRendering = false;
  private closed = false;
  private dirty = true;
  private ready = false;
  private noteEntries = new Map<string, string>();
  private printButton: HTMLButtonElement | null = null;
  private renderChild: Component | null = null;
  private printCleanup: (() => void) | null = null;
  private targetView: MarkdownView | null = null;
  constructor(
    private plugin: BetterExportPlugin,
    private file: TFile,
    md: string,
    private done: () => void,
  ) {
    super();
    this.markdown = md;
    this.citationOptions = {
      ...(plugin.settings.documentCitationOptions[file.path] ?? {
        style: plugin.settings.citationStyle,
        placement: plugin.settings.citationPlacement,
      }),
    };
    this.profile = {
      ...plugin.settings.exportProfile,
      ...plugin.settings.documentProfiles[file.path],
    };
  }
  open(): void {
    this.load();
    const s = this.plugin.settings.panel,
      w = Math.min(s.width, innerWidth - 20),
      h = Math.min(s.height, innerHeight - 20),
      x = Math.max(6, Math.min(s.x, innerWidth - w - 6)),
      y = Math.max(6, Math.min(s.y, innerHeight - 48));
    this.el = document.body.createDiv({ cls: "better-export-floating-panel" });
    this.el.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
    this.header();
    const work = this.el.createDiv({ cls: "better-export-floating-workspace" });
    this.side = work.createDiv({ cls: "better-export-controls" });
    this.preview = work.createDiv({ cls: "better-export-preview-frame" });
    this.targetView = this.documentView();
    const previewTools = work.createDiv({ cls: "better-export-preview-tools" });
    previewTools.createSpan({ text: "纸张预览" });
    const zoom = previewTools.createEl("input", {
      attr: {
        type: "number",
        min: "30",
        max: "130",
        step: "5",
        "aria-label": "预览缩放百分比",
      },
    });
    zoom.value = "75";
    const applyZoom = () =>
      this.preview.style.setProperty(
        "--be-preview-zoom",
        String(Math.max(30, Math.min(130, Number(zoom.value) || 75)) / 100),
      );
    zoom.oninput = applyZoom;
    wheelNumber(zoom);
    applyZoom();
    previewTools.createSpan({ text: "%" });
    button(previewTools, "适合窗口", () => {
      zoom.value = String(
        Math.max(
          30,
          Math.min(
            130,
            Math.floor(
              ((this.preview.clientWidth - 48) /
                (this.profile.orientation === "portrait" ? 794 : 1123)) *
                100,
            ),
          ),
        ),
      );
      applyZoom();
    });
    this.sidebar();
    this.schedule();
    this.registerEvent(
      this.plugin.app.workspace.on("editor-change", (_editor, info) => {
        if (info.file?.path === this.file.path) this.schedule();
      }),
    );
    const refreshTarget = (event: Event) => {
      if (
        !(event.target as HTMLElement)?.closest(".better-export-floating-panel")
      )
        this.refreshCitationAudit();
    };
    this.registerDomEvent(document, "keyup", refreshTarget);
    this.registerDomEvent(document, "pointerup", refreshTarget);
    this.registerEvent(
      this.plugin.app.vault.on("modify", (f) => {
        if (f.path === this.file.path) this.schedule();
      }),
    );
    this.registerEvent(
      this.plugin.app.metadataCache.on("changed", () => {
        this.vaultReferences = null;
      }),
    );
    this.registerEvent(
      this.plugin.app.vault.on("delete", (f) => {
        this.vaultReferences = null;
        if (f.path === this.file.path) this.close();
      }),
    );
    const ro = new ResizeObserver(() => {
      clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => this.saveBounds(), 220);
    });
    ro.observe(this.el);
    this.register(() => ro.disconnect());
  }
  close(): void {
    if (!this.el || this.closed) return;
    this.saveBounds();
    this.closed = true;
    this.renderVersion++;
    clearTimeout(this.timer);
    clearTimeout(this.saveTimer);
    this.printCleanup?.();
    this.renderChild?.unload();
    this.unload();
    this.style?.remove();
    this.el.remove();
    document.body.removeClass("better-export-printing");
    this.done();
  }
  private header(): void {
    const h = this.el.createDiv({ cls: "better-export-floating-header" }),
      id = h.createDiv();
    id.createSpan({ cls: "better-export-kicker", text: "BETTER EXPORT" });
    id.createEl("strong", { text: this.file.basename });
    this.statusEl = id.createSpan({
      cls: "better-export-status",
      text: "准备预览",
      attr: { role: "status", "aria-live": "polite" },
    });
    const a = h.createDiv({ cls: "better-export-window-actions" });
    const min = a.createEl("button", { attr: { "aria-label": "最小化" } }),
      max = a.createEl("button", { attr: { "aria-label": "最大化或还原" } }),
      close = a.createEl("button", { attr: { "aria-label": "关闭" } });
    setIcon(min, "minus");
    setIcon(max, "maximize-2");
    setIcon(close, "x");
    min.onclick = () => {
      if (!this.el.hasClass("is-minimized")) this.saveBounds();
      this.el.toggleClass("is-minimized", !this.el.hasClass("is-minimized"));
      min.setAttribute(
        "aria-label",
        this.el.hasClass("is-minimized") ? "还原窗口" : "最小化",
      );
      if (!this.el.hasClass("is-minimized") && this.dirty) this.schedule();
    };
    max.onclick = () => {
      this.el.removeClass("is-minimized");
      if (this.dirty) this.schedule();
      if (this.el.hasClass("is-maximized")) {
        this.el.removeClass("is-maximized");
        const s = this.plugin.settings.panel;
        this.el.style.cssText = `left:${s.x}px;top:${s.y}px;width:${s.width}px;height:${s.height}px`;
      } else {
        this.saveBounds();
        this.el.addClass("is-maximized");
        this.el.style.cssText =
          "left:6px;top:6px;width:calc(100vw - 12px);height:calc(100vh - 12px)";
      }
    };
    close.onclick = () => this.close();
    h.onpointerdown = (e) => {
      if (
        (e.target as HTMLElement).closest("button") ||
        this.el.hasClass("is-maximized")
      )
        return;
      this.el.addClass("is-dragging");
      const sx = e.clientX,
        sy = e.clientY,
        r = this.el.getBoundingClientRect(),
        move = (m: PointerEvent) => {
          this.el.style.left = `${Math.max(0, Math.min(innerWidth - 100, r.left + m.clientX - sx))}px`;
          this.el.style.top = `${Math.max(0, Math.min(innerHeight - 46, r.top + m.clientY - sy))}px`;
        },
        up = () => {
          removeEventListener("pointermove", move);
          this.el.removeClass("is-dragging");
          this.saveBounds();
        };
      addEventListener("pointermove", move);
      addEventListener("pointerup", up, { once: true });
      this.register(() => {
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", up);
      });
    };
  }
  private sidebar(): void {
    this.el.querySelector(".better-export-image-paste")?.remove();
    this.side.empty();
    const library = this.side.createEl("details", {
      cls: "better-export-global-library",
    });
    library.open = this.templatesOpen;
    const summary = library.createEl("summary", { text: "全局模板" });
    summary.createSpan({
      text: "整套导出配置",
      cls: "better-export-global-hint",
    });
    library.ontoggle = () => {
      this.templatesOpen = library.open;
    };
    this.globalTemplates(
      library.createDiv({ cls: "better-export-global-content" }),
    );
    const tabs = this.side.createDiv({ cls: "better-export-tabs" });
    for (const [k, n] of [
      ["layout", "版式"],
      ["header", "封面·版头"],
      ["cite", "引用"],
    ] as const) {
      const b = tabs.createEl("button", {
        text: n,
        cls: this.tab === k ? "is-active" : "",
      });
      b.onclick = () => {
        this.tab = k;
        this.sidebar();
      };
    }
    this.tab === "layout"
      ? this.layout()
      : this.tab === "header"
        ? this.documentFurniture()
        : this.citations();
    const a = this.side.createDiv({ cls: "better-export-export-actions" });
    button(a, "保存默认", async () => {
      this.plugin.settings.exportProfile = { ...this.profile };
      await this.plugin.save();
      new Notice("已保存默认版式");
    });
    this.printButton = button(a, "导出 PDF", () => void this.print(), true);
    this.updatePrintButton();
    const brand = this.side.createEl("a", {
      cls: "better-export-brand",
      text: "By Nanoarcheaum",
      href: "https://github.com/Nanoarcheaum",
    });
    brand.target = "_blank";
    if (this.tab === "cite") this.refreshCitationAudit();
  }
  private layout(): void {
    group(this.side, "链接", (el) => {
      settingSelect(
        el,
        "双向链接导出",
        { link: "可点击链接", text: "纯文字", source: "保留 [[源码]]" },
        this.profile.wikiLinkMode,
        (v) => this.set("wikiLinkMode", v as ExportProfile["wikiLinkMode"]),
      );
      color(el, "双向链接颜色", this.profile.wikiLinkColor, (v) =>
        this.set("wikiLinkColor", v),
      );
      color(el, "外部链接颜色", this.profile.linkColor, (v) =>
        this.set("linkColor", v),
      );
    });
    this.side.createEl("p", {
      cls: "better-export-help",
      text: "悬浮窗不会阻挡正文编辑；正文修改后自动同步；本篇版式自动保存。",
    });
    group(this.side, "版式", (el) => {
      settingSelect(
        el,
        "预设",
        { academic: "学术论文", report: "研究报告", manuscript: "投稿稿件" },
        this.profile.preset,
        (v) => {
          this.profile = presetProfile(v as ExportProfile["preset"]);
          this.sidebar();
          this.schedule();
        },
      );
      settingSelect(
        el,
        "纸张",
        { A4: "A4", Letter: "Letter" },
        this.profile.pageSize,
        (v) => this.set("pageSize", v as ExportProfile["pageSize"]),
      );
      settingSelect(
        el,
        "方向",
        { portrait: "纵向", landscape: "横向" },
        this.profile.orientation,
        (v) => this.set("orientation", v as ExportProfile["orientation"]),
      );
      for (const [k, n] of [
        ["marginTop", "上"],
        ["marginRight", "右"],
        ["marginBottom", "下"],
        ["marginLeft", "左"],
      ] as const)
        num(el, `${n}边距`, this.profile[k], 5, 60, (v) => this.set(k, v));
    });
    group(this.side, "正文", (el) => {
      font(el, "正文字体", this.profile.bodyFont, (v) =>
        this.set("bodyFont", v),
      );
      num(el, "正文字号", this.profile.bodySize, 7, 24, (v) =>
        this.set("bodySize", v),
      );
      num(
        el,
        "行距",
        this.profile.lineHeight,
        1,
        3,
        (v) => this.set("lineHeight", v),
        0.05,
      );
      num(el, "段后距", this.profile.paragraphSpacing, 0, 30, (v) =>
        this.set("paragraphSpacing", v),
      );
      num(
        el,
        "首行缩进",
        this.profile.firstLineIndent,
        0,
        4,
        (v) => this.set("firstLineIndent", v),
        0.5,
      );
      color(el, "正文颜色", this.profile.textColor, (v) =>
        this.set("textColor", v),
      );
    });
    group(this.side, "标题", (el) => {
      font(el, "标题字体", this.profile.headingFont, (v) =>
        this.set("headingFont", v),
      );
      color(el, "标题颜色", this.profile.headingColor, (v) =>
        this.set("headingColor", v),
      );
      const keys = [
        "h1Size",
        "h2Size",
        "h3Size",
        "h4Size",
        "h5Size",
        "h6Size",
      ] as const;
      keys.forEach((k, i) =>
        num(
          el,
          `${"#".repeat(i + 1)} 标题`,
          this.profile[k],
          8,
          48,
          (v) => this.set(k, v),
          0.5,
        ),
      );
    });
    group(this.side, "分页", (el) => {
      toggleSetting(el, "标题不跨页", this.profile.avoidHeadingBreaks, (v) =>
        this.set("avoidHeadingBreaks", v),
      );
      toggleSetting(el, "图表不拆分", this.profile.keepFiguresTogether, (v) =>
        this.set("keepFiguresTogether", v),
      );
      toggleSetting(el, "页码", this.profile.showPageNumbers, (v) =>
        this.set("showPageNumbers", v),
      );
      textSetting(el, "页眉", this.profile.headerText, (v) =>
        this.set("headerText", v),
      );
      textSetting(el, "页脚", this.profile.footerText, (v) =>
        this.set("footerText", v),
      );
    });
  }
  private removeTemplate(kind: "header" | "cover", id: string): void {
    const removed = deleteFurniture(this.plugin.settings, kind, id);
    if (!removed) return;
    this.templateUndo = [];
    this.undoDeletion = () => {
      if (kind === "header")
        this.plugin.settings.headerTemplates.push(
          removed as ExportHeaderTemplate,
        );
      else
        this.plugin.settings.coverTemplates.push(
          removed as ExportCoverTemplate,
        );
    };
    void this.plugin.save();
    this.sidebar();
    this.schedule();
    new Notice("模板已删除，使用它的文档保留独立版式");
  }
  private globalTemplates(parent: HTMLElement): void {
    parent.createEl("p", {
      cls: "better-export-help",
      text: "保存字体、纸张、链接、版头、封面和引用规则。应用到本篇后可独立调整。",
    });
    let name = "",
      include = false;
    textSetting(parent, "新模板名称", name, (v) => {
      name = v;
    });
    toggleSetting(parent, "同时保存文献库", include, (v) => {
      include = v;
    });
    button(parent, "保存当前为全局模板", () => {
      this.plugin.settings.globalTemplates.push(
        captureGlobal(
          this.plugin.settings,
          this.file.path,
          name,
          this.profile,
          this.citationOptions,
          include,
        ),
      );
      void this.plugin.save();
      this.sidebar();
    });
    if (this.undoDeletion)
      button(parent, "撤销删除", () => {
        this.undoDeletion?.();
        this.undoDeletion = null;
        void this.plugin.save();
        this.sidebar();
      });
    if (!this.plugin.settings.globalTemplates.length)
      parent.createEl("p", {
        text: "尚无全局模板，先调整本篇，再保存。",
        cls: "better-export-help",
      });
    for (const template of this.plugin.settings.globalTemplates)
      group(parent, template.name, (el) => {
        textSetting(el, "名称", template.name, (v) => {
          template.name = v;
          void this.plugin.save();
        });
        el.createEl("p", {
          cls: "better-export-help",
          text:
            (template.cover ? "含封面 · " : "") +
            (template.header ? "含版头 · " : "") +
            template.citations.style +
            (template.references ? " · 含文献库" : ""),
        });
        button(el, "应用到本篇", () => {
          applyGlobal(this.plugin.settings, this.file.path, template);
          this.profile = copy(
            this.plugin.settings.documentProfiles[this.file.path]!,
          );
          this.citationOptions = copy(
            this.plugin.settings.documentCitationOptions[this.file.path]!,
          );
          this.templateUndo = [];
          void this.plugin.save();
          this.sidebar();
          this.schedule();
          new Notice("已应用全局模板");
        });
        button(el, "用当前配置更新", () => {
          const next = captureGlobal(
            this.plugin.settings,
            this.file.path,
            template.name,
            this.profile,
            this.citationOptions,
            !!template.references,
          );
          Object.assign(template, next, { id: template.id });
          void this.plugin.save();
          this.sidebar();
        });
        button(el, "删除全局模板", () => {
          const saved = copy(template);
          this.plugin.settings.globalTemplates =
            this.plugin.settings.globalTemplates.filter(
              (t) => t.id !== template.id,
            );
          this.undoDeletion = () =>
            this.plugin.settings.globalTemplates.push(saved);
          void this.plugin.save();
          this.sidebar();
        });
      });
  }
  private documentFurniture(): void {
    if (this.undoDeletion)
      button(this.side, "撤销删除", () => {
        this.undoDeletion?.();
        this.undoDeletion = null;
        void this.plugin.save();
        this.sidebar();
        this.schedule();
      });
    const undo = button(this.side, "撤销上次模板修改", () => {
      const value = this.templateUndo.pop();
      if (!value) return;
      const snapshot = JSON.parse(value);
      if (snapshot.snapshot) {
        if (snapshot.kind === "cover")
          this.plugin.settings.documentCoverSnapshots[this.file.path] =
            snapshot.template;
        else
          this.plugin.settings.documentHeaderSnapshots[this.file.path] =
            snapshot.template;
        void this.plugin.save();
        this.sidebar();
        this.schedule();
        return;
      }
      const isCover = snapshot.kind === "cover";
      const templates = isCover
        ? this.plugin.settings.coverTemplates
        : this.plugin.settings.headerTemplates;
      const index = templates.findIndex((t) => t.id === snapshot.template.id);
      if (index >= 0) templates[index] = snapshot.template;
      else templates.push(snapshot.template);
      const ids = isCover
        ? this.plugin.settings.documentCoverIds
        : this.plugin.settings.documentHeaderIds;
      ids[this.file.path] = snapshot.documentId;
      void this.plugin.save();
      this.sidebar();
      this.schedule();
    });
    undo.disabled = !this.templateUndo.length;
    this.side.createEl("p", {
      cls: "better-export-help",
      text: "按“封面 → 版头 → 正文”组织导出结构；两者可独立关闭、保存和复用，不改变 Markdown。",
    });
    const flow = this.side.createDiv({ cls: "better-export-structure-flow" });
    flow.createSpan({
      text: "1  封面",
      cls: this.currentCover() ? "is-on" : "",
    });
    flow.createSpan({
      text: "2  版头",
      cls: this.currentHeader() ? "is-on" : "",
    });
    flow.createSpan({ text: "3  正文", cls: "is-on" });
    const switcher = this.side.createDiv({
      cls: "better-export-furniture-switch",
    });
    for (const [key, label] of [
      ["cover", "封面"],
      ["header", "版头"],
    ] as const) {
      const b = button(switcher, label, () => {
        this.furnitureMode = key;
        this.sidebar();
      });
      b.toggleClass("is-active", this.furnitureMode === key);
    }
    this.furnitureMode === "cover" ? this.coverBuilder() : this.headerBuilder();
  }
  private headerBuilder(): void {
    this.side.createEl("p", {
      cls: "better-export-help",
      text: "一行的列数可直接选择；各列宽度按比例计算。{{字段}} 的值只属于当前文档。",
    });
    const activeId =
        this.plugin.settings.documentHeaderIds[this.file.path] ??
        (this.plugin.settings.documentHeaderSnapshots[this.file.path]
          ? "__document__"
          : ""),
      options: Record<string, string> = { "": "不使用版头" };
    if (this.plugin.settings.documentHeaderSnapshots[this.file.path])
      options["__document__"] = "本篇版式（独立副本）";
    for (const t of this.plugin.settings.headerTemplates)
      options[t.id] = t.name;
    settingSelect(this.side, "当前文档", options, activeId, async (id) => {
      if (id === "__document__")
        delete this.plugin.settings.documentHeaderIds[this.file.path];
      else {
        this.plugin.settings.documentHeaderIds[this.file.path] = id;
        delete this.plugin.settings.documentHeaderSnapshots[this.file.path];
      }
      await this.plugin.save();
      this.sidebar();
      this.schedule();
    });
    const actions = this.side.createDiv({
      cls: "better-export-header-actions",
    });
    button(actions, "新建空白", () => void this.createHeader(blankHeader()));

    const template = this.currentHeader();
    if (!template) return;
    if (this.plugin.settings.headerTemplates.some((t) => t.id === template.id))
      button(actions, "删除模板", () =>
        this.removeTemplate("header", template.id),
      );
    button(actions, "复制为新模板", () => {
      const copy = normalizeHeader({
        ...template,
        id: crypto.randomUUID(),
        name: `${template.name} 副本`,
        rows: cloneRows(template.rows),
      });
      void this.createHeader(copy);
    });
    button(actions, "本篇停用", async () => {
      delete this.plugin.settings.documentHeaderIds[this.file.path];
      delete this.plugin.settings.documentHeaderSnapshots[this.file.path];
      await this.plugin.save();
      this.sidebar();
      this.schedule();
    });
    group(this.side, "模板设置", (el) => {
      textSetting(el, "模板名称", template.name, (v) =>
        this.updateHeader((t) => (t.name = v)),
      );
      settingSelect(
        el,
        "出现位置",
        { first: "仅首页", all: "每页重复" },
        template.repeat,
        (v) =>
          this.updateHeader(
            (t) => (t.repeat = v as ExportHeaderTemplate["repeat"]),
          ),
      );
      settingSelect(
        el,
        "单元格边框",
        { none: "无边框", underline: "字段下划线", grid: "完整表格线" },
        template.border,
        (v) =>
          this.updateHeader(
            (t) => (t.border = v as ExportHeaderTemplate["border"]),
          ),
      );
      this.imageControl(el, "版头徽标", template.logoPath, (path) =>
        this.updateHeader((t) => (t.logoPath = path), true),
      );
      toggleSetting(el, "底部分隔线", template.showRule, (v) =>
        this.updateHeader((t) => (t.showRule = v)),
      );
    });
    group(this.side, "网格设计", (el) =>
      this.gridEditor(el, template.rows, (change, rebuild) =>
        this.updateHeader((t) => change(t.rows), rebuild),
      ),
    );
    const fields = headerFields(template);
    if (fields.length)
      group(this.side, "本篇字段", (el) => {
        const values = (this.plugin.settings.documentHeaderValues[
          this.file.path
        ] ??= {});
        for (const key of fields)
          textSetting(el, key, values[key] ?? "", async (v) => {
            values[key] = v;
            this.plugin.settings.documentHeaderValues[this.file.path] = values;
            await this.plugin.save();
            this.schedule();
          });
      });
  }
  private currentHeader(): ExportHeaderTemplate | null {
    return currentHeader(this.plugin.settings, this.file.path);
  }
  private async createHeader(template: ExportHeaderTemplate): Promise<void> {
    delete this.plugin.settings.documentHeaderSnapshots[this.file.path];
    this.plugin.settings.headerTemplates.push(template);
    this.plugin.settings.documentHeaderIds[this.file.path] = template.id;
    await this.plugin.save();
    this.sidebar();
    this.schedule();
  }
  private updateHeader(
    change: (template: ExportHeaderTemplate) => void,
    rebuild = false,
  ): void {
    let template = this.currentHeader();
    if (!template) return;
    this.templateUndo.push(
      JSON.stringify({
        kind: "header",
        snapshot: !this.plugin.settings.documentHeaderIds[this.file.path],
        template,
        documentId: this.plugin.settings.documentHeaderIds[this.file.path],
      }),
    );
    if (this.templateUndo.length > 30) this.templateUndo.shift();
    const shared = Object.entries(this.plugin.settings.documentHeaderIds).some(
      ([path, id]) => path !== this.file.path && id === template!.id,
    );
    if (shared) {
      template = {
        ...template,
        id: crypto.randomUUID(),
        name: template.name + " · 本篇",
        rows: cloneRows(template.rows),
      };
      this.plugin.settings.headerTemplates.push(template);
      this.plugin.settings.documentHeaderIds[this.file.path] = template.id;
      new Notice("已建立本篇模板副本，其他文档保持原版式");
    }
    change(template);
    void this.plugin.save();
    if (rebuild) this.sidebar();
    this.side.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (b.textContent === "撤销上次模板修改") b.disabled = false;
    });
    this.schedule();
  }
  private coverBuilder(): void {
    this.side.createEl("p", {
      cls: "better-export-help",
      text: "封面会生成独立第一页，正文从下一页开始。用行前/行后留白控制标题、信息区和落款的位置。",
    });
    const activeId =
        this.plugin.settings.documentCoverIds[this.file.path] ??
        (this.plugin.settings.documentCoverSnapshots[this.file.path]
          ? "__document__"
          : ""),
      options: Record<string, string> = { "": "不使用封面" };
    if (this.plugin.settings.documentCoverSnapshots[this.file.path])
      options["__document__"] = "本篇版式（独立副本）";
    for (const t of this.plugin.settings.coverTemplates) options[t.id] = t.name;
    settingSelect(this.side, "当前文档", options, activeId, async (id) => {
      if (id === "__document__")
        delete this.plugin.settings.documentCoverIds[this.file.path];
      else {
        this.plugin.settings.documentCoverIds[this.file.path] = id;
        delete this.plugin.settings.documentCoverSnapshots[this.file.path];
      }
      await this.plugin.save();
      this.sidebar();
      this.schedule();
    });
    const actions = this.side.createDiv({
      cls: "better-export-header-actions",
    });
    button(actions, "新建空白", () => void this.createCover(blankCover()));
    button(actions, "粘贴图片作为封面", () =>
      this.imagePasteWindow("整页封面", async (path) => {
        if (this.currentCover())
          this.updateCover((t) => {
            t.mode = "image";
            t.imagePath = path;
          }, true);
        else
          await this.createCover({
            ...blankCover(),
            mode: "image",
            imagePath: path,
            imageFit: "contain",
          });
      }),
    );
    const template = this.currentCover();
    if (!template) return;
    if (this.plugin.settings.coverTemplates.some((t) => t.id === template.id))
      button(actions, "删除模板", () =>
        this.removeTemplate("cover", template.id),
      );
    button(
      actions,
      "复制为新模板",
      () =>
        void this.createCover(
          normalizeCover({
            ...template,
            id: crypto.randomUUID(),
            name: `${template.name} 副本`,
            rows: cloneRows(template.rows),
          }),
        ),
    );
    button(actions, "本篇停用", async () => {
      delete this.plugin.settings.documentCoverIds[this.file.path];
      delete this.plugin.settings.documentCoverSnapshots[this.file.path];
      await this.plugin.save();
      this.sidebar();
      this.schedule();
    });
    group(this.side, "模板设置", (el) => {
      textSetting(el, "模板名称", template.name, (v) =>
        this.updateCover((t) => (t.name = v)),
      );
      if (template.mode !== "image")
        this.imageControl(el, "封面图片 / 徽标", template.logoPath, (path) =>
          this.updateCover((t) => (t.logoPath = path), true),
        );
      toggleSetting(el, "显示封面页码", template.showPageNumber, (v) =>
        this.updateCover((t) => (t.showPageNumber = v)),
      );
    });
    group(this.side, "封面类型", (el) => {
      settingSelect(
        el,
        "内容",
        { grid: "Markdown 编排", image: "整页图片" },
        template.mode ?? "grid",
        (v) =>
          this.updateCover((t) => {
            t.mode = v as "grid" | "image";
          }, true),
      );
      if (template.mode === "image") {
        this.imageControl(el, "整页封面", template.imagePath ?? "", (path) =>
          this.updateCover((t) => {
            t.imagePath = path;
          }, true),
        );
        settingSelect(
          el,
          "图片适配",
          { contain: "完整显示", cover: "铺满裁切" },
          template.imageFit ?? "contain",
          (v) =>
            this.updateCover((t) => {
              t.imageFit = v as "contain" | "cover";
            }),
        );
      }
    });
    if (template.mode !== "image")
      group(this.side, "封面编排", (el) =>
        this.gridEditor(el, template.rows, (change, rebuild) =>
          this.updateCover((t) => change(t.rows), rebuild),
        ),
      );
    const fields = headerFields(template);
    if (fields.length)
      group(this.side, "本篇字段", (el) => {
        const values = (this.plugin.settings.documentCoverValues[
          this.file.path
        ] ??= {});
        for (const key of fields)
          textSetting(el, key, values[key] ?? "", async (v) => {
            values[key] = v;
            this.plugin.settings.documentCoverValues[this.file.path] = values;
            await this.plugin.save();
            this.schedule();
          });
      });
  }
  private currentCover(): ExportCoverTemplate | null {
    return currentCover(this.plugin.settings, this.file.path);
  }
  private async createCover(template: ExportCoverTemplate): Promise<void> {
    delete this.plugin.settings.documentCoverSnapshots[this.file.path];
    this.plugin.settings.coverTemplates.push(template);
    this.plugin.settings.documentCoverIds[this.file.path] = template.id;
    await this.plugin.save();
    this.sidebar();
    this.schedule();
  }
  private updateCover(
    change: (template: ExportCoverTemplate) => void,
    rebuild = false,
  ): void {
    let template = this.currentCover();
    if (!template) return;
    this.templateUndo.push(
      JSON.stringify({
        kind: "cover",
        snapshot: !this.plugin.settings.documentCoverIds[this.file.path],
        template,
        documentId: this.plugin.settings.documentCoverIds[this.file.path],
      }),
    );
    if (this.templateUndo.length > 30) this.templateUndo.shift();
    const shared = Object.entries(this.plugin.settings.documentCoverIds).some(
      ([path, id]) => path !== this.file.path && id === template!.id,
    );
    if (shared) {
      template = {
        ...template,
        id: crypto.randomUUID(),
        name: template.name + " · 本篇",
        rows: cloneRows(template.rows),
      };
      this.plugin.settings.coverTemplates.push(template);
      this.plugin.settings.documentCoverIds[this.file.path] = template.id;
      new Notice("已建立本篇模板副本，其他文档保持原版式");
    }
    change(template);
    void this.plugin.save();
    if (rebuild) this.sidebar();
    this.side.querySelectorAll<HTMLButtonElement>("button").forEach((b) => {
      if (b.textContent === "撤销上次模板修改") b.disabled = false;
    });
    this.schedule();
  }
  private gridEditor(
    parent: HTMLElement,
    rows: HeaderRow[],
    update: (change: (rows: HeaderRow[]) => void, rebuild?: boolean) => void,
  ): void {
    rows.forEach((row, ri) => {
      const rowEl = parent.createDiv({
        cls: "better-export-header-editor-row",
      });
      const bar = rowEl.createDiv({ cls: "better-export-header-row-bar" });
      bar.createSpan({ text: `第 ${ri + 1} 行` });
      select(
        bar,
        { "1": "1 列", "2": "2 列", "3": "3 列", "4": "4 列" },
        String(row.cells.length),
        (value) =>
          update((all) => {
            if (all[ri]) all[ri] = setRowColumnCount(all[ri]!, Number(value));
          }, true),
      );
      button(bar, "上移", () => update((all) => moveItem(all, ri, -1), true));
      button(bar, "下移", () => update((all) => moveItem(all, ri, 1), true));
      const remove = button(bar, "删行", () =>
        update((all) => all.splice(ri, 1), true),
      );
      remove.disabled = rows.length === 1;
      const spacing = rowEl.createDiv({ cls: "better-export-row-spacing" });
      miniNumber(spacing, "行前", row.gapBefore, 0, 80, (value) =>
        update((all) => {
          if (all[ri]) all[ri]!.gapBefore = value;
        }),
      );
      miniNumber(spacing, "行后", row.gapAfter, 0, 80, (value) =>
        update((all) => {
          if (all[ri]) all[ri]!.gapAfter = value;
        }),
      );
      const cells = rowEl.createDiv({ cls: "better-export-header-cells" });
      row.cells.forEach((cell, ci) => {
        const card = cells.createDiv({ cls: "better-export-header-cell-card" });
        card.style.flex = `${cell.width} 1 0`;
        card.createSpan({
          cls: "better-export-cell-index",
          text: `列 ${ci + 1}`,
        });
        const input = card.createEl("textarea", {
          attr: {
            placeholder: "Markdown、$行内公式$、$$独立公式$$ 或 {{字段名}}",
          },
        });
        input.value = cell.text;
        input.oninput = () =>
          update((all) => {
            if (all[ri]?.cells[ci]) all[ri]!.cells[ci]!.text = input.value;
          });
        const tools = card.createDiv({
          cls: "better-export-header-cell-tools",
        });
        miniNumber(tools, "宽", cell.width, 1, 12, (value) =>
          update((all) => {
            if (all[ri]?.cells[ci]) all[ri]!.cells[ci]!.width = value;
          }),
        );
        miniNumber(
          tools,
          "字号",
          cell.fontSize,
          6,
          36,
          (value) =>
            update((all) => {
              if (all[ri]?.cells[ci]) all[ri]!.cells[ci]!.fontSize = value;
            }, false),
          0.5,
        );
        select(
          tools,
          { left: "左", center: "中", right: "右" },
          cell.align,
          (value) =>
            update((all) => {
              if (all[ri]?.cells[ci])
                all[ri]!.cells[ci]!.align = value as typeof cell.align;
            }),
        );
        const bold = button(tools, "B", () =>
          update((all) => {
            if (all[ri]?.cells[ci])
              all[ri]!.cells[ci]!.bold = !all[ri]!.cells[ci]!.bold;
          }, true),
        );
        bold.title = "粗体";
        bold.toggleClass("is-active", cell.bold);
        const underline = button(tools, "线", () =>
          update((all) => {
            if (all[ri]?.cells[ci])
              all[ri]!.cells[ci]!.underline = !all[ri]!.cells[ci]!.underline;
          }, true),
        );
        underline.title = "单元格下划线";
        underline.toggleClass("is-active", cell.underline);
      });
    });
    button(
      parent,
      "+ 添加一行",
      () =>
        update(
          (all) =>
            all.push({
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
            }),
          true,
        ),
      true,
    );
  }
  private imageControl(
    parent: HTMLElement,
    label: string,
    path: string,
    onSaved: (path: string) => void,
  ): void {
    const row = parent.createDiv({ cls: "better-export-image-control" }),
      meta = row.createDiv();
    meta.createSpan({ text: label });
    meta.createEl("small", {
      text: path ? (path.split("/").at(-1) ?? path) : "尚未设置",
    });
    if (path) {
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        const image = meta.createEl("img", { attr: { alt: label } });
        image.src = this.plugin.app.vault.getResourcePath(file);
      }
    }
    button(row, "粘贴图片", () => this.imagePasteWindow(label, onSaved), true);
    if (path) button(row, "移除", () => onSaved(""));
  }
  private imagePasteWindow(
    label: string,
    onSaved: (path: string) => void,
  ): void {
    this.el.querySelector(".better-export-image-paste")?.remove();
    const box = this.el.createDiv({
      cls: "better-export-image-paste better-export-image-paste-overlay",
    });
    box.createEl("strong", { text: `粘贴${label}` });
    box.createEl("p", {
      text: "复制图片后在下方按 Ctrl/Cmd+V，或点击读取剪贴板。图片会保存到当前笔记的附件位置。",
    });
    const zone = box.createDiv({
      cls: "better-export-image-paste-zone",
      text: "点击这里，然后粘贴图片",
    });
    zone.tabIndex = 0;
    const accept = async (blob: Blob) => {
      try {
        const path = await this.savePastedImage(blob, label);
        await onSaved(path);
        box.remove();
        new Notice(`图片已保存：${path}`);
      } catch (error) {
        console.error(error);
        new Notice("图片保存失败");
      }
    };
    zone.onpaste = (event) => {
      event.preventDefault();
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (file) void accept(file);
      else new Notice("剪贴板中没有图片");
    };
    const actions = box.createDiv({ cls: "better-export-zotero-actions" });
    button(actions, "读取剪贴板", async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const type = item.types.find((value) => value.startsWith("image/"));
          if (type) {
            await accept(await item.getType(type));
            return;
          }
        }
        new Notice("剪贴板中没有图片");
      } catch {
        new Notice("无法直接读取，请在粘贴区按 Ctrl/Cmd+V");
      }
    });
    button(actions, "关闭", () => box.remove());
    zone.focus();
  }
  private async savePastedImage(blob: Blob, label: string): Promise<string> {
    const ext =
        (
          {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif",
          } as Record<string, string>
        )[blob.type] ?? "png",
      safe =
        label.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") ||
        "image",
      path = await this.plugin.app.fileManager.getAvailablePathForAttachment(
        `better-export-${safe}-${Date.now()}.${ext}`,
        this.file.path,
      );
    await this.plugin.app.vault.createBinary(path, await blob.arrayBuffer());
    return path;
  }
  private citations(): void {
    this.markdown = this.documentView()?.editor.getValue() ?? this.markdown;
    this.side.createEl("p", {
      cls: "better-export-help",
      text: "正文中的 [@引用键] 只是可读的 Markdown 源码；导出时会转换为所选学术格式。",
    });
    group(this.side, "输出规则", (el) => {
      settingSelect(
        el,
        "格式",
        {
          apa7: "APA 7",
          gb7714: "GB/T 7714—2015",
          chicago: "Chicago（作者—年份）",
        },
        this.citationOptions.style,
        async (v) => {
          this.citationOptions.style = v as CitationStyle;
          await this.plugin.save();
          this.schedule();
        },
      );
      settingSelect(
        el,
        "位置",
        {
          bibliography: "文末参考文献表",
          footnotes: "当页文献注释（横线区）",
          both: "页下注释 + 文末文献表",
        },
        this.citationOptions.placement,
        async (v) => {
          this.citationOptions.placement = v as CitationPlacement;
          await this.plugin.save();
          this.schedule();
        },
      );
    });
    const source = this.side.createDiv({
      cls: "better-export-citation-sources",
    });
    button(
      source,
      "从 Obsidian 库",
      () => void this.vaultReferenceBrowser(),
      true,
    );
    button(source, "粘贴 Zotero", () => void this.zoteroPaste());
    const target = this.side.createDiv({ cls: "better-export-insert-target" }),
      cursor = this.citationCursor();
    target.createSpan({ text: "插入位置" });
    target.createEl("strong", {
      text: cursor ? `正文第 ${cursor.line + 1} 行` : `请先把光标放回正文`,
    });
    const used = citationKeys(this.markdown),
      missing = used.filter(
        (k) => !this.plugin.settings.references.some((r) => r.citeKey === k),
      ),
      empty = citationTokens(this.markdown).filter((t) => t.error).length,
      status = this.side.createDiv({
        cls: `better-export-citation-audit ${missing.length || empty ? "has-errors" : "is-clean"}`,
      });
    status.createEl("strong", {
      text:
        missing.length || empty
          ? `发现 ${missing.length + empty} 个未解析引用`
          : `本文引用检查通过`,
    });
    status.createSpan({
      text:
        missing.length || empty
          ? "未解析项不会再以 [@…] 原样混入 PDF；修复前将阻止导出。"
          : `${used.length} 个引用键均能匹配文献记录。`,
    });
    if (missing.length) {
      const tags = status.createDiv();
      missing.forEach((key) => tags.createSpan({ text: `@${key}` }));
    }
    if (empty)
      status.createDiv({
        text: `空引用或不支持的语法：${empty} 处`,
        cls: "is-missing",
      });
    const list = this.side.createDiv({ cls: "better-export-reference-list" });
    list.createEl("h4", {
      text: `文献库 · ${this.plugin.settings.references.length}`,
    });
    const search = list.createEl("input", {
        attr: { type: "search", placeholder: "搜索已导入文献…" },
      }),
      rows = list.createDiv();
    const draw = () => {
      rows.empty();
      const query = search.value.trim().toLocaleLowerCase(),
        items = this.plugin.settings.references
          .filter(
            (r) =>
              !query ||
              [r.citeKey, r.title, r.authors, r.doi].some((value) =>
                value.toLocaleLowerCase().includes(query),
              ),
          )
          .sort(
            (a, b) =>
              Number(used.includes(b.citeKey)) -
              Number(used.includes(a.citeKey)),
          )
          .slice(0, 60);
      for (const r of items) {
        const row = rows.createDiv({
            cls: `better-export-reference-row ${used.includes(r.citeKey) ? "is-used" : ""}`,
          }),
          d = row.createDiv();
        d.createEl("strong", { text: `@${r.citeKey}` });
        d.createSpan({ text: r.title });
        button(row, "插入", () => this.insert(r.citeKey));
        button(row, "×", async () => {
          this.plugin.settings.references =
            this.plugin.settings.references.filter((x) => x.id !== r.id);
          await this.plugin.save();
          this.sidebar();
          this.schedule();
        });
      }
      if (!items.length)
        rows.createDiv({
          cls: "better-export-empty-state",
          text: "没有匹配的文献",
        });
    };
    search.oninput = draw;
    draw();
    this.refForm();
  }
  private documentView(): MarkdownView | null {
    const active = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (active?.file?.path === this.file.path) return active;
    if (
      this.targetView?.file?.path === this.file.path &&
      this.targetView.containerEl.isConnected
    )
      return this.targetView;
    for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file?.path === this.file.path)
        return view;
    }
    return null;
  }
  private citationCursor(): { line: number; ch: number } | null {
    return this.documentView()?.editor.getCursor() ?? null;
  }
  private refreshCitationAudit(): void {
    if (this.closed || this.tab !== "cite") return;
    const view = this.documentView(),
      source = view?.editor.getValue() ?? this.markdown,
      cursor = view?.editor.getCursor();
    this.side
      .querySelector(".better-export-insert-target strong")
      ?.setText(
        cursor ? `正文第 ${cursor.line + 1} 行` : "请打开本文并选择插入位置",
      );
    const audit = this.side.querySelector<HTMLElement>(
      ".better-export-citation-audit",
    );
    if (!audit) return;
    const problems = citationTokens(source).filter(
      (t) =>
        t.error ||
        !this.plugin.settings.references.some((r) => r.citeKey === t.key),
    );
    audit.empty();
    audit.toggleClass("has-errors", problems.length > 0);
    audit.toggleClass("is-clean", !problems.length);
    audit.createEl("strong", {
      text: problems.length
        ? `${problems.length} 处引用需要修复`
        : `${citationKeys(source).length} 篇文献 · 引用检查通过`,
    });
    for (const token of problems.slice(0, 8)) {
      const line = source.slice(0, token.start).split("\n").length;
      const action = button(
        audit,
        `第 ${line} 行 · ${token.error ?? "缺少 @" + token.key}`,
        () => {
          const target = this.documentView();
          if (!target) return;
          const value = target.editor.getValue();
          if (value !== source) {
            this.refreshCitationAudit();
            return;
          }
          target.editor.setSelection(
            target.editor.offsetToPos(token.start),
            target.editor.offsetToPos(token.end),
          );
          target.editor.focus();
        },
      );
      action.disabled = !view;
    }
  }
  private async vaultReferenceBrowser(): Promise<void> {
    this.side.querySelector(".better-export-vault-browser")?.remove();
    const box = this.side.createDiv({ cls: "better-export-vault-browser" });
    box.createEl("strong", { text: "从 Obsidian 文献笔记引用" });
    box.createEl("p", {
      text: "扫描属性和标签中的 DOI、引用键、作者、年份、期刊等信息，不会上传笔记内容。",
    });
    const loading = box.createDiv({
      cls: "better-export-inline-loading",
      text: "正在读取库内文献索引…",
    });
    if (!this.vaultReferences) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      this.vaultReferences = [];
      for (const file of this.plugin.app.vault.getMarkdownFiles()) {
        if (file.path === this.file.path) continue;
        const cache = this.plugin.app.metadataCache.getFileCache(file),
          tags = [
            ...(cache?.tags?.map((tag) => tag.tag) ?? []),
            ...frontmatterTags(cache?.frontmatter?.tags),
          ];
        const reference = referenceFromVaultNote({
          path: file.path,
          basename: file.basename,
          frontmatter: cache?.frontmatter,
          tags,
        });
        if (reference) this.vaultReferences.push(reference);
      }
    }
    loading.remove();
    const search = box.createEl("input", {
        attr: {
          type: "search",
          placeholder: "搜索 DOI、题名、作者、引用键或笔记路径…",
        },
      }),
      results = box.createDiv({ cls: "better-export-vault-results" });
    const draw = () => {
      results.empty();
      const matches = (this.vaultReferences ?? [])
        .filter((ref) => vaultReferenceMatches(ref, search.value))
        .slice(0, 80);
      results.createEl("small", {
        text: `找到 ${matches.length}${(this.vaultReferences?.length ?? 0) > 80 ? "+" : ""} 项`,
      });
      for (const ref of matches) {
        const card = results.createDiv({
            cls: "better-export-vault-reference",
          }),
          meta = card.createDiv();
        meta.createEl("strong", { text: ref.title });
        meta.createSpan({
          text:
            [ref.authors, ref.year, ref.doi].filter(Boolean).join(" · ") ||
            ref.sourcePath,
        });
        const actions = card.createDiv();
        button(
          actions,
          "打开笔记",
          () =>
            void this.plugin.app.workspace.openLinkText(
              ref.sourcePath,
              this.file.path,
              true,
            ),
        );
        button(
          actions,
          "引用",
          async () => {
            const record = this.addVaultReference(ref);
            await this.plugin.save();
            this.insert(record.citeKey);
          },
          true,
        );
      }
      if (!matches.length)
        results.createDiv({
          cls: "better-export-empty-state",
          text: "未找到带 DOI 或文献属性的笔记",
        });
    };
    search.oninput = draw;
    draw();
    button(box, "关闭", () => box.remove());
    search.focus();
  }
  private addVaultReference(reference: VaultReference): ReferenceRecord {
    return this.addImported([reference])[0]!;
  }
  private async zoteroPaste(): Promise<void> {
    this.side.querySelector(".better-export-zotero-paste")?.remove();
    const box = this.side.createDiv({ cls: "better-export-zotero-paste" });
    box.createEl("strong", { text: "从 Zotero 导入" });
    box.createEl("p", {
      text: "支持 Zotero Quick Copy、BibTeX、RIS 和 CSL JSON。内容只在本机解析。",
    });
    const area = box.createEl("textarea", {
        attr: { placeholder: "在此粘贴 Zotero 复制的引用信息…" },
      }),
      preview = box.createDiv({ cls: "better-export-zotero-preview" });
    const actions = box.createDiv({ cls: "better-export-zotero-actions" });
    const inspect = () => {
      const items = parseZotero(area.value);
      preview.empty();
      preview.createSpan({
        text: items.length
          ? `识别到 ${items.length} 篇文献`
          : `尚未识别到完整文献信息`,
        cls: items.length ? "is-ready" : "is-missing",
      });
      for (const item of items.slice(0, 4))
        preview.createEl("small", { text: `@${item.citeKey} · ${item.title}` });
      return items;
    };
    button(actions, "读取剪贴板", async () => {
      try {
        area.value = await navigator.clipboard.readText();
        inspect();
        area.focus();
      } catch {
        new Notice("无法读取剪贴板，请按 Ctrl/Cmd+V 粘贴");
      }
    });
    button(actions, "识别", inspect);
    button(
      actions,
      "导入并插入",
      async () => {
        const items = inspect();
        if (!items.length) {
          new Notice("没有识别到文献，请检查复制格式");
          return;
        }
        const added = this.addImported(items);
        await this.plugin.save();
        const inserted = added[0] ? this.insert(added[0].citeKey) : false;
        new Notice(
          `已导入 ${added.length} 篇文献${inserted ? "，并插入首篇引用" : "；尚未插入正文"}`,
        );
        this.sidebar();
        this.schedule();
      },
      true,
    );
    button(actions, "关闭", () => box.remove());
    try {
      area.value = await navigator.clipboard.readText();
      if (area.value) inspect();
    } catch {
      /* manual paste remains available */
    }
    area.focus();
  }
  private addImported(items: ImportedReference[]): ReferenceRecord[] {
    return mergeReferences(this.plugin.settings.references, items);
  }
  private refForm(): void {
    const d = this.side.createEl("details", {
      cls: "better-export-reference-form",
    });
    d.createEl("summary", { text: "添加文献" });
    const f = d.createDiv(),
      type = f.createEl("select"),
      inputs: Record<string, HTMLInputElement> = {};
    for (const [v, n] of [
      ["article", "期刊论文"],
      ["book", "图书"],
      ["chapter", "书籍章节"],
      ["thesis", "学位论文"],
      ["web", "网页"],
    ])
      type.createEl("option", { value: v, text: n });
    for (const [k, p] of [
      ["citeKey", "引用键"],
      ["authors", "作者；分号分隔"],
      ["year", "年份"],
      ["title", "题名"],
      ["container", "期刊 / 出版社"],
      ["volume", "卷"],
      ["issue", "期"],
      ["pages", "页码"],
      ["doi", "DOI"],
      ["url", "URL"],
    ] as const)
      inputs[k] = f.createEl("input", { attr: { placeholder: p } });
    button(
      f,
      "保存文献",
      async () => {
        const key = inputs.citeKey?.value.trim().replace(/\s+/g, "-") ?? "",
          title = inputs.title?.value.trim() ?? "";
        if (!validCitationKey(key) || !title) {
          new Notice("请填写题名及有效引用键（文字、数字或 _ . : -）");
          return;
        }
        if (this.plugin.settings.references.some((r) => r.citeKey === key)) {
          new Notice("引用键已存在");
          return;
        }
        this.plugin.settings.references.push({
          id: crypto.randomUUID(),
          citeKey: key,
          type: type.value as ReferenceRecord["type"],
          authors: inputs.authors?.value ?? "",
          year: inputs.year?.value ?? "",
          title,
          container: inputs.container?.value ?? "",
          volume: inputs.volume?.value ?? "",
          issue: inputs.issue?.value ?? "",
          pages: inputs.pages?.value ?? "",
          doi: inputs.doi?.value ?? "",
          url: inputs.url?.value ?? "",
        });
        await this.plugin.save();
        this.sidebar();
        this.schedule();
      },
      true,
    );
  }
  private insert(k: string): boolean {
    const key = k.trim();
    if (!validCitationKey(key)) {
      new Notice("引用键仅支持文字、数字及 _ . : -");
      return false;
    }
    const view = this.documentView();
    if (!view) {
      new Notice("文献已导入；请打开本文并选择插入位置后重试");
      return false;
    }
    const cursor = view.editor.getCursor();
    view.editor.replaceSelection(`[@${key}]`);
    view.editor.focus();
    this.targetView = view;
    this.markdown = view.editor.getValue();
    new Notice(`引用已插入正文第 ${cursor.line + 1} 行`);
    if (this.tab === "cite") this.sidebar();
    this.schedule();
    return true;
  }
  private set<K extends keyof ExportProfile>(k: K, v: ExportProfile[K]): void {
    this.profile[k] = v;
    this.schedule();
  }
  invalidate(): void {
    this.vaultReferences = null;
    this.schedule();
  }
  private schedule(): void {
    if (this.closed) return;
    this.refreshCitationAudit();
    if (
      JSON.stringify(
        this.plugin.settings.documentCitationOptions[this.file.path],
      ) !== JSON.stringify(this.citationOptions)
    ) {
      this.plugin.settings.documentCitationOptions[this.file.path] = {
        ...this.citationOptions,
      };
      void this.plugin.save();
    }
    if (
      JSON.stringify(this.plugin.settings.documentProfiles[this.file.path]) !==
      JSON.stringify(this.profile)
    ) {
      this.plugin.settings.documentProfiles[this.file.path] = {
        ...this.profile,
      };
      void this.plugin.save();
    }
    this.dirty = true;
    this.preview.classList.add("is-stale");
    this.ready = false;
    this.renderVersion++;
    this.status("正在同步最新内容", "is-busy");
    this.updatePrintButton();
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = 0;
      if (!this.el.hasClass("is-minimized")) void this.render();
    }, 180);
  }
  private updatePrintButton(): void {
    if (this.printButton) {
      this.printButton.disabled =
        this.dirty ||
        this.isRendering ||
        !this.ready ||
        Boolean(this.printCleanup);
      this.printButton.title = this.printButton.disabled
        ? "等待有效预览；请先处理提示的问题"
        : "导出当前预览";
    }
  }
  private async render(): Promise<void> {
    const version = ++this.renderVersion;
    this.isRendering = true;
    this.ready = false;
    this.updatePrintButton();
    const stale = () => this.closed || version !== this.renderVersion;
    const child = new Component();
    child.load();
    const staging = this.preview.createDiv({ cls: "better-export-staging" });
    let committed = false;
    try {
      const view = this.documentView();
      const markdown = view
        ? view.editor.getValue()
        : await this.plugin.app.vault.read(this.file);
      if (stale()) return;
      this.markdown = markdown;
      this.style?.remove();
      this.style = this.el.createEl("style");
      this.style.textContent = buildExportCss(this.profile);
      const pages = staging.createDiv({
        cls: "better-export-document better-export-pages markdown-rendered",
      });
      const initialSample = this.page(pages, 1);
      const headerHolder = pages.createDiv();
      headerHolder.style.width = `${initialSample.body.clientWidth}px`;
      await this.renderHeader(headerHolder, 1, child);
      await finishRenderMath();
      await waitForAssets(headerHolder);
      const preparedHeader =
        headerHolder.firstElementChild as HTMLElement | null;
      const sample = this.page(pages, 1, preparedHeader),
        measure = staging.createDiv({
          cls: "better-export-document better-export-measure markdown-rendered",
        });
      measure.style.width = `${sample.body.clientWidth}px`;
      const citations = buildCitationDocument(
        this.markdown,
        this.plugin.settings.references,
        this.citationOptions.style,
        this.citationOptions.placement,
      );
      this.noteEntries = citations.notes;
      await MarkdownRenderer.render(
        this.plugin.app,
        prepareWikiLinks(citations.markdown, this.profile.wikiLinkMode),
        measure,
        this.file.path,
        child,
      );
      applyWikiLinkMode(measure, this.profile.wikiLinkMode);
      await finishRenderMath();
      await waitForAssets(staging);
      if (stale()) return;
      if (measure.querySelector("video"))
        throw new LayoutError(
          "视频无法直接写入静态 PDF。请在导出内容中改用视频封面图片和播放链接。",
        );
      const errors = citationProblems(
        this.markdown,
        this.plugin.settings.references.map((r) => r.citeKey),
      );
      if (errors.length) throw new LayoutError(errors.join("；"));
      pages.empty();
      const hasCover = Boolean(this.currentCover());
      if (hasCover) {
        await this.coverPage(pages, child);
        await finishRenderMath();
        await waitForAssets(pages);
      }
      if (stale()) return;
      const n = paginate(
        Array.from(measure.children) as HTMLElement[],
        () =>
          this.page(
            pages,
            1 +
              pages.querySelectorAll(
                ".better-export-page:not(.better-export-cover-page)",
              ).length,
            preparedHeader,
          ),
        (p) => this.syncPageNotes(p),
        this.profile.avoidHeadingBreaks,
      );
      measure.remove();
      await waitForAssets(pages);
      if (stale()) return;
      for (const frame of Array.from(
        pages.querySelectorAll<HTMLElement>(
          ".better-export-page-content,.better-export-cover,.better-export-page-body",
        ),
      )) {
        if (
          frame.scrollHeight > frame.clientHeight + 1 ||
          frame.scrollWidth > frame.clientWidth + 1
        )
          throw new LayoutError(
            "页面内容超出纸张，请减少版头或封面留白，或调整过大的内容。",
          );
      }
      const scroll = this.preview.scrollTop;
      this.renderChild?.unload();
      this.renderChild = child;
      this.preview.replaceChildren(pages);
      this.preview.scrollTop = scroll;
      committed = true;
      this.dirty = false;
      this.preview.classList.remove("is-stale");
      this.ready = true;
      this.status(`${n + (hasCover ? 1 : 0)} 页 · 已同步`, "is-ready");
    } catch (error) {
      if (!stale()) {
        this.ready = false;
        this.status("需要调整后才能导出", "is-error");
        this.preview.querySelector(".better-export-render-error")?.remove();
        const message = this.preview.createDiv({
          cls: "better-export-render-error",
          attr: { role: "alert" },
        });
        message.createEl("strong", { text: "预览未更新" });
        message.createEl("p", {
          text: error instanceof Error ? error.message : "预览生成失败",
        });
        button(message, "重新预览", () => this.schedule());
        button(message, "检查引用", () => {
          this.tab = "cite";
          this.sidebar();
        });
        this.preview.prepend(message);
      }
    } finally {
      staging.remove();
      if (!committed) child.unload();
      if (!stale()) {
        this.isRendering = false;
        this.updatePrintButton();
      }
    }
  }
  private page(
    parent: HTMLElement,
    n: number,
    preparedHeader: HTMLElement | null = null,
  ): { body: HTMLElement; notes: HTMLElement } {
    const p = parent.createDiv({ cls: "better-export-page" });
    p.style.animationDelay = `${Math.min(n - 1, 6) * 35}ms`;
    p.createDiv({
      cls: "better-export-print-header",
      text: stripCitationTokens(this.profile.headerText),
    });
    const frame = p.createDiv({ cls: "better-export-page-body" });
    if (preparedHeader && (n === 1 || this.currentHeader()?.repeat === "all"))
      frame.appendChild(preparedHeader.cloneNode(true));
    const body = frame.createDiv({ cls: "better-export-page-content" }),
      notes = frame.createDiv({ cls: "better-export-page-notes" }),
      foot = p.createDiv({ cls: "better-export-print-footer" });
    foot.createSpan({ text: stripCitationTokens(this.profile.footerText) });
    if (this.profile.showPageNumbers) foot.createSpan({ text: String(n) });
    return { body, notes };
  }
  private async renderHeader(
    parent: HTMLElement,
    page: number,
    child: Component,
  ): Promise<void> {
    const template = this.currentHeader();
    if (!template || (template.repeat === "first" && page > 1)) return;
    const values =
        this.plugin.settings.documentHeaderValues[this.file.path] ?? {},
      header = parent.createDiv({
        cls: `better-export-custom-header is-${template.border}`,
      });
    this.renderTemplateImage(header, template.logoPath, "版头徽标");
    await this.renderGrid(
      header.createDiv({ cls: "better-export-header-grid" }),
      template.rows,
      values,
      child,
    );
    if (template.showRule)
      header.createDiv({ cls: "better-export-header-rule" });
  }
  private async coverPage(
    parent: HTMLElement,
    child: Component,
  ): Promise<void> {
    const template = this.currentCover();
    if (!template) return;
    const page = parent.createDiv({
      cls: "better-export-page better-export-cover-page",
    });
    page.style.animationDelay = "0ms";
    if (template.mode === "image") {
      if (!template.imagePath)
        throw new LayoutError("请粘贴或选择整页封面图片");
      page.addClass("better-export-image-cover");
      this.renderTemplateImage(page, template.imagePath, "封面");
      page.querySelector("img")!.style.objectFit =
        template.imageFit ?? "contain";
      if (template.showPageNumber)
        page.createDiv({ cls: "better-export-print-footer", text: "1" });
      return;
    }
    const cover = page.createDiv({ cls: "better-export-cover" }),
      values = this.plugin.settings.documentCoverValues[this.file.path] ?? {};
    this.renderTemplateImage(cover, template.logoPath, "封面图片");
    await this.renderGrid(
      cover.createDiv({ cls: "better-export-cover-grid" }),
      template.rows,
      values,
      child,
    );
    if (template.showPageNumber)
      page.createDiv({ cls: "better-export-print-footer", text: "1" });
  }
  private renderTemplateImage(
    parent: HTMLElement,
    path: string,
    alt: string,
  ): void {
    if (!path.trim()) return;
    const file = this.plugin.app.vault.getAbstractFileByPath(path.trim());
    if (file instanceof TFile) {
      const img = parent.createEl("img", {
        cls: "better-export-template-image",
        attr: { alt },
      });
      img.src = this.plugin.app.vault.getResourcePath(file);
    } else
      throw new LayoutError(
        `找不到模板图片：${path}。请重新粘贴图片或移除该图片。`,
      );
  }
  private async renderGrid(
    parent: HTMLElement,
    rows: HeaderRow[],
    values: Record<string, string>,
    child: Component,
  ): Promise<void> {
    for (const row of rows) {
      const line = parent.createDiv({ cls: "better-export-header-row" });
      line.style.marginTop = `${row.gapBefore}mm`;
      line.style.marginBottom = `${row.gapAfter}mm`;
      for (const cell of row.cells) {
        const item = line.createDiv({ cls: "better-export-header-cell" });
        item.style.flex = `${Math.max(1, cell.width)} 1 0`;
        item.style.textAlign = cell.align;
        item.style.fontSize = `${cell.fontSize}pt`;
        item.toggleClass("is-bold", cell.bold);
        item.toggleClass("is-underline", cell.underline);
        await MarkdownRenderer.render(
          this.plugin.app,
          prepareWikiLinks(
            fillHeaderText(cell.text, values),
            this.profile.wikiLinkMode,
          ),
          item,
          this.file.path,
          child,
        );
        applyWikiLinkMode(item, this.profile.wikiLinkMode);
      }
    }
  }
  private syncPageNotes(page: { body: HTMLElement; notes: HTMLElement }): void {
    page.notes.empty();
    if (this.citationOptions.placement === "bibliography") return;
    const seen = new Set<string>(),
      markers = Array.from(
        page.body.querySelectorAll<HTMLElement>(".better-export-cite-marker"),
      );
    for (const marker of markers) {
      const key = marker.dataset.citeKey ?? "";
      const identity = key + "\u0000" + (marker.dataset.citeLocator ?? "");
      if (!key || seen.has(identity)) continue;
      seen.add(identity);
      const reference = this.plugin.settings.references.find(
        (r) => r.citeKey === key,
      );
      if (!reference) continue;
      const row = page.notes.createDiv({ cls: "better-export-page-note" });
      row.createSpan({
        cls: "better-export-page-note-number",
        text: marker.dataset.citeNumber ?? "",
      });
      const locator = marker.dataset.citeLocator?.trim(),
        entry = this.noteEntries.get(key) ?? "";
      const content = row.createSpan();
      appendCitationHtml(content, entry);
      if (locator) content.appendText(" " + locator);
    }
    page.notes.toggleClass("is-visible", page.notes.childElementCount > 0);
  }
  private async print(): Promise<void> {
    const latest =
      this.documentView()?.editor.getValue() ??
      (await this.plugin.app.vault.read(this.file));
    if (this.closed) return;
    if (latest !== this.markdown) {
      this.schedule();
      new Notice("正文已变化，请等待预览同步后导出");
      return;
    }
    if (this.dirty || this.isRendering || !this.ready || this.printCleanup) {
      new Notice("请等待有效预览后导出");
      return;
    }
    const errors = citationProblems(
      latest,
      this.plugin.settings.references.map((r) => r.citeKey),
    );
    if (errors.length) {
      this.schedule();
      return;
    }
    const title = document.title;
    document.title = this.file.basename;
    document.body.addClass("better-export-printing");
    this.el.addClass("is-print-target");
    const clean = () => {
      document.title = title;
      document.body.removeClass("better-export-printing");
      this.el.removeClass("is-print-target");
      removeEventListener("afterprint", clean);
      this.printCleanup = null;
      this.updatePrintButton();
      if (!this.closed)
        this.status("已返回预览；保存结果以打印窗口为准", "is-ready");
    };
    this.printCleanup = clean;
    this.updatePrintButton();
    addEventListener("afterprint", clean, { once: true });
    try {
      window.print();
    } catch {
      clean();
      new Notice("无法打开打印窗口，请重试");
    }
  }
  private status(
    text: string,
    state: "is-busy" | "is-ready" | "is-error",
  ): void {
    if (!this.statusEl || this.closed) return;
    this.statusEl.setText(text);
    this.statusEl.className = `better-export-status ${state}`;
  }
  private saveBounds(): void {
    if (
      !this.el ||
      this.closed ||
      this.el.hasClass("is-maximized") ||
      this.el.hasClass("is-minimized")
    )
      return;
    const r = this.el.getBoundingClientRect();
    this.plugin.settings.panel = {
      x: Math.round(r.left),
      y: Math.round(r.top),
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
    void this.plugin.save();
  }
}

class SettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private p: BetterExportPlugin,
  ) {
    super(app, p);
  }
  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl("h2", { text: "Better Export" });
    new Setting(this.containerEl).setName("隐藏附件文件夹").addToggle((t) =>
      t.setValue(this.p.settings.hideAttachmentFolders).onChange(async (v) => {
        this.p.settings.hideAttachmentFolders = v;
        this.p.applyFolderVisibility();
        await this.p.save();
      }),
    );
    new Setting(this.containerEl)
      .setName("附件文件夹名称")
      .setDesc("留空时自动读取 Obsidian 设置")
      .addText((t) =>
        t.setValue(this.p.settings.attachmentFolderName).onChange(async (v) => {
          this.p.settings.attachmentFolderName = v.trim();
          this.p.applyFolderVisibility();
          await this.p.save();
        }),
      );
  }
}

function group(p: HTMLElement, n: string, fn: (e: HTMLElement) => void): void {
  const d = p.createEl("details", { cls: "better-export-section" });
  d.open = true;
  d.createEl("summary", { text: n });
  fn(d.createDiv());
}
function settingSelect(
  p: HTMLElement,
  n: string,
  o: Record<string, string>,
  v: string,
  c: (v: string) => void,
): void {
  new Setting(p)
    .setName(n)
    .addDropdown((d) => d.addOptions(o).setValue(v).onChange(c));
}
function num(
  p: HTMLElement,
  n: string,
  v: number,
  min: number,
  max: number,
  c: (v: number) => void,
  step = 1,
): void {
  new Setting(p).setName(n).addText((t) => {
    t.inputEl.type = "number";
    t.inputEl.min = String(min);
    t.inputEl.max = String(max);
    t.inputEl.step = String(step);
    wheelNumber(t.inputEl);
    t.setValue(String(v)).onChange((x) => {
      if (Number.isFinite(Number(x))) c(Number(x));
    });
  });
}
function font(
  p: HTMLElement,
  n: string,
  v: string,
  c: (v: string) => void,
): void {
  settingSelect(
    p,
    n,
    {
      "source-serif": "思源宋体 / 宋体",
      "source-sans": "思源黑体 / 微软雅黑",
      lxgw: "霞鹜文楷 / 楷体",
      times: "Times New Roman",
      georgia: "Georgia",
    },
    v,
    c,
  );
}
function color(
  p: HTMLElement,
  n: string,
  v: string,
  c: (v: string) => void,
): void {
  new Setting(p).setName(n).addColorPicker((x) => x.setValue(v).onChange(c));
}
function toggleSetting(
  p: HTMLElement,
  n: string,
  v: boolean,
  c: (v: boolean) => void,
): void {
  new Setting(p).setName(n).addToggle((x) => x.setValue(v).onChange(c));
}
function textSetting(
  p: HTMLElement,
  n: string,
  v: string,
  c: (v: string) => void,
): void {
  new Setting(p).setName(n).addText((x) => x.setValue(v).onChange(c));
}
function miniNumber(
  parent: HTMLElement,
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void,
  step = 1,
): void {
  const wrap = parent.createEl("label", { cls: "better-export-mini-number" });
  wrap.createSpan({ text: label });
  const input = wrap.createEl("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  wheelNumber(input);
  input.oninput = () => {
    const next = Number(input.value);
    if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
  };
}
function cloneRows(rows: HeaderRow[]): HeaderRow[] {
  return rows.map((row) => ({
    ...row,
    cells: row.cells.map((cell) => ({ ...cell })),
    hiddenCells: row.hiddenCells?.map((cell) => ({ ...cell })),
  }));
}
function moveItem<T>(items: T[], index: number, offset: number): void {
  const target = index + offset;
  if (target < 0 || target >= items.length) return;
  const [item] = items.splice(index, 1);
  if (item !== undefined) items.splice(target, 0, item);
}
function frontmatterTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(frontmatterTags);
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return [];
}
function button(
  p: HTMLElement,
  n: string,
  c: () => void,
  cta = false,
): HTMLButtonElement {
  const b = p.createEl("button", { text: n, cls: cta ? "mod-cta" : "" });
  b.onclick = c;
  return b;
}
function select(
  p: HTMLElement,
  o: Record<string, string>,
  v: string,
  c: (v: string) => void,
): void {
  const s = p.createEl("select");
  for (const [k, n] of Object.entries(o))
    s.createEl("option", { value: k, text: n });
  s.value = v;
  s.onchange = () => c(s.value);
  wheelSelect(s);
}
function toggle(p: HTMLElement, n: string, c: (v: boolean) => void): void {
  const b = button(p, n, () => {
    b.toggleClass("is-active", !b.hasClass("is-active"));
    c(b.hasClass("is-active"));
  });
}
function place(e: HTMLElement, x: number, y: number): void {
  const r = e.getBoundingClientRect();
  e.style.left = `${Math.max(6, Math.min(x, innerWidth - r.width - 6))}px`;
  e.style.top = `${Math.max(6, Math.min(y, innerHeight - r.height - 6))}px`;
}
function wheelNumber(input: HTMLInputElement): void {
  let timer = 0;
  input.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      event.deltaY < 0 ? input.stepUp() : input.stepDown();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.addClass("is-wheel-adjusting");
      clearTimeout(timer);
      timer = window.setTimeout(
        () => input.removeClass("is-wheel-adjusting"),
        180,
      );
    },
    { passive: false },
  );
}
function wheelSelect(input: HTMLSelectElement): void {
  let timer = 0;
  input.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const next = Math.max(
        0,
        Math.min(
          input.options.length - 1,
          input.selectedIndex + (event.deltaY > 0 ? 1 : -1),
        ),
      );
      if (next === input.selectedIndex) return;
      input.selectedIndex = next;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.addClass("is-wheel-adjusting");
      clearTimeout(timer);
      timer = window.setTimeout(
        () => input.removeClass("is-wheel-adjusting"),
        180,
      );
    },
    { passive: false },
  );
}
