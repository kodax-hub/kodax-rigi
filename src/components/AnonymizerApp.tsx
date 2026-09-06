import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileJson, Info, KeyRound, Loader2, ShieldCheck, Trash2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

import kodaxIcon from "@/assets/kodax-white-icon.svg";
import { Dropzone } from "@/components/Dropzone";
import { CategoryControls } from "@/components/CategoryControls";
import { SubjectPanel } from "@/components/SubjectPanel";
import { OriginalPane, RedactedPane } from "@/components/TextPanes";
import { analyze, applyRedaction, buildMatches, detectAll, resolveOverlaps, type RawMatch } from "@/lib/redaction/detect";
import type { NerStatus } from "@/lib/ner/ner";
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
  const [nerRaw, setNerRaw] = useState<RawMatch[]>([]);
  const [nerStatus, setNerStatus] = useState<NerStatus>("idle");
  const [infoOpen, setInfoOpen] = useState(false);

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

  const matches = useMemo(() => {
    if (!doc) return [];
    if (nerRaw.length === 0) return analyze(doc.text, toggles, customTerms);
    const rules = detectAll(doc.text, toggles, customTerms);
    const ai = nerRaw.filter((m) => toggles[m.category]);
    return buildMatches(resolveOverlaps([...rules, ...ai]));
  }, [doc, toggles, customTerms, nerRaw]);

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
    setNerRaw([]);
    try {
      for (const file of files) {
        setProgress({ stage: "pdf", message: `${file.name} wird gelesen…`, progress: 0 });
        const text = await extractText(file, setProgress);
        texts.push(files.length > 1 ? `--- ${file.name} ---\n${text}` : text);
      }
      const fullText = texts.join("\n\n").trim();
      setDoc({
        fileName: files.map((f) => f.name).join(", "),
        text: fullText,
      });

      // KI-Erkennung im Anschluss – rein lokal, ohne Netzwerk.
      setProgress({
        stage: "ocr",
        message: "KI prüft den Text auf Namen, Firmen und Orte…",
        progress: 0.5,
      });
      const { detectEntities } = await import("@/lib/ner/ner");
      const entities = await detectEntities(fullText, setNerStatus);
      setNerRaw(entities);
    } catch (err) {
      console.error(err);
      toast.error("Datei konnte nicht gelesen werden.");
    } finally {
      setProgress(null);
    }
  }, []);

  const activeCount = matches.filter((m) => !disabled.has(m.id)).length;


  const exportBase = useMemo(() => {
    const name = subject.label.trim() || subject.uid || "dokument";
    return `${slugify(name)}-${subject.uid || "ohne-uid"}`;
  }, [subject]);

  const handleExportJson = useCallback(() => {
    if (!doc) return;
    downloadJson(
      buildAnonymizedExport({ subject, fileName: doc.fileName, redacted, matches, disabled }),
      `${exportBase}.json`,
    );
    toast.success("Anonymisierte JSON-Datei gespeichert");
  }, [doc, subject, redacted, matches, disabled, exportBase]);

  const handleExportKeyMap = useCallback(() => {
    if (!doc) return;
    downloadJson(
      buildKeyMapExport({ subject, fileName: doc.fileName, matches, disabled }),
      `${exportBase}-schluessel.json`,
    );
    toast.warning("Schlüsseldatei gespeichert – enthält Klartext, sicher aufbewahren");
  }, [doc, subject, matches, disabled, exportBase]);


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-marine-deep/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <img src={kodaxIcon} alt="Kodax Logo" className="h-8 w-auto" />
          <div className="flex-1">
            <h1 className="text-lg font-medium tracking-tight text-foreground">
              Kodax Secure AI <span className="text-gold">„Rigi“</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              (BERT-base multilingual NER · 110 Mio. Parameter · 8-bit quantisiert · 100 % offline)
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-sm border border-gold/40 px-3 py-1 font-mono text-xs text-gold">
            <WifiOff className="size-3.5" aria-hidden /> 100 % offline
          </span>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="inline-flex items-center justify-center rounded-full border border-border p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Informationen zur App und zum KI-Modell"
          >
            <Info className="size-4 pointer-events-none" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-6">
          <SubjectPanel
            subject={subject}
            onChange={setSubject}
            onRegenerate={() => setSubject((s) => ({ ...s, uid: generateUid() }))}
          />

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
                  {nerStatus === "ready" && nerRaw.length > 0 && " · inkl. KI-Erkennung"}
                  {nerStatus === "error" && " · KI nicht verfügbar"}
                </p>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <FileJson className="size-4" aria-hidden /> JSON exportieren
                </button>
                <button
                  type="button"
                  onClick={handleExportKeyMap}
                  className="inline-flex items-center gap-2 rounded-lg border border-accent/50 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  <KeyRound className="size-4" aria-hidden /> Schlüsseldatei
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(redacted);
                    toast.success("Anonymisierter Text kopiert");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
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

      {infoOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-20 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Informationen"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoOpen(false);
          }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={kodaxIcon} alt="Kodax Logo" className="h-8 w-auto" />
                <div>
                  <h2 className="text-lg font-medium text-foreground">
                    Kodax Secure AI <span className="text-gold">„Rigi“</span>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Lokale PDF- und Bild-Anonymisierung
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInfoOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Schliessen"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="mt-6 space-y-5 text-sm text-foreground">
              <section>
                <h3 className="mb-2 flex items-center gap-2 font-mono font-semibold text-primary">
                  <ShieldCheck className="size-4" aria-hidden />
                  Verwendetes KI-Modell
                </h3>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Davlan/bert-base-multilingual-cased-ner-hrl</strong>{" "}
                  – ein mehrsprachiges BERT-Modell von Hugging Face für Named Entity Recognition
                  (NER), trainiert auf Personen, Organisationen, Orten und Daten.
                </p>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Architektur</p>
                  <p className="font-medium">BERT base</p>
                  <p className="text-xs text-muted-foreground">12 Layer · 768 Hidden · 12 Heads</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Parameter</p>
                  <p className="font-medium">ca. 110 Mio.</p>
                  <p className="text-xs text-muted-foreground">Vokabular: 119.547 Tokens</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Lokale Grösse</p>
                  <p className="font-medium">ca. 170 MB</p>
                  <p className="text-xs text-muted-foreground">8-bit quantisiert (q8 ONNX)</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Erkennt</p>
                  <p className="font-medium">PER, ORG, LOC, DATE</p>
                  <p className="text-xs text-muted-foreground">Personen, Firmen, Orte, Daten</p>
                </div>
              </section>

              <section>
                <h3 className="mb-2 font-mono font-semibold text-primary">100 % offline</h3>
                <p className="text-muted-foreground">
                  Alle Berechnungen laufen lokal in deinem Browser oder in der Desktop-App. Weder
                  das Dokument noch das KI-Modell laden etwas aus der Cloud hoch oder aus dem
                  Internet herunter.
                </p>
              </section>

              <section>
                <h3 className="mb-2 font-mono font-semibold text-primary">Wichtiger Hinweis</h3>
                <p className="text-muted-foreground">
                  Keine automatische Erkennung ist perfekt. Prüfe das Ergebnis vor dem Weitergeben
                  und nutze die eigene Begriffsliste für alles, was zusätzlich verschwinden soll.
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
