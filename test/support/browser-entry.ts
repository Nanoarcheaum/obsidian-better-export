import Plugin from "../../src/main";
import { paginate } from "../../src/pagination";
import { buildExportCss, DEFAULT_PROFILE } from "../../src/export-style";
import { installDom, Events, TFile, MarkdownView, notices } from "./obsidian";
installDom();
Object.assign(window, { paginate, buildExportCss, DEFAULT_PROFILE, notices });
(window as any).setup = async (markdown: string) => {
  const workspace: any = new Events(),
    vault: any = new Events(),
    metadataCache: any = new Events();
  const file = new TFile(),
    view = new MarkdownView();
  view.file = file;
  document.body.append(view.containerEl);
  let source = markdown,
    selection = { line: 0, ch: 0 };
  view.editor = {
    getValue: () => source,
    getCursor: () => selection,
    getSelection: () => "",
    focus: () => {},
    replaceSelection: (text: string) => {
      source += text;
    },
    setCursor: (p: any) => (selection = p),
  };
  workspace.getActiveViewOfType = () => view;
  workspace.getLeavesOfType = () => [{ view }];
  workspace.getActiveFile = () => file;
  workspace.onLayoutReady = (fn: any) => fn();
  vault.read = async () => source;
  vault.getConfig = () => "";
  vault.getMarkdownFiles = () => [];
  vault.getAbstractFileByPath = () => null;
  const app = { workspace, vault, metadataCache, delay: 0 };
  const plugin = new Plugin();
  plugin.app = app;
  await plugin.onload();
  await (plugin as any).openPanel();
  Object.assign(window, {
    plugin,
    panel: (plugin as any).panel,
    app,
    view,
    setSource: (text: string) => {
      source = text;
      workspace.emit("editor-change", view.editor, view);
    },
    setDisk: (text: string) => {
      source = text;
      vault.emit("modify", file);
    },
  });
};
