# Better Export

An Obsidian desktop plugin for paginated PDF export, reusable covers and headers, document templates, and offline CSL citations.

**Author: Nanoarcheaum · Version: 0.8.1 · Public beta**

面向论文和报告写作，在独立窗口中配置版式、封面、版头与引用，预览分页并导出 PDF。当前为公开测试版，尚未完成真实 Obsidian、多主题和跨系统验收，也未进入社区插件市场。

## Features / 功能

- A4 / Letter 纸张、字体、字号、颜色、页眉页脚和独立预览缩放。
- 原生 Markdown 封面和版头，支持 `$x^2$`、`$$\frac{a}{b}$$` 与 `{{字段}}`。
- 粘贴整页图片封面，可选完整显示或铺满裁切。
- 独立可展开的全局模板面板，保存字体、版式、封面、版头、链接和引用规则；可选包含文献库。
- 模板复制、删除、撤销删除；删除后已有文档保留独立版式。
- 双向链接自定义颜色，以及链接、纯文字、保留 `[[源码]]` 三种导出方式。
- 离线 CSL 引用格式，支持 Vault 文献笔记和 Zotero CSL JSON / BibTeX / RIS 导入。
- 长段落、列表、表格分页续排；无法容纳的内容显示错误并阻止导出。

## Installation / 安装

1. Download `better-export-0.8.1.zip` from **Releases** and extract it.
2. Copy the `better-export` folder into your test vault's `.obsidian/plugins/` directory. `main.js`, `manifest.json`, and `styles.css` must sit directly inside it.
3. Restart Obsidian and enable **Better Export** under Settings → Community plugins.
4. When upgrading, preserve your existing `data.json` and attachments.

建议先用独立测试库体验。仅支持桌面端，声明的最低 Obsidian 版本为 1.5.0；最低版本兼容性尚待实际验证。

## Usage / 使用

打开 Markdown 笔记，点击 **Better Export** 图标或运行“打开 PDF 导出悬浮窗”命令。

顶部 **全局模板** 是独立可展开面板，管理整套配置；下方 **版式 / 封面·版头 / 引用** 三个分页分别调整具体内容。应用全局模板后，本篇可继续独立修改。

封面与版头单元格支持 Markdown 和 LaTeX。点击“粘贴图片作为封面”，在粘贴区按 Ctrl/Cmd+V；图片写入当前笔记配置的附件位置。

引用使用 `[@key]` 或 `[@key, p. 12]`。支持 APA 7、GB/T 7714—2015 顺序编码、Chicago 第 18 版作者—年份。当页文献注释是本页文献列表，不是 Chicago Notes 逐次脚注。

等待“已同步”后点击“导出 PDF”。系统打印选择匹配纸张、100% 缩放，关闭系统额外页眉页脚。

## Data and limitations / 数据与限制

- 版式、模板、字段、引用规则和文献库保存在插件 `data.json` 中。迁移时还需复制图片附件。
- 导出配置不改写正文；插入引用、分页符及右键文字/媒体排版会写入 Markdown，可使用编辑器撤销。
- 引用样式已内置；Markdown 中的远程图片等内容仍可能由 Obsidian 请求。
- 暂不支持组合引用 `[@a; @b]`、视频写入静态 PDF、DOCX 导出。过大的不可拆分公式、媒体或表格可能阻止输出。
- PDF 内部链接跳转取决于阅读器。第三方动态内容、主题与真实 MathJax 排版仍需宿主验收。

## Development

Node.js 22+:

```sh
npm ci
npm run check
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

Windows 优先使用已安装的 Edge，其他环境使用 Playwright Chromium。浏览器测试执行实际面板和分页代码，但使用简化 Obsidian 适配器，不能替代真实应用测试。

```sh
python -m pip install pypdf
python test/verify-pdf.py
node package-dev.mjs
```

PDF 核对脚本依赖浏览器测试生成的文件。打包目录在 `release/`，含插件、源代码和第三方材料。CI 配置在 Ubuntu 和 Windows 上执行编译、逻辑测试和浏览器测试。

## Project documentation

- [项目评价与优先级](docs/PROJECT_REVIEW.md)
- [贡献指南](CONTRIBUTING.md)
- [更新记录](CHANGELOG.md)
- [第三方组件](THIRD_PARTY.md)

## License

**AGPL-3.0-or-later**, see [LICENSE](LICENSE). citeproc 保留原始双重许可声明，本项目按其 AGPL 选项分发；CSL 样式与语言资源保留各自 CC BY-SA 声明。源码和构建方式随发行包提供。
