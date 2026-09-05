import { ExportProfile, DEFAULT_PROFILE } from "./export-style";
import {
  ExportHeaderTemplate,
  ExportCoverTemplate,
  normalizeHeader,
  normalizeCover,
} from "./export-header";
import { CitationStyle, CitationPlacement, ReferenceRecord } from "./citations";
import { mergeReferences } from "./reference-library";
export interface CitationOptions {
  style: CitationStyle;
  placement: CitationPlacement;
}
export interface GlobalTemplate {
  id: string;
  name: string;
  profile: ExportProfile;
  header: ExportHeaderTemplate | null;
  cover: ExportCoverTemplate | null;
  headerValues: Record<string, string>;
  coverValues: Record<string, string>;
  citations: CitationOptions;
  references?: ReferenceRecord[];
}
export interface TemplateStore {
  headerTemplates: ExportHeaderTemplate[];
  coverTemplates: ExportCoverTemplate[];
  globalTemplates: GlobalTemplate[];
  documentHeaderIds: Record<string, string>;
  documentCoverIds: Record<string, string>;
  documentHeaderSnapshots: Record<string, ExportHeaderTemplate>;
  documentCoverSnapshots: Record<string, ExportCoverTemplate>;
  documentHeaderValues: Record<string, Record<string, string>>;
  documentCoverValues: Record<string, Record<string, string>>;
  documentProfiles: Record<string, ExportProfile>;
  documentCitationOptions: Record<string, CitationOptions>;
  references: ReferenceRecord[];
}
export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export function currentHeader(
  state: TemplateStore,
  path: string,
): ExportHeaderTemplate | null {
  return (
    state.headerTemplates.find((t) => t.id === state.documentHeaderIds[path]) ??
    state.documentHeaderSnapshots[path] ??
    null
  );
}
export function currentCover(
  state: TemplateStore,
  path: string,
): ExportCoverTemplate | null {
  return (
    state.coverTemplates.find((t) => t.id === state.documentCoverIds[path]) ??
    state.documentCoverSnapshots[path] ??
    null
  );
}
export function captureGlobal(
  state: TemplateStore,
  path: string,
  name: string,
  profile: ExportProfile,
  citations: CitationOptions,
  includeReferences = false,
): GlobalTemplate {
  return copy({
    id: crypto.randomUUID(),
    name: name.trim() || "未命名全局模板",
    profile,
    header: currentHeader(state, path),
    cover: currentCover(state, path),
    headerValues: state.documentHeaderValues[path] ?? {},
    coverValues: state.documentCoverValues[path] ?? {},
    citations,
    ...(includeReferences ? { references: state.references } : {}),
  });
}
export function normalizeGlobal(template: GlobalTemplate): GlobalTemplate {
  return {
    ...template,
    name: String(template.name || "未命名全局模板"),
    profile: { ...DEFAULT_PROFILE, ...template.profile },
    header: template.header ? normalizeHeader(template.header) : null,
    cover: template.cover ? normalizeCover(template.cover) : null,
    headerValues: { ...template.headerValues },
    coverValues: { ...template.coverValues },
    citations: {
      style: template.citations?.style ?? "apa7",
      placement: template.citations?.placement ?? "bibliography",
    },
  };
}
export function applyGlobal(
  state: TemplateStore,
  path: string,
  template: GlobalTemplate,
): void {
  const value = copy(normalizeGlobal(template));
  state.documentProfiles[path] = value.profile;
  state.documentCitationOptions[path] = value.citations;
  delete state.documentHeaderIds[path];
  delete state.documentCoverIds[path];
  if (value.header) state.documentHeaderSnapshots[path] = value.header;
  else delete state.documentHeaderSnapshots[path];
  if (value.cover) state.documentCoverSnapshots[path] = value.cover;
  else delete state.documentCoverSnapshots[path];
  state.documentHeaderValues[path] = value.headerValues;
  state.documentCoverValues[path] = value.coverValues;
  if (value.references)
    mergeReferences(
      state.references,
      value.references.filter(
        (ref) =>
          !state.references.some(
            (existing) =>
              existing.id === ref.id ||
              (existing.citeKey === ref.citeKey &&
                existing.title === ref.title &&
                existing.authors === ref.authors &&
                existing.year === ref.year),
          ),
      ),
    );
}
/** Remove a library item; documents retain independent snapshots of their current furniture. */
export function deleteFurniture(
  state: TemplateStore,
  kind: "header" | "cover",
  id: string,
): ExportHeaderTemplate | ExportCoverTemplate | null {
  if (kind === "header") {
    const template = state.headerTemplates.find((t) => t.id === id);
    if (!template) return null;
    for (const [path, active] of Object.entries(state.documentHeaderIds))
      if (active === id) {
        state.documentHeaderSnapshots[path] = copy(template);
        delete state.documentHeaderIds[path];
      }
    state.headerTemplates = state.headerTemplates.filter((t) => t.id !== id);
    return copy(template);
  }
  const template = state.coverTemplates.find((t) => t.id === id);
  if (!template) return null;
  for (const [path, active] of Object.entries(state.documentCoverIds))
    if (active === id) {
      state.documentCoverSnapshots[path] = copy(template);
      delete state.documentCoverIds[path];
    }
  state.coverTemplates = state.coverTemplates.filter((t) => t.id !== id);
  return copy(template);
}
