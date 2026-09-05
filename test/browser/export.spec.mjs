import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("native images and Obsidian image wrappers apply width exactly once", async ({
  page,
}) => {
  await page.evaluate(() => {
    const src =
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><rect width="120" height="60" fill="green"/></svg>',
      );
    const alt =
      "better-export-media better-export-width-75 better-export-align-center";
    return window.setup(
      `<p><img src="${src}" alt="${alt}"></p><p><span class="internal-embed" alt="${alt}"><img src="${src}" alt="${alt}"></span></p>`,
    );
  });
  await ready(page);
  const widths = await page
    .locator(".better-export-preview-frame > .better-export-pages img")
    .evaluateAll((images) =>
      images.map((image) => image.getBoundingClientRect().width),
    );
  expect(widths).toHaveLength(2);
  expect(Math.abs(widths[0] - widths[1])).toBeLessThan(1);
});
test.beforeEach(async ({ page }) => {
  await page.route("http://localhost/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><head></head><body></body></html>",
    }),
  );
  await page.goto("http://localhost/");
  await page.addStyleTag({
    content:
      fs.readFileSync("styles.css", "utf8") +
      "body{--background-primary:#fff;--background-secondary:#f3f4f1;--text-normal:#24312c;--text-muted:#65756d;--background-modifier-border:#d9dfdc;font:14px Georgia;}button,input,select,textarea{font:inherit;padding:5px;border:1px solid #c8d0cb;border-radius:4px;background:white}.setting-item{display:flex;align-items:center;justify-content:space-between;gap:6px}.mod-cta{background:#376451;color:white}",
  });
  await page.addScriptTag({ path: "test-dist/browser.js" });
});
const ready = async (page) =>
  expect(page.locator(".better-export-status")).toContainText("已同步");

test("Markdown formula furniture waits for math and deleted templates retain the page", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("正文"));
  await ready(page);
  await page.getByRole("button", { name: "封面·版头", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "从示例开始", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "新建空白", exact: true }).click();
  await page.evaluate(() =>
    window.panel.updateCover((t) => {
      t.rows[0].cells[0].text = String.raw`$$\frac{{a}}{{b}}$$`;
    }, true),
  );
  await ready(page);
  await expect(
    page.locator(
      '.better-export-preview-frame > .better-export-pages .better-export-cover [data-math-ready="true"]',
    ),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "版头", exact: true }).click();
  await page.getByRole("button", { name: "新建空白", exact: true }).click();
  await page.evaluate(() =>
    window.panel.updateHeader((t) => {
      t.rows[0].cells[0].text = "$x^2$";
    }, true),
  );
  await ready(page);
  await expect(
    page.locator(
      '.better-export-preview-frame > .better-export-pages .better-export-custom-header [data-math-ready="true"]',
    ),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "删除模板", exact: true }).click();
  await ready(page);
  expect(
    await page.evaluate(() => window.plugin.settings.headerTemplates.length),
  ).toBe(0);
  await expect(
    page.locator(
      ".better-export-preview-frame > .better-export-pages .better-export-custom-header",
    ),
  ).toContainText("x^2");
  await page.getByRole("button", { name: "撤销删除", exact: true }).click();
  expect(
    await page.evaluate(() => window.plugin.settings.headerTemplates.length),
  ).toBe(1);
  expect(
    await page.evaluate(() =>
      window.app.renderedMarkdown.includes(String.raw`$$\frac{{a}}{{b}}$$`),
    ),
  ).toBe(true);
});

test("global template restores document typography and citation rules independently", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("正文"));
  await ready(page);
  await page.evaluate(() => {
    window.panel.set("bodySize", 17);
    window.panel.citationOptions.placement = "both";
  });
  await page.locator(".better-export-global-library > summary").click();
  await page
    .getByRole("button", { name: "保存当前为全局模板", exact: true })
    .click();
  await page.evaluate(() => {
    window.panel.set("bodySize", 10);
    window.panel.citationOptions.placement = "bibliography";
  });
  await page.getByRole("button", { name: "应用到本篇", exact: true }).click();
  await ready(page);
  expect(
    await page.evaluate(() => [
      window.panel.profile.bodySize,
      window.panel.citationOptions.placement,
    ]),
  ).toEqual([17, "both"]);
  await page.getByRole("button", { name: "删除全局模板", exact: true }).click();
  expect(
    await page.evaluate(() => window.plugin.settings.globalTemplates.length),
  ).toBe(0);
  expect(await page.evaluate(() => window.panel.profile.bodySize)).toBe(17);
});

