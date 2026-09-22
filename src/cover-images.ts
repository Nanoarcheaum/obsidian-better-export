import type { ExportCoverTemplate } from "./export-header";
export interface CoverImage {
  id: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fit: "contain" | "cover";
}
const number = (value: unknown, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback));
};
export function normalizeCoverImage(image: CoverImage): CoverImage {
  const width = number(image.width, 50, 1, 100),
    height = number(image.height, 50, 1, 100);
  return {
    id: image.id || crypto.randomUUID(),
    path: String(image.path ?? ""),
    width,
    height,
    x: number(image.x, 0, 0, 100 - width),
    y: number(image.y, 0, 0, 100 - height),
    fit: image.fit === "cover" ? "cover" : "contain",
  };
}
export function coverImages(template: ExportCoverTemplate): CoverImage[] {
  if (Array.isArray(template.images))
    return template.images.map(normalizeCoverImage);
  return template.imagePath
    ? [
        normalizeCoverImage({
          id: "legacy-cover-image",
          path: template.imagePath,
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          fit: template.imageFit ?? "contain",
        }),
      ]
    : [];
}
export function addCoverImages(
  template: ExportCoverTemplate,
  paths: string[],
): void {
  const images = coverImages(template);
  const initial = images.length === 0,
    cols = Math.ceil(Math.sqrt(paths.length)),
    rows = Math.ceil(paths.length / cols);
  for (const [index, path] of paths.entries()) {
    const full =
        images.length === 0 && paths.length === 1 && template.mode === "image",
      tile = initial && paths.length > 1;
    images.push(
      normalizeCoverImage({
        id: crypto.randomUUID(),
        path,
        x: tile ? ((index % cols) * 100) / cols : full ? 0 : 25,
        y: tile ? (Math.floor(index / cols) * 100) / rows : full ? 0 : 25,
        width: tile ? 100 / cols : full ? 100 : 50,
        height: tile ? 100 / rows : full ? 100 : 50,
        fit: "contain",
      }),
    );
  }
  template.images = images;
  template.imagePath = "";
}
