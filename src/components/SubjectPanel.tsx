import { RefreshCw, UserSquare } from "lucide-react";
import type { Subject } from "@/lib/redaction/export";

interface Props {
  subject: Subject;
  onChange: (subject: Subject) => void;
  onRegenerate: () => void;
}

export function SubjectPanel({ subject, onChange, onRegenerate }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <UserSquare className="size-4" aria-hidden /> Mandat / Person
      </h2>

      <label className="mt-3 block text-xs text-muted-foreground" htmlFor="subject-label">
        Bezeichnung
      </label>
      <input
        id="subject-label"
        value={subject.label}
        onChange={(e) => onChange({ ...subject, label: e.target.value })}
        placeholder="z. B. Mandat Müller 2026"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />

      <label className="mt-3 block text-xs text-muted-foreground" htmlFor="subject-uid">
        Kennung (UID)
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="subject-uid"
          value={subject.uid}
          onChange={(e) => onChange({ ...subject, uid: e.target.value.toUpperCase() })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-primary outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={onRegenerate}
          title="Neue Kennung erzeugen"
          className="inline-flex items-center rounded-lg border border-border px-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <RefreshCw className="size-4" aria-hidden />
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Die Kennung ersetzt den echten Namen in allen Exporten. Nur die separate Schlüsseldatei
        verbindet Kennung und Klartext – bewahre sie getrennt auf.
      </p>
    </div>
  );
}
