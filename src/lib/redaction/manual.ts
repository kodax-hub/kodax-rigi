import { escapeRegExp, type RawMatch } from "./detect";
import type { Category } from "./types";

export interface ManualTerm {
  id: string;
  value: string;
  category: Category;
}

/**
 * Findet alle Vorkommen der manuell zugewiesenen Begriffe im Text.
 * Gleiche Begriffe erhalten dadurch später automatisch denselben Platzhalter.
 */
export function detectManual(text: string, terms: ManualTerm[]): RawMatch[] {
  const out: RawMatch[] = [];
  for (const term of terms) {
    const value = term.value.trim();
    if (value.length < 2) continue;
    // Whitespace im Begriff darf im Text auch ein Zeilenumbruch sein.
    const pattern = escapeRegExp(value).replace(/\\?\s+/g, "\\s+");
    const re = new RegExp(pattern, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      out.push({ category: term.category, value: m[0], start: m.index, end: m.index + m[0].length });
    }
  }
  return out;
}

/** Entfernt automatische Treffer, die sich mit manuellen Zuweisungen überschneiden. */
export function dropOverlapping(auto: RawMatch[], manual: RawMatch[]): RawMatch[] {
  if (manual.length === 0) return auto;
  return auto.filter((a) => !manual.some((m) => a.start < m.end && m.start < a.end));
}
