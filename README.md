# Better Export

愿景：实现 Obsidian 日常工作流 all in one 的需求

**Author: Nanoarcheaum · Version: 0.8.2 · Public beta**

面向日程实验报告书写，在独立窗口中配置版式、封面、版头与引用，预览分页并导出 PDF。当前为公开测试版。

## Features / 功能

### 1.更好的图像排版
右键图片可以快捷设置缩放、并列放置和居中。正文图片支持自动组成 2–4 列；分组后可拖动右下角按原图比例微调占比，或用“一键对齐”恢复等宽等高。圆角可在插件设置中调整。

<img width="754" height="388" alt="image" src="https://github.com/user-attachments/assets/a9e840f0-43a0-44e9-8ae8-694b4f2f8d74" />

### 2.更好的文字排版
右键选中文字也可以快捷设置文字颜色、字号等信息

<img width="590" height="349" alt="image" src="https://github.com/user-attachments/assets/119ba7a3-95f6-4865-a03b-991fb11b60b8" />

### 3.更好的导出
在左边栏新增了导出按键，点击弹出导出界面，并支持以下基本功能

- 标题、子标题、正文：字号字体颜色设置
- 纸张配置：横竖构图、页眉页脚页边距、纸面比例、页码设置
- Obsidian 双向链接自定义颜色，以及链接、纯文字、保留 `[[源码]]` 三种导出方式。
- **版头功能**：为页面添加版头，**支持导入图片！！！**，且支持保存模版，支持 markdown 符号输入`$x^2$`、`$$\frac{a}{b}$$` 与 `{{字段}}`。 （使用场景：无机分化实验）

<img width="917" height="550" alt="image" src="https://github.com/user-attachments/assets/4989e8c6-0700-40d5-930b-5273754cfbf3" />

- **封面功能**：为页面添加封面，**支持导入图片！！**， 且支持保存模版，支持 markdown 符号输入`$x^2$`、`$$\frac{a}{b}$$` 与 `{{字段}}`。 （使用场景：普物实验）

<img width="960" height="616" alt="image" src="https://github.com/user-attachments/assets/1c01d7f0-3f4f-49f5-818f-c5216353e16f" />


- 独立可展开的**全局模板**面板，保存字体、版式、封面、版头、链接和引用规则；
- **一键引用文献**，支持 Vault 文献笔记和 Zotero CSL JSON / BibTeX / RIS 导入，并生成规范的论文引用格式。
- 多张封面图片可粘贴或批量选择，并逐张调整尺寸、位置、裁切和叠放顺序。
- 模板支持复制、删除和撤销删除；全局模板可选包含文献库。
- 长段落、列表、表格分页续排；无法容纳的内容显示错误并阻止导出。

## Data / 数据处理

本插件暂无数据处理功能

至于完成报告时需要的数据处理、图表绘制，可以移步作者合作开发的另一个项目[**SyphonNov**](https://github.com/Feathrior/SyphonNov) 

一个 **可视化超强-交互超爽-上手超快** 的绘图软件

## Installation / 安装

1. Extract the supplied `better-export-0.8.2.zip` package (or download a published version from **Releases**).
2. Copy the `better-export` folder into your test vault's `.obsidian/plugins/` directory. `main.js`, `manifest.json`, and `styles.css` must sit directly inside it.
3. Restart Obsidian and enable **Better Export** under Settings → Community plugins.
4. When upgrading, preserve your existing `data.json` and attachments.

建议先用独立测试库体验。仅支持桌面端，声明的最低 Obsidian 版本为 1.5.0；最低版本兼容性尚待实际验证。

## Usage / 使用

打开 Markdown 笔记，点击 **Better Export** 图标或运行“打开 PDF 导出悬浮窗”命令。

顶部 **全局模板** 是独立可展开面板，管理整套配置；下方 **版式 / 封面·版头 / 引用** 三个分页分别调整具体内容。应用全局模板后，本篇可继续独立修改。

封面与版头单元格支持 Markdown 和 LaTeX。点击“添加封面图片”，粘贴或多选本地图片，重复添加不会覆盖原图。在“封面图片排版”逐张设置宽高及位置（整张纸的百分比，输入后按 Tab 或离开输入框应用）、居中、整页和前后层级。完整显示保持原图比例，铺满裁切填满指定区域。图片写入笔记附件位置；移除仅取消封面使用，不删除附件。旧徽标可点击“将旧徽标转为可排版图片”。

封面行的“行前/行后”同时显示毫米数和占整页高度的比例，并提供 0–100% 标尺。拖动滑杆预览数值，松开后应用；也可以直接输入毫米值。侧栏因增删行、切换样式等操作重建时会保持当前位置。

在正文图片上点击右键可以设置多列排版。分组完成后，将鼠标移到图片右下角并拖动即可按原图比例缩放、微调横向占比，松手后尺寸会保存到 Markdown。再次右键选择“一键对齐”，可清除组内微调并恢复等宽、等高的 4:3 完整显示框；图片不会被拉伸或裁掉。

在 Obsidian 的 **设置 → Better Export → 正文图片圆角** 中可将圆角调整为 0–32 px。该设置同时用于编辑器、阅读视图和 PDF 导出，默认值为 10 px。

点击 **导出 PDF** 会先选择保存位置，再直接生成 `.pdf` 文件，不会打开系统打印窗口。需要纸张驱动、实体打印机或系统级打印选项时，可使用旁边的 **系统打印**。

引用使用 `[@key]` 或 `[@key, p. 12]`。支持 APA 7、GB/T 7714—2015 顺序编码、Chicago 第 18 版作者—年份。当页文献注释是本页文献列表，不是 Chicago Notes 逐次脚注。

等待“已同步”后点击“导出 PDF”。只有需要实体打印机或系统打印选项时才使用“系统打印”。

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
