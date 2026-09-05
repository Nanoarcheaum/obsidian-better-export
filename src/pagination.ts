/** Layout operates on detached copies; source DOM and Markdown are never consumed. */
export interface PageFrame {
  body: HTMLElement;
  notes: HTMLElement;
}
export class LayoutError extends Error {}

const atomic =
  "img,video,svg,math,iframe,canvas,.math,.math-block,.math-inline,.internal-embed,.better-export-cite-marker";

function contentFits(frame: PageFrame): boolean {
  const body = frame.body;
  return (
    body.clientHeight > 0 &&
    body.scrollHeight <= body.clientHeight + 1 &&
    body.scrollWidth <= body.clientWidth + 1
  );
}

/** Range boundaries exclude indivisible media, formulae and citation markers. */
function boundaries(root: HTMLElement): Array<{ node: Node; offset: number }> {
  const points: Array<{ node: Node; offset: number }> = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let offset = 0;
      for (const character of Array.from(node.textContent ?? "")) {
        offset += character.length;
        points.push({ node, offset });
      }
    } else if (node instanceof HTMLElement || node instanceof SVGElement) {
      if (node.matches(atomic)) return;
      Array.from(node.childNodes).forEach((child, index) => {
        visit(child);
        points.push({ node, offset: index + 1 });
      });
    }
  };
  visit(root);
  return points;
}

function rangeParts(
  node: HTMLElement,
  point: { node: Node; offset: number },
): [HTMLElement, HTMLElement] {
  const before = node.ownerDocument.createRange();
  before.selectNodeContents(node);
  before.setEnd(point.node, point.offset);
  const after = node.ownerDocument.createRange();
  after.selectNodeContents(node);
  after.setStart(point.node, point.offset);
  const head = node.cloneNode(false) as HTMLElement,
    tail = node.cloneNode(false) as HTMLElement;
  head.append(before.cloneContents());
  tail.append(after.cloneContents());
  tail.removeAttribute("id");
  tail.classList.add("better-export-continuation");
  return [head, tail];
}

function splitBlock(
  node: HTMLElement,
  fits: (part: HTMLElement) => boolean,
): [HTMLElement, HTMLElement] | null {
  if (
    node.matches(atomic) ||
    node.querySelector("table[rowspan],td[rowspan],th[rowspan]")
  )
    return null;
  if (node.matches("table")) {
    const rows = Array.from(node.querySelectorAll(":scope > tbody > tr"));
    for (let count = rows.length - 1; count > 0; count--) {
      const head = node.cloneNode(true) as HTMLElement,
        tail = node.cloneNode(true) as HTMLElement;
      head.querySelectorAll(":scope > tbody > tr").forEach((row, i) => {
        if (i >= count) row.remove();
      });
      tail.querySelectorAll(":scope > tbody > tr").forEach((row, i) => {
        if (i < count) row.remove();
      });
      head.querySelectorAll("tfoot").forEach((el) => el.remove());
      tail.querySelectorAll("caption").forEach((el) => el.remove());
      tail.removeAttribute("id");
      if (fits(head)) return [head, tail];
    }
    return null;
  }
  // Renderer wrappers must keep their table structure intact, including repeated headings.
  if (
    node.children.length === 1 &&
    node.firstElementChild?.matches("table,ul,ol,div,p,pre,blockquote")
  ) {
    const child = node.firstElementChild as HTMLElement;
    const wrap = (part: HTMLElement) => {
      const shell = node.cloneNode(false) as HTMLElement;
      shell.append(part);
      return shell;
    };
    const parts = splitBlock(child, (part) => fits(wrap(part)));
    return parts ? [wrap(parts[0]), wrap(parts[1])] : null;
  }
  if (node.matches("ul,ol")) {
    const items = Array.from(node.children);
    for (let count = items.length - 1; count > 0; count--) {
      const head = node.cloneNode(false) as HTMLElement,
        tail = node.cloneNode(false) as HTMLElement;
      items.forEach((item, i) =>
        (i < count ? head : tail).append(item.cloneNode(true)),
      );
      if (node.matches("ol"))
        tail.setAttribute(
          "start",
          String(Number(node.getAttribute("start") || 1) + count),
        );
      if (fits(head)) return [head, tail];
    }
    if (items.length) {
      const first = items[0] as HTMLElement;
      const wrap = (part: HTMLElement) => {
        const shell = node.cloneNode(false) as HTMLElement;
        shell.append(part);
        return shell;
      };
      const parts = splitBlock(first, (part) => fits(wrap(part)));
      if (parts) {
        const tail = wrap(parts[1]);
        tail.append(...items.slice(1).map((item) => item.cloneNode(true)));
        parts[1].style.listStyleType = "none";
        return [wrap(parts[0]), tail];
      }
    }
    return null;
  }
  // Avoid slicing arbitrary plugin widgets; unsupported oversized blocks fail visibly.
  if (
    !node.matches("p,pre,blockquote,div,li") ||
    node.querySelector("table,ul,ol,iframe,canvas")
  )
    return null;
  const points = boundaries(node);
  let low = 0,
    high = points.length - 2,
    best: [HTMLElement, HTMLElement] | null = null;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2),
      parts = rangeParts(node, points[mid]!);
    if (
      parts[0].textContent?.length &&
      parts[1].textContent?.length &&
      fits(parts[0])
    ) {
      best = parts;
      low = mid + 1;
    } else high = mid - 1;
  }
  return best;
}

