// Deliberately small host adapter. Browser tests execute the production panel and paginator.
export const notices: string[] = [];
const markdownPostProcessors: Array<(el: HTMLElement) => void> = [];
export class Notice {
  constructor(text: string) {
    notices.push(text);
  }
}
export class Component {
  disposers: Array<() => void> = [];
  load() {}
  unload() {
    this.disposers
      .splice(0)
      .reverse()
      .forEach((fn) => fn());
  }
  register(fn: () => void) {
    this.disposers.push(fn);
  }
  registerEvent(event: any) {
    this.register(() => event.off());
  }
  registerDomEvent(target: any, name: string, callback: any, options?: any) {
    target.addEventListener(name, callback, options);
    this.register(() => target.removeEventListener(name, callback, options));
  }
}
export class Plugin extends Component {
  app: any;
  data: any = null;
  commands: any[] = [];
  async loadData() {
    return this.data;
  }
  async saveData(value: any) {
    this.data = structuredClone(value);
  }
  addRibbonIcon() {}
  addCommand(c: any) {
    this.commands.push(c);
  }
  addSettingTab() {}
  registerMarkdownPostProcessor(processor: (el: HTMLElement) => void) {
    markdownPostProcessors.push(processor);
    this.register(() => {
      const index = markdownPostProcessors.indexOf(processor);
      if (index >= 0) markdownPostProcessors.splice(index, 1);
    });
    return processor;
  }
}
export class PluginSettingTab {
  containerEl = document.createElement("div");
  constructor(...args: any[]) {}
}
export class TFile {
  extension = "md";
  basename = "报告";
  constructor(public path = "报告.md") {}
}
export class MarkdownView {
  file: any;
  editor: any;
  containerEl = document.createElement("section");
}
export class App {}
export async function finishRenderMath() {
  await new Promise((resolve) => setTimeout(resolve, 10));
  document
    .querySelectorAll("[data-test-math]")
    .forEach((el) => el.setAttribute("data-math-ready", "true"));
}
export const setIcon = (el: HTMLElement, name: string) => {
  el.textContent =
    ({ minus: "−", "maximize-2": "□", x: "×" } as any)[name] ?? name;
};
export const MarkdownRenderer = {
  async render(app: any, markdown: string, el: HTMLElement) {
    (app.renderedMarkdown ??= []).push(markdown);
    markdown = markdown
      .replace(
        /!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_, target, label = "") =>
          `<span class="internal-embed" alt="${label}" data-href="${target}"><img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='80'%3E%3Crect width='120' height='80' fill='%2386a99a'/%3E%3C/svg%3E" alt="${label}"></span>`,
      )
      .replace(
        /\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g,
        (_, block, inline) =>
          `<span data-test-math="true">${block ?? inline}</span>`,
      )
      .replace(
        /(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_, target, label) =>
          `<a class="internal-link" href="${target}">${label ?? target}</a>`,
      );
    if (app.delay) await new Promise((r) => setTimeout(r, app.delay));
    el.innerHTML = markdown
      .split(/\n\n/)
      .map((part) =>
        part.includes('class="internal-embed"')
          ? `<p>${part}</p>`
          : part.startsWith("<")
            ? part
            : /^## /.test(part)
              ? `<h2>${part.slice(3)}</h2>`
              : `<p>${part}</p>`,
      )
      .join("");
    for (const processor of markdownPostProcessors) processor(el);
  },
};
class Control {
  inputEl: any;
  constructor(
    public parent: HTMLElement,
    tag = "input",
  ) {
    this.inputEl = document.createElement(tag);
    parent.append(this.inputEl);
  }
  setValue(value: any) {
    if (this.inputEl.type === "checkbox") this.inputEl.checked = value;
    else this.inputEl.value = value;
    return this;
  }
  onChange(fn: any) {
    this.inputEl.addEventListener(
      this.inputEl.tagName === "SELECT" || this.inputEl.type === "checkbox"
        ? "change"
        : "input",
      () =>
        fn(
          this.inputEl.type === "checkbox"
            ? this.inputEl.checked
            : this.inputEl.value,
        ),
    );
    return this;
  }
  addOptions(values: any) {
    for (const [value, label] of Object.entries(values)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = String(label);
      this.inputEl.append(option);
    }
    return this;
  }
}
export class Setting {
  el: HTMLElement;
  label: HTMLElement;
  control: HTMLElement;
  constructor(parent: HTMLElement) {
    this.el = parent.createDiv({ cls: "setting-item" });
    this.label = this.el.createDiv({ cls: "setting-item-name" });
    this.control = this.el.createDiv({ cls: "setting-item-control" });
  }
  setName(name: string) {
    this.label.textContent = name;
    return this;
  }
  setDesc() {
    return this;
  }
  addText(fn: any) {
    fn(new Control(this.control));
    return this;
  }
  addDropdown(fn: any) {
    fn(new Control(this.control, "select"));
    return this;
  }
  addToggle(fn: any) {
    const c = new Control(this.control);
    c.inputEl.type = "checkbox";
    fn(c);
    return this;
  }
  addColorPicker(fn: any) {
    const c = new Control(this.control);
    c.inputEl.type = "color";
    fn(c);
    return this;
  }
}
export function installDom() {
  const proto: any = HTMLElement.prototype;
  proto.createEl = function (tag: string, options: any = {}) {
    const el = document.createElement(tag);
    if (options.cls) el.className = options.cls;
    if (options.text) el.textContent = options.text;
    for (const [key, value] of Object.entries(options.attr ?? {}))
      el.setAttribute(key, String(value));
    for (const key of ["value", "href", "type"])
      if (options[key]) el[key] = options[key];
    this.append(el);
    return el;
  };
  proto.createDiv = function (o: any) {
    return this.createEl("div", o);
  };
  proto.createSpan = function (o: any) {
    return this.createEl("span", o);
  };
  proto.empty = function () {
    this.replaceChildren();
  };
  proto.setText = function (text: string) {
    this.textContent = text;
  };
  proto.addClass = function (...names: string[]) {
    this.classList.add(...names);
  };
  proto.removeClass = function (...names: string[]) {
    this.classList.remove(...names);
  };
  proto.hasClass = function (name: string) {
    return this.classList.contains(name);
  };
  proto.toggleClass = function (name: string, value: boolean) {
    this.classList.toggle(name, value);
  };
  proto.appendText = function (text: string) {
    this.append(text);
  };
}
export class Events {
  events = new Map<string, Set<Function>>();
  on(name: string, fn: Function) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name)!.add(fn);
    return { off: () => this.events.get(name)?.delete(fn) };
  }
  emit(name: string, ...args: any[]) {
    this.events.get(name)?.forEach((fn) => fn(...args));
  }
}
