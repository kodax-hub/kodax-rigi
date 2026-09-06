import type { Category, Match } from "./types";

export interface Subject {
  uid: string;
  label: string;
}

export interface AnonymizedExport {
  format: "anonymo.document";
  version: 1;
  createdAt: string;
  subject: Subject;
  source: { fileName: string; characters: number };
  stats: { total: number; applied: number; byCategory: Record<string, number> };
  entities: Array<{
    placeholder: string;
    category: Category;
    occurrences: number;
  }>;
  text: string;
}

export interface KeyMapExport {
  format: "anonymo.keymap";
  version: 1;
  createdAt: string;
  subject: Subject;
  source: { fileName: string };
  mapping: Array<{ placeholder: string; category: Category; value: string }>;
}

/** Short, readable, collision-safe identifier, e.g. MND-7QK4-2F1B. */
export function generateUid(prefix = "MND"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

function activeMatches(matches: Match[], disabled: Set<string>) {
  return matches.filter((m) => !disabled.has(m.id));
}

export function buildAnonymizedExport(params: {
  subject: Subject;
  fileName: string;
  redacted: string;
  matches: Match[];
  disabled: Set<string>;
}): AnonymizedExport {
  const active = activeMatches(params.matches, params.disabled);
  const byCategory: Record<string, number> = {};
  const entityMap = new Map<string, { placeholder: string; category: Category; occurrences: number }>();
  for (const m of active) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
    const e = entityMap.get(m.placeholder);
    if (e) e.occurrences += 1;
    else entityMap.set(m.placeholder, { placeholder: m.placeholder, category: m.category, occurrences: 1 });
  }
  return {
    format: "anonymo.document",
    version: 1,
    createdAt: new Date().toISOString(),
    subject: params.subject,
    source: { fileName: params.fileName, characters: params.redacted.length },
    stats: { total: params.matches.length, applied: active.length, byCategory },
    entities: [...entityMap.values()],
    text: params.redacted,
  };
}

export function buildKeyMapExport(params: {
  subject: Subject;
  fileName: string;
  matches: Match[];
  disabled: Set<string>;
}): KeyMapExport {
  const seen = new Map<string, { placeholder: string; category: Category; value: string }>();
  for (const m of activeMatches(params.matches, params.disabled)) {
    if (!seen.has(m.placeholder)) {
      seen.set(m.placeholder, { placeholder: m.placeholder, category: m.category, value: m.value });
    }
  }
  return {
    format: "anonymo.keymap",
    version: 1,
    createdAt: new Date().toISOString(),
    subject: params.subject,
    source: { fileName: params.fileName },
    mapping: [...seen.values()],
  };
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[äàáâ]/g, "a")
      .replace(/[öòóô]/g, "o")
      .replace(/[üùúû]/g, "u")
      .replace(/[éèêë]/g, "e")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "dokument"
  );
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