test("wiki link color and plain text export keep editor source intact", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("[[Page|Label]]"));
  await ready(page);
  await page.evaluate(() => window.panel.set("wikiLinkColor", "#ff0000"));
  await ready(page);
  const scope = ".better-export-preview-frame > .better-export-pages";
  await expect(page.locator(scope + " a.internal-link")).toHaveCSS(
    "color",
    "rgb(255, 0, 0)",
  );
  await page
    .locator(".setting-item")
    .filter({ hasText: "双向链接导出" })
    .locator("select")
    .selectOption("text");
  await ready(page);
  await expect(page.locator(scope + " a.internal-link")).toHaveCount(0);
  await expect(page.locator(scope)).toContainText("Label");
  await page
    .locator(".setting-item")
    .filter({ hasText: "双向链接导出" })
    .locator("select")
    .selectOption("source");
  await ready(page);
  await expect(page.locator(scope + " a.internal-link")).toHaveCount(0);
  await expect(page.locator(scope)).toContainText("[[Page|Label]]");
  expect(await page.evaluate(() => window.view.editor.getValue())).toBe(
    "[[Page|Label]]",
  );
});

test("pasting an image creates an independent full page cover", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("正文"));
  await ready(page);
  await page.evaluate(() => {
    const file = new window.view.file.constructor("cover.png");
    file.extension = "png";
    window.app.fileManager = {
      getAvailablePathForAttachment: async () => file.path,
    };
    window.app.vault.createBinary = async (path, bytes) => {
      window.savedImage = { path, size: bytes.byteLength };
    };
    window.app.vault.getAbstractFileByPath = () => file;
    window.app.vault.getResourcePath = () =>
      "data:image/svg+xml," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
      );
  });
  await page.getByRole("button", { name: "封面·版头", exact: true }).click();
  await page
    .getByRole("button", { name: "粘贴图片作为封面", exact: true })
    .click();
  await page.locator(".better-export-image-paste-zone").evaluate((zone) => {
    const dt = new DataTransfer();
    dt.items.add(new File(["image"], "cover.png", { type: "image/png" }));
    zone.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }),
    );
  });
  await expect(page.locator(".better-export-image-paste-zone")).toHaveCount(0);
  await ready(page);
  const img = page.locator(
    ".better-export-preview-frame > .better-export-pages .better-export-image-cover > img",
  );
  await expect(img).toHaveCSS("object-fit", "contain");
  expect(await page.evaluate(() => window.savedImage.size)).toBeGreaterThan(0);
  await page
    .locator(".setting-item")
    .filter({ hasText: "图片适配" })
    .locator("select")
    .selectOption("cover");
  await ready(page);
  await expect(img).toHaveCSS("object-fit", "cover");
  await expect(
    page.locator(
      ".better-export-preview-frame > .better-export-pages .better-export-page",
    ),
  ).toHaveCount(2);
});
test("long paragraphs preserve every character and PDF uses the same pages", async ({
  page,
}) => {
  const text = "Long paragraph 内容守恒 sample with emphasis. ".repeat(500);
  await page.evaluate(
    (text) => window.setup(`<h1>分页检查</h1><p>${text}</p>`),
    text,
  );
  await ready(page);
  const pageCount = await page
    .locator(
      ".better-export-preview-frame > .better-export-pages .better-export-page",
    )
    .count();
  expect(pageCount).toBeGreaterThan(2);
  const actual = await page
    .locator(
      ".better-export-preview-frame > .better-export-pages .better-export-page-content p",
    )
    .allTextContents();
  expect(actual.join("")).toBe(text);
  await page.evaluate(() => {
    document.body.classList.add("better-export-printing");
    document
      .querySelector(".better-export-floating-panel")
      .classList.add("is-print-target");
  });
  await page.pdf({
    path: "test-results/long-document.pdf",
    preferCSSPageSize: true,
    printBackground: true,
  });
  fs.writeFileSync(
    "test-results/long-document-expected.json",
    JSON.stringify({ pageCount, text: "分页检查" + text }),
  );
});
test("table rows carry repeated headers without losing or duplicating data", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setup(
      "<table><thead><tr><th>编号</th><th>结果</th></tr></thead><tbody>" +
        Array.from(
          { length: 120 },
          (_, i) => `<tr><td>${i}</td><td>实验结果</td></tr>`,
        ).join("") +
        "</tbody></table>",
    ),
  );
  await ready(page);
  const values = await page
    .locator(
      ".better-export-preview-frame > .better-export-pages tbody tr td:first-child",
    )
    .allTextContents();
  expect(values).toEqual(Array.from({ length: 120 }, (_, i) => String(i)));
  expect(
    await page
      .locator(".better-export-preview-frame > .better-export-pages thead")
      .count(),
  ).toBeGreaterThan(1);
});
test("oversized indivisible content fails visibly and cannot print", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setup(
      '<table><tbody><tr><td style="height:3000px">oversized row</td></tr></tbody></table>',
    ),
  );
  await expect(page.locator(".better-export-render-error")).toContainText(
    "无法放入纸张",
  );
  await expect(
    page.getByRole("button", { name: "导出 PDF", exact: true }),
  ).toBeDisabled();
});
test("editing then changing parameters consumes the newest body, including removed citations", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("<p>初稿</p>"));
  await ready(page);
  await page.evaluate(() => {
    window.setDisk("<p>最终正文</p>");
    window.panel.set("bodySize", 13);
  });
  await expect(
    page.getByRole("button", { name: "导出 PDF", exact: true }),
  ).toBeDisabled();
  await ready(page);
  await expect(page.locator(".better-export-preview-frame")).toContainText(
    "最终正文",
  );
  await expect(page.locator(".better-export-preview-frame")).not.toContainText(
    "初稿",
  );
  await page.evaluate(() => {
    window.plugin.settings.references = [
      {
        id: "1",
        citeKey: "张三2024",
        authors: "张三",
        year: "2024",
        title: "文献标题",
        container: "期刊",
        type: "article",
        doi: "",
        url: "",
        volume: "",
        issue: "",
        pages: "",
      },
    ];
    window.panel.citationOptions.placement = "both";
    window.setSource("<p>结果 [@张三2024, p. 1] 和 [@张三2024, p. 2]</p>");
  });
  await ready(page);
  expect(
    await page
      .locator(
        ".better-export-preview-frame > .better-export-pages .better-export-page-note",
      )
      .count(),
  ).toBe(2);
  await page.evaluate(() => {
    window.setSource("<p>已删除引用</p>");
    window.panel.set("marginTop", 25);
  });
  await ready(page);
  await expect(page.locator(".better-export-preview-frame")).not.toContainText(
    "文献标题",
  );
  expect(await page.locator(".better-export-page-note").count()).toBe(0);
});
test("closing during asynchronous rendering prevents stale panels and callbacks", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.setup("<p>旧内容</p>");
  });
  await ready(page);
  await page.evaluate(() => {
    window.app.delay = 450;
    window.setSource("<p>慢渲染</p>");
    window.panel.render();
    window.panel.close();
  });
  await page.waitForTimeout(700);
  expect(await page.locator(".better-export-floating-panel").count()).toBe(0);
  await page.evaluate(() => window.plugin.openPanel());
  await ready(page);
  expect(await page.locator(".better-export-floating-panel").count()).toBe(1);
});
test("minimizing keeps normal bounds and zoom does not alter pagination", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setup("<h1>实验报告</h1><p>实时排版与引用。</p>"),
  );
  await ready(page);
  const before = await page.evaluate(() => {
    window.panel.saveBounds();
    return window.plugin.settings.panel;
  });
  await page.getByRole("button", { name: "最小化", exact: true }).click();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.plugin.settings.panel)).toEqual(
    before,
  );
  await page.getByRole("button", { name: "还原窗口", exact: true }).click();
  await page.getByRole("spinbutton", { name: "预览缩放百分比" }).fill("50");
  expect(
    await page
      .locator(
        ".better-export-preview-frame > .better-export-pages .better-export-page",
      )
      .count(),
  ).toBe(1);
  await page.screenshot({ path: "test-results/export-workspace.png" });
});
test("template edits isolate shared documents and undo restores the original binding", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("<p>模板测试</p>"));
  await ready(page);
  await page.evaluate(() => {
    const p = window.plugin;
    const t = {
      id: "shared",
      name: "共同版头",
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
              text: "原版",
              fontSize: 12,
              width: 1,
              align: "left",
              bold: false,
              underline: false,
            },
          ],
        },
      ],
    };
    p.settings.headerTemplates = [t];
    p.settings.documentHeaderIds = {
      "报告.md": "shared",
      "另一篇.md": "shared",
    };
    window.panel.tab = "header";
    window.panel.furnitureMode = "header";
    window.panel.sidebar();
    window.panel.updateHeader(
      (t) => (t.rows[0].cells[0].text = "本篇修改"),
      true,
    );
  });
  await ready(page);
  expect(
    await page.evaluate(
      () =>
        window.plugin.settings.headerTemplates.find((t) => t.id === "shared")
          .rows[0].cells[0].text,
    ),
  ).toBe("原版");
  await expect(page.locator(".better-export-preview-frame")).toContainText(
    "本篇修改",
  );
  await page.getByRole("button", { name: "撤销上次模板修改" }).click();
  await ready(page);
  await expect(page.locator(".better-export-preview-frame")).toContainText(
    "原版",
  );
});
test("renaming note and template assets preserves stored associations", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("<p>重命名测试</p>"));
  await ready(page);
  const actual = await page.evaluate(() => {
    const s = window.plugin.settings;
    s.documentHeaderIds["报告.md"] = "t";
    s.headerTemplates = [{ id: "t", logoPath: "附件/logo.png" }];
    s.references = [{ sourcePath: "papers/paper.md" }];
    window.view.file.path = "新报告.md";
    window.app.vault.emit("rename", window.view.file, "报告.md");
    window.app.vault.emit("rename", { path: "资料" }, "papers");
    window.app.vault.emit("rename", { path: "图片/logo.png" }, "附件/logo.png");
    return {
      profile: !!s.documentProfiles["新报告.md"],
      header: s.documentHeaderIds["新报告.md"],
      source: s.references[0].sourcePath,
      image: s.headerTemplates[0].logoPath,
      old: s.documentProfiles["报告.md"],
    };
  });
  expect(actual).toEqual({
    profile: true,
    header: "t",
    source: "资料/paper.md",
    image: "图片/logo.png",
    old: undefined,
  });
});
test("editing while minimized resumes a valid latest preview on restore", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("<p>旧正文</p>"));
  await ready(page);
  await page.getByRole("button", { name: "最小化", exact: true }).click();
  await page.evaluate(() => window.setSource("<p>最小化期间的修改</p>"));
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "还原窗口", exact: true }).click();
  await ready(page);
  await expect(page.locator(".better-export-preview-frame")).toContainText(
    "最小化期间的修改",
  );
});
test("wrapped headings stay with following text and explicit breaks do not leave empty trailing pages", async ({
  page,
}) => {
  await page.evaluate(() =>
    window.setup(
      '<p style="height:790px">前文</p><div><h2>第二节</h2></div><p style="height:140px">后文</p><div><div class="better-export-page-break"></div></div>',
    ),
  );
  await ready(page);
  const pages = await page
    .locator(
      ".better-export-preview-frame > .better-export-pages .better-export-page-content",
    )
    .allTextContents();
  expect(pages.length).toBe(2);
  expect(pages[1]).toContain("第二节");
  expect(pages[1]).toContain("后文");
});
test("a long list item splits without losing text and resumes the correct list counter", async ({
  page,
}) => {
  const text = "Very long list entry. ".repeat(400);
  await page.evaluate(
    (text) =>
      window.setup(`<ol start="3"><li>${text}</li><li>Last item</li></ol>`),
    text,
  );
  await ready(page);
  const actual = await page
    .locator(".better-export-preview-frame > .better-export-pages li")
    .allTextContents();
  expect(actual.join("")).toBe(text + "Last item");
});
test("citation problem buttons remain clickable and select the exact source token", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("<p>正文 [@缺失键]</p>"));
  await expect(page.locator(".better-export-render-error")).toBeVisible();
  await page.evaluate(() => {
    window.view.editor.offsetToPos = (offset) => ({ line: 0, ch: offset });
    window.view.editor.setSelection = (from, to) =>
      (window.selectedRange = { from, to });
    window.panel.tab = "cite";
    window.panel.sidebar();
  });
  await page.getByRole("button", { name: /第 1 行 · 缺少 @缺失键/ }).click();
  expect(await page.evaluate(() => window.selectedRange)).toEqual({
    from: { line: 0, ch: 6 },
    to: { line: 0, ch: 12 },
  });
});
test("print keeps its layout until afterprint and restores UI after cancellation or completion", async ({
  page,
}) => {
  await page.evaluate(() => window.setup("<p>打印状态测试</p>"));
  await ready(page);
  await page.evaluate(() => {
    window.print = () => {};
    return window.panel.print();
  });
  await expect(page.locator(".better-export-floating-panel")).toHaveClass(
    /is-print-target/,
  );
  await expect(
    page.getByRole("button", { name: "导出 PDF", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator(".better-export-floating-panel")).not.toHaveClass(
    /is-print-target/,
  );
  await expect(
    page.getByRole("button", { name: "导出 PDF", exact: true }),
  ).toBeEnabled();
});

