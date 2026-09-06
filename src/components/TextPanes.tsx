import type { Match } from "@/lib/redaction/types";

const COLORS: Record<string, string> = {
  name: "bg-[oklch(0.55_0.14_190)]/30 text-foreground",
  iban: "bg-[oklch(0.6_0.16_55)]/30 text-foreground",
  address: "bg-[oklch(0.55_0.13_300)]/30 text-foreground",
  email: "bg-[oklch(0.6_0.14_150)]/30 text-foreground",
  phone: "bg-[oklch(0.6_0.14_100)]/30 text-foreground",
  birthdate: "bg-[oklch(0.6_0.12_20)]/30 text-foreground",
  ssn: "bg-[oklch(0.55_0.15_260)]/30 text-foreground",
  creditcard: "bg-[oklch(0.6_0.16_10)]/30 text-foreground",
  custom: "bg-[oklch(0.65_0.16_80)]/30 text-foreground",
};

interface Props {
  text: string;
  matches: Match[];
  disabled: Set<string>;
  onToggleMatch: (id: string) => void;
}

export function OriginalPane({ text, matches, disabled, onToggleMatch }: Props) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  for (const m of sorted) {
    if (m.start < cursor) continue;
    parts.push(text.slice(cursor, m.start));
    const off = disabled.has(m.id);
    parts.push(
      <button
        key={m.id}
        type="button"
        onClick={() => onToggleMatch(m.id)}
        title={off ? "Wieder anonymisieren" : "Diese Stelle sichtbar lassen"}
        className={`rounded px-0.5 transition-colors ${
          off ? "line-through opacity-50 bg-secondary" : COLORS[m.category]
        }`}
      >
        {text.slice(m.start, m.end)}
      </button>,
    );
    cursor = m.end;
  }
  parts.push(text.slice(cursor));

  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-foreground">
      {parts}
    </pre>
  );
}

export function RedactedPane({ text }: { text: string }) {
  const parts = text.split(/(\[[A-ZÄÖÜ-]+ \d+\])/g);
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-foreground">
      {parts.map((p, i) =>
        /^\[[A-ZÄÖÜ-]+ \d+\]$/.test(p) ? (
          <span key={i} className="rounded bg-primary/20 px-1 font-semibold text-primary">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </pre>
  );
}