export function paginate(
  nodes: HTMLElement[],
  createPage: () => PageFrame,
  syncNotes: (page: PageFrame) => void,
  keepHeading = true,
): number {
  let current = createPage(),
    count = 1;
  const next = () => {
    current = createPage();
    count++;
  };
  const fits = (part: HTMLElement) => {
    current.body.append(part);
    syncNotes(current);
    const result = contentFits(current);
    part.remove();
    syncNotes(current);
    return result;
  };
  let pendingBreak = false;
  for (const source of nodes) {
    let node = source.cloneNode(true) as HTMLElement;
    if (
      node.matches(".better-export-page-break") ||
      (node.children.length === 1 &&
        node.firstElementChild?.matches(".better-export-page-break"))
    ) {
      pendingBreak = Boolean(current.body.children.length);
      continue;
    }
    if (pendingBreak) {
      next();
      pendingBreak = false;
    }
    if (!fits(node) && current.body.children.length) {
      const heading = current.body.lastElementChild as HTMLElement;
      if (
        keepHeading &&
        (heading.matches("h1,h2,h3,h4,h5,h6") ||
          (heading.children.length === 1 &&
            heading.firstElementChild?.matches("h1,h2,h3,h4,h5,h6")))
      ) {
        heading.remove();
        syncNotes(current);
        if (current.body.children.length) next();
        current.body.append(heading);
        syncNotes(current);
      } else next();
    }
    let iterations = 0;
    while (!fits(node)) {
      if (++iterations > 1000)
        throw new LayoutError("内容过长，分页已停止；请拆分章节后重试。");
      const parts = splitBlock(node, fits);
      if (!parts)
        throw new LayoutError(
          `第 ${count} 页的${node.matches("table") || node.querySelector("table") ? "表格行" : "内容块"}无法放入纸张（${(node.textContent || node.getAttribute("alt") || "图片或公式").trim().slice(0, 48)}）。请调整尺寸、页边距或拆分内容，未导出不完整页面。`,
        );
      current.body.append(parts[0]);
      syncNotes(current);
      node = parts[1];
      next();
    }
    current.body.append(node);
    syncNotes(current);
  }
  return count;
}

export async function waitForAssets(
  root: HTMLElement,
  timeout = 10000,
): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve, reject) => {
          const finish = () => {
            clearTimeout(timer);
            img.removeEventListener("load", done);
            img.removeEventListener("error", failed);
          };
          const done = () => {
            finish();
            img.naturalWidth
              ? resolve()
              : reject(new LayoutError("图片未能加载，请检查附件链接。"));
          };
          const failed = () => {
            finish();
            reject(new LayoutError("图片未能加载，请检查附件链接。"));
          };
          const timer = window.setTimeout(() => {
            finish();
            reject(new LayoutError("图片加载超时，请重试。"));
          }, timeout);
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", failed, { once: true });
          if (img.complete) done();
        }),
    ),
  );
  let timer = 0;
  try {
    await Promise.race([
      root.ownerDocument.fonts.ready,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(
          () => reject(new LayoutError("字体加载超时，请重试。")),
          timeout,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
