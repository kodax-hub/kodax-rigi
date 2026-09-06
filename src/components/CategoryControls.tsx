import type { Category, CategoryToggles } from "@/lib/redaction/types";
import { CATEGORIES } from "@/lib/redaction/types";

interface Props {
  toggles: CategoryToggles;
  counts: Record<string, number>;
  onToggle: (c: Category) => void;
  customTerms: string;
  onCustomTerms: (v: string) => void;
}

export function CategoryControls({ toggles, counts, onToggle, customTerms, onCustomTerms }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Erkennung
        </h2>
        <ul className="mt-3 space-y-1">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary">
                <input
                  type="checkbox"
                  checked={toggles[c.id]}
                  onChange={() => onToggle(c.id)}
                  className="size-4 accent-[var(--color-primary)]"
                />
                <span className="flex-1">
                  <span className="block text-sm text-foreground">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">{c.description}</span>
                </span>
                {counts[c.id] ? (
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">
                    {counts[c.id]}
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label
          htmlFor="custom-terms"
          className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground"
        >
          Eigene Begriffe
        </label>
        <textarea
          id="custom-terms"
          value={customTerms}
          onChange={(e) => onCustomTerms(e.target.value)}
          rows={4}
          placeholder="Ein Begriff pro Zeile, z. B. Firmenname"
          className="mt-2 w-full resize-y rounded-lg border border-border bg-input px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">Wird auf diesem Gerät gespeichert.</p>
      </div>
    </div>
  );
}
