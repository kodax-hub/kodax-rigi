import type { Category, Match } from "./types";

export interface RawMatch {
  category: Category;
  value: string;
  start: number;
  end: number;
}

/** IBAN mod-97 check (ISO 13616). */
export function isValidIban(raw: string): boolean {
  const iban = raw.replace(/[\s.-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** Luhn check for credit card numbers. */
export function isValidLuhn(raw: string): boolean {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const TITLE = "(?:Herr|Frau|Hr\\.|Fr\\.|Dr\\.|Dr|Prof\\.|Prof|Herrn)";
const CAP = "[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?";

/** Common first names in DE/AT/CH – used to catch names without a salutation. */
const FIRST_NAMES = [
  "Alexander","Andrea","Andreas","Anna","Anne","Barbara","Beat","Bernd","Bettina","Bruno","Christian","Christina","Christoph","Claudia","Daniel","Daniela","David","Dieter","Dominik","Elena","Elisabeth","Emma","Erika","Fabian","Felix","Florian","Frank","Franz","Gabriela","Georg","Gerhard","Hans","Heidi","Heinz","Helena","Helmut","Ingrid","Jakob","Jan","Jasmin","Jens","Joachim","Johann","Johanna","Johannes","Jonas","Josef","Julia","Jürgen","Karin","Karl","Katharina","Kathrin","Klaus","Kurt","Laura","Lea","Lena","Leon","Lukas","Manfred","Manuela","Marc","Marco","Maria","Marie","Mario","Markus","Martin","Martina","Mathias","Matthias","Max","Maximilian","Melanie","Michael","Michaela","Mia","Monika","Nadine","Nicole","Niklaus","Nina","Noah","Olaf","Oliver","Patrick","Paul","Peter","Petra","Philipp","Rainer","Ralf","Renate","René","Robert","Roland","Roger","Rolf","Rudolf","Ruth","Sabine","Samuel","Sandra","Sara","Sarah","Sebastian","Silvia","Simon","Sonja","Stefan","Stefanie","Stephan","Susanne","Sven","Thomas","Thorsten","Tim","Tobias","Ueli","Ulrich","Ursula","Urs","Vanessa","Verena","Victor","Viktor","Vincent","Walter","Werner","Wolfgang","Yvonne",
];
const FIRST_NAME_SET = new Set(FIRST_NAMES.map((n) => n.toLowerCase()));

function pushIfNew(list: RawMatch[], m: RawMatch) {
  const trimmedEnd = m.value.replace(/\s+$/, "");
  const leading = m.value.length - m.value.replace(/^\s+/, "").length;
  const value = trimmedEnd.slice(leading);
  if (value.length === 0) return;
  list.push({ ...m, value, start: m.start + leading, end: m.start + leading + value.length });
}

function scan(
  text: string,
  category: Category,
  regex: RegExp,
  out: RawMatch[],
  validate?: (value: string) => boolean,
  groupIndex = 0,
) {
  const re = new RegExp(regex.source, regex.flags.includes("g") ? regex.flags : regex.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    const value = (groupIndex === 0 ? m[0] : (m[groupIndex] ?? m[0])) as string;
    const offset = groupIndex === 0 ? 0 : m[0].indexOf(value);
    if (validate && !validate(value)) continue;
    pushIfNew(out, {
      category,
      value,
      start: m.index + Math.max(offset, 0),
      end: m.index + Math.max(offset, 0) + value.length,
    });
  }
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectAll(
  text: string,
  enabled: Record<Category, boolean>,
  customTerms: string[],
): RawMatch[] {
  const out: RawMatch[] = [];

  if (enabled.email) {
    scan(text, "email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, out);
  }

  if (enabled.iban) {
    // Kandidaten grosszügig einsammeln und auf das längste gültige Ende zurückschneiden.
    const candidate = /\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{1,4}[ ]?){2,10}/g;
    let cm: RegExpExecArray | null;
    while ((cm = candidate.exec(text)) !== null) {
      let value = cm[0].replace(/\s+$/, "");
      while (value.length > 14 && !isValidIban(value)) {
        value = value.replace(/[\s]?[A-Z0-9]$/, "").replace(/\s+$/, "");
        if (!/[A-Z0-9]$/.test(value)) break;
      }
      if (value.length > 14 && isValidIban(value)) {
        pushIfNew(out, { category: "iban", value, start: cm.index, end: cm.index + value.length });
      }
    }
  }

  if (enabled.ssn) {
    // Swiss AHV (756.xxxx.xxxx.xx) and German Sozialversicherungsnummer
    scan(text, "ssn", /\b756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}\b/g, out);
    scan(text, "ssn", /\b\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}\b/g, out);
  }

  if (enabled.creditcard) {
    scan(text, "creditcard", /\b(?:\d[ -]?){12,18}\d\b/g, out, isValidLuhn);
  }

  if (enabled.phone) {
    scan(
      text,
      "phone",
      /(?<![\d\w])(?:\+\d{2}|00\d{2}|0)[\s/.-]?\d{2,4}(?:[\s/.-]\d{2,4}){2,4}(?![\d])/g,
      out,
      (v) => {
        const digits = v.replace(/\D/g, "").length;
        return digits >= 9 && digits <= 15;
      },
    );
  }

  if (enabled.birthdate) {
    scan(text, "birthdate", /\b\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}\b/g, out);
    scan(text, "birthdate", /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, out);
    scan(text, "birthdate", /\b\d{4}-\d{2}-\d{2}\b/g, out);
    scan(
      text,
      "birthdate",
      /\b\d{1,2}\.?\s(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s\d{4}\b/g,
      out,
    );
  }

  if (enabled.address) {
    scan(
      text,
      "address",
      new RegExp(
        `\\b${CAP}(?:er)?[- ]?(?:strasse|straße|str\\.|gasse|weg|platz|allee|ring|damm|ufer)\\s?\\d{1,4}\\s?[a-zA-Z]?\\b`,
        "gi",
      ),
      out,
    );
    scan(text, "address", new RegExp(`(?<![\\d.,:/-])\\b(?:CH-|DE-|AT-|A-)?\\d{4,5}\\s${CAP}\\b`, "g"), out);

    scan(text, "address", /\bPostfach\s\d{1,6}\b/gi, out);
  }

  if (enabled.name) {
    scan(text, "name", new RegExp(`\\b${TITLE}\\s(?:${CAP}\\s)?${CAP}\\b`, "g"), out);
    // First name from list followed by a capitalised surname
    const nameRe = new RegExp(`\\b(${CAP})\\s(${CAP})\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = nameRe.exec(text)) !== null) {
      if (FIRST_NAME_SET.has((m[1] ?? "").toLowerCase())) {
        pushIfNew(out, { category: "name", value: m[0], start: m.index, end: m.index + m[0].length });
      }
    }
    // Bare first names from the list
    const soloRe = new RegExp(`\\b(${CAP})\\b`, "g");
    while ((m = soloRe.exec(text)) !== null) {
      if (FIRST_NAME_SET.has((m[1] ?? "").toLowerCase())) {
        pushIfNew(out, { category: "name", value: m[0], start: m.index, end: m.index + m[0].length });
      }
    }
  }

  if (enabled.custom) {
    for (const term of customTerms) {
      const t = term.trim();
      if (t.length < 2) continue;
      scan(text, "custom", new RegExp(escapeRegExp(t), "gi"), out);
    }
  }

  return out;
}

const PRIORITY: Category[] = [
  "iban",
  "creditcard",
  "ssn",
  "email",
  "custom",
  "address",
  "phone",
  "name",
  "birthdate",
];

/** Removes overlaps, keeping the longest / highest-priority match. */
export function resolveOverlaps(matches: RawMatch[]): RawMatch[] {
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    const len = b.end - b.start - (a.end - a.start);
    if (len !== 0) return len;
    return PRIORITY.indexOf(a.category) - PRIORITY.indexOf(b.category);
  });
  const kept: RawMatch[] = [];
  for (const m of sorted) {
    const last = kept[kept.length - 1];
    if (last && m.start < last.end) {
      const better =
        m.end - m.start > last.end - last.start ||
        (m.end - m.start === last.end - last.start &&
          PRIORITY.indexOf(m.category) < PRIORITY.indexOf(last.category));
      if (better && m.start >= last.start) {
        kept[kept.length - 1] = m;
      }
      continue;
    }
    kept.push(m);
  }
  return kept;
}

export function buildMatches(raw: RawMatch[]): Match[] {
  const counters = new Map<Category, number>();
  const assigned = new Map<string, string>();
  const labels: Record<Category, string> = {
    name: "NAME",
    iban: "IBAN",
    address: "ADRESSE",
    email: "EMAIL",
    phone: "TELEFON",
    birthdate: "DATUM",
    ssn: "SV-NR",
    creditcard: "KARTE",
    custom: "BEGRIFF",
  };

  return raw.map((m, i) => {
    const key = `${m.category}:${m.value.replace(/\s+/g, " ").trim().toLowerCase()}`;
    let placeholder = assigned.get(key);
    if (!placeholder) {
      const next = (counters.get(m.category) ?? 0) + 1;
      counters.set(m.category, next);
      placeholder = `[${labels[m.category]} ${next}]`;
      assigned.set(key, placeholder);
    }
    return { ...m, id: `${m.category}-${m.start}-${i}`, placeholder };
  });
}

export function analyze(
  text: string,
  enabled: Record<Category, boolean>,
  customTerms: string[],
): Match[] {
  return buildMatches(resolveOverlaps(detectAll(text, enabled, customTerms)));
}

export function applyRedaction(text: string, matches: Match[], disabled: Set<string>): string {
  const active = matches.filter((m) => !disabled.has(m.id)).sort((a, b) => a.start - b.start);
  let result = "";
  let cursor = 0;
  for (const m of active) {
    if (m.start < cursor) continue;
    result += text.slice(cursor, m.start) + m.placeholder;
    cursor = m.end;
  }
  return result + text.slice(cursor);
}
