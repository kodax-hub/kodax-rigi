import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileJson, KeyRound, Loader2, ShieldCheck, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Dropzone } from "@/components/Dropzone";
import { CategoryControls } from "@/components/CategoryControls";
import { SubjectPanel } from "@/components/SubjectPanel";
import { OriginalPane, RedactedPane } from "@/components/TextPanes";
import { analyze, applyRedaction } from "@/lib/redaction/detect";
import {
  buildAnonymizedExport,
  buildKeyMapExport,
  downloadJson,
  generateUid,
  slugify,
  type Subject,
} from "@/lib/redaction/export";
import { DEFAULT_TOGGLES, type Category, type CategoryToggles } from "@/lib/redaction/types";
import type { ExtractProgress } from "@/lib/extract/extract";

const STORAGE_KEY = "anonymo.settings.v1";

interface DocState {
  fileName: string;
  text: string;
}

export function AnonymizerApp() {
  const [toggles, setToggles] = useState<CategoryToggles>(DEFAULT_TOGGLES);
  const [customTermsRaw, setCustomTermsRaw] = useState("");
  const [subject, setSubject] = useState<Subject>({ uid: "", label: "" });
  const [doc, setDoc] = useState<DocState | null>(null);
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const loadedSettings = useRef(false);

  useEffect(() => {
    setSubject((s) => (s.uid ? s : { ...s, uid: generateUid() }));
  }, []);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { toggles?: CategoryToggles; customTerms?: string };
        if (parsed.toggles) setToggles({ ...DEFAULT_TOGGLES, ...parsed.toggles });
        if (typeof parsed.customTerms === "string") setCustomTermsRaw(parsed.customTerms);
      }
    } catch {
      /* ignore */
    }
    loadedSettings.current = true;
  }, []);

  useEffect(() => {
    if (!loadedSettings.current) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ toggles, customTerms: customTermsRaw }));
  }, [toggles, customTermsRaw]);

  const customTerms = useMemo(
    () => customTermsRaw.split("\n").map((t) => t.trim()).filter(Boolean),
    [customTermsRaw],
  );

  const matches = useMemo(
    () => (doc ? analyze(doc.text, toggles, customTerms) : []),
    [doc, toggles, customTerms],
  );

  const redacted = useMemo(
    () => (doc ? applyRedaction(doc.text, matches, disabled) : ""),
    [doc, matches, disabled],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of matches) c[m.category] = (c[m.category] ?? 0) + 1;
    return c;
  }, [matches]);

  const handleFiles = useCallback(async (files: File[]) => {
    const { extractText } = await import("@/lib/extract/extract");
    const texts: string[] = [];
    setDisabled(new Set());
    try {
      for (const file of files) {
        setProgress({ stage: "pdf", message: `${file.name} wird gelesen…`, progress: 0 });
        const text = await extractText(file, setProgress);
        texts.push(files.length > 1 ? `--- ${file.name} ---\n${text}` : text);
      }
      setDoc({
        fileName: files.map((f) => f.name).join(", "),
        text: texts.join("\n\n").trim(),
      });
    } catch (err) {
      console.error(err);
      toast.error("Datei konnte nicht gelesen werden.");
    } finally {
      setProgress(null);
    }
  }, []);

  const activeCount = matches.filter((m) => !disabled.has(m.id)).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <ShieldCheck className="size-6 text-primary" aria-hidden />
          <div className="flex-1">
            <h1 className="font-mono text-lg font-semibold tracking-tight text-foreground">
              Anonymo
            </h1>
            <p className="text-xs text-muted-foreground">
              Dokumente lokal einlesen und personenbezogene Daten ersetzen
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground">
            <WifiOff className="size-3.5" aria-hidden /> 100 % offline
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-6">
          <CategoryControls
            toggles={toggles}
            counts={counts}
            onToggle={(c: Category) => setToggles((t) => ({ ...t, [c]: !t[c] }))}
            customTerms={customTermsRaw}
            onCustomTerms={setCustomTermsRaw}
          />
        </aside>

        <section className="space-y-6">
          <Dropzone onFiles={handleFiles} busy={progress !== null} />

          {progress && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 text-sm text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
                {progress.message}
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(progress.progress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {doc && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 truncate font-mono text-xs text-muted-foreground">
                  {doc.fileName} · {activeCount} von {matches.length} Fundstellen ersetzt
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(redacted);
                    toast.success("Anonymisierter Text kopiert");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Copy className="size-4" aria-hidden /> Kopieren
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([redacted], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "anonymisiert.txt";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <Download className="size-4" aria-hidden /> Als .txt speichern
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDoc(null);
                    setDisabled(new Set());
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <Trash2 className="size-4" aria-hidden /> Leeren
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-border bg-card">
                  <h2 className="border-b border-border px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Original – Fundstelle anklicken zum Abwählen
                  </h2>
                  <div className="max-h-[60vh] overflow-auto p-4">
                    <OriginalPane
                      text={doc.text}
                      matches={matches}
                      disabled={disabled}
                      onToggleMatch={(id) =>
                        setDisabled((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        })
                      }
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-primary/40 bg-card">
                  <h2 className="border-b border-border px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">
                    Anonymisiert
                  </h2>
                  <div className="max-h-[60vh] overflow-auto p-4">
                    <RedactedPane text={redacted} />
                  </div>
                </div>
              </div>
            </>
          )}

          {!doc && !progress && (
            <p className="text-sm text-muted-foreground">
              Die automatische Erkennung ist nie perfekt – prüfe das Ergebnis vor dem Weitergeben
              und nutze die eigene Begriffsliste für alles, was zusätzlich verschwinden soll.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
