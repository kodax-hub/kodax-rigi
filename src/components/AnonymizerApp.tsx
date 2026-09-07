import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileJson, Info, KeyRound, Loader2, MonitorDown, ShieldCheck, Trash2, WifiOff, X } from "lucide-react";
import { toast } from "sonner";

import kodaxIcon from "@/assets/kodax-white-icon.svg";
import { Dropzone } from "@/components/Dropzone";
import { CategoryControls } from "@/components/CategoryControls";
import { SubjectPanel } from "@/components/SubjectPanel";
import { OriginalPane, RedactedPane, type SelectionInfo } from "@/components/TextPanes";
import { detectManual, dropOverlapping, type ManualTerm } from "@/lib/redaction/manual";
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
import { CATEGORIES, DEFAULT_TOGGLES, type Category, type CategoryToggles } from "@/lib/redaction/types";
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
  const [infoTab, setInfoTab] = useState<"modell" | "install">("modell");
  const [manualTerms, setManualTerms] = useState<ManualTerm[]>([]);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

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
    const manual = detectManual(doc.text, manualTerms);
    if (nerRaw.length === 0 && manual.length === 0) return analyze(doc.text, toggles, customTerms);
    const rules = detectAll(doc.text, toggles, customTerms);
    const ai = nerRaw.filter((m) => toggles[m.category]);
    const auto = dropOverlapping([...rules, ...ai], manual);
    return buildMatches(resolveOverlaps([...manual, ...auto]));
  }, [doc, toggles, customTerms, nerRaw, manualTerms]);

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
    setManualTerms([]);
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

  const assignSelection = useCallback(
    (category: Category) => {
      if (!selection) return;
      const value = selection.value;
      setManualTerms((prev) => {
        if (prev.some((t) => t.value.toLowerCase() === value.toLowerCase())) {
          return prev.map((t) =>
            t.value.toLowerCase() === value.toLowerCase() ? { ...t, category } : t,
          );
        }
        return [...prev, { id: `${Date.now()}-${value}`, value, category }];
      });
      setToggles((t) => (t[category] ? t : { ...t, [category]: true }));
      setSelection(null);
      window.getSelection()?.removeAllRanges();
      toast.success(`„${value}" als ${CATEGORIES.find((c) => c.id === category)?.label} markiert`);
    },
    [selection],
  );


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
            <p className="text-xs text-muted-foreground/60">
              (BERT-base multilingual NER · 110 Mio. Parameter · 8-bit quantisiert)
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-sm border border-gold/40 px-3 py-1 font-mono text-xs text-gold">
            <ShieldCheck className="size-3.5" aria-hidden /> Verarbeitung lokal
          </span>
          <button
            type="button"
            onClick={() => { setInfoTab("install"); setInfoOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="Installation: App auf diesem Gerät einrichten"
          >
            <MonitorDown className="size-4 pointer-events-none" aria-hidden />
            Installieren
          </button>
          <button
            type="button"
            onClick={() => { setInfoTab("modell"); setInfoOpen(true); }}
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

          {manualTerms.length > 0 && (
            <div>
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Manuell zugeordnet
              </h2>
              <ul className="mt-3 space-y-1">
                {manualTerms.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-sm border border-border px-2 py-1.5 text-xs"
                  >
                    <span className="flex-1 truncate text-foreground" title={t.value}>
                      {t.value}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      {CATEGORIES.find((c) => c.id === t.category)?.placeholder}
                    </span>
                    <button
                      type="button"
                      aria-label={`Zuordnung für ${t.value} entfernen`}
                      onClick={() => setManualTerms((prev) => prev.filter((x) => x.id !== t.id))}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
                    setManualTerms([]);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary"
                >
                  <Trash2 className="size-4" aria-hidden /> Leeren
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border border-border bg-card">
                  <h2 className="border-b border-border px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Original – markieren zum Zuordnen, Fundstelle anklicken zum Abwählen
                  </h2>
                  <div className="max-h-[60vh] overflow-auto p-4">
                    <OriginalPane
                      text={doc.text}
                      matches={matches}
                      disabled={disabled}
                      onSelect={setSelection}
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

      {selection && doc && (
        <div
          className="fixed z-50 -translate-x-1/2 rounded-lg border border-border bg-card p-2 shadow-2xl"
          style={{ left: selection.x, top: selection.y + 8 }}
        >
          <p className="max-w-[260px] truncate px-1 pb-2 font-mono text-[11px] text-muted-foreground">
            „{selection.value}" ist …
          </p>
          <div className="flex max-w-[280px] flex-wrap gap-1">
            {CATEGORIES.filter((c) => c.id !== "custom").map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => assignSelection(c.id)}
                className="rounded-sm border border-border px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary"
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setSelection(null)}
              className="rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

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
          <div className="max-h-[calc(100vh-6rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
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

            <div className="mt-5 flex gap-2" role="tablist" aria-label="Informationsbereiche">
              <button
                type="button"
                role="tab"
                aria-selected={infoTab === "modell"}
                onClick={() => setInfoTab("modell")}
                className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs font-semibold transition-colors ${
                  infoTab === "modell"
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                Modell &amp; Datenschutz
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={infoTab === "install"}
                onClick={() => setInfoTab("install")}
                className={`flex-1 rounded-lg border px-3 py-2 font-mono text-xs font-semibold transition-colors ${
                  infoTab === "install"
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                Installation
              </button>
            </div>

            {infoTab === "modell" && (
            <div className="mt-6 space-y-5 text-sm text-foreground">
              <section className="rounded-lg border border-gold/30 bg-gold/5 p-4">
                <h3 className="mb-2 flex items-center gap-2 font-mono font-semibold text-gold">
                  <WifiOff className="size-4" aria-hidden />
                  Kein LLM – nur lokale Erkennung
                </h3>
                <p className="text-muted-foreground">
                  Diese App enthält <strong className="text-foreground">kein grosses Sprachmodell (LLM)</strong>.
                  Das lokale Modell erkennt lediglich Wörter als Personen, Firmen, Orte oder Daten
                  und ersetzt sie. Es versteht keine Zusammenhänge, beantwortet keine Fragen und
                  generiert keinen Text.
                </p>
                <p className="mt-2 text-muted-foreground">
                  Der geplante Workflow: Dokument hier anonymisieren, exportieren und den
                  bereinigten Text anschliessend in eine starke externe KI hochladen.
                </p>
              </section>

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
                <h3 className="mb-2 font-mono font-semibold text-primary">Lokal und geschützt</h3>
                <p className="text-muted-foreground">
                  Die Dokumente und deren Inhalte werden nicht an einen Server übermittelt. Die
                  Erkennung und Anonymisierung laufen direkt auf deinem Gerät. Die Desktop-App
                  funktioniert vollständig offline; die Web-Version benötigt zum Öffnen und zum
                  Laden der lokalen Werkzeuge eine Internetverbindung.
                </p>
              </section>

              <section className="border-t border-border pt-5">
                <h3 className="mb-2 font-mono font-semibold text-primary">Wichtiger Hinweis</h3>
                <p className="text-muted-foreground">
                  Keine automatische Erkennung ist perfekt. Prüfe das Ergebnis vor dem Weitergeben
                  und nutze die eigene Begriffsliste für alles, was zusätzlich verschwinden soll.
                </p>
              </section>
            </div>
            )}

            {infoTab === "install" && (
            <div className="mt-6 space-y-6 text-sm text-foreground">
              <section className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-1 flex items-center gap-2 font-mono font-semibold text-primary">
                  <MonitorDown className="size-4" aria-hidden />
                  Variante 1: Web-App (empfohlen)
                </h3>
                <p className="text-muted-foreground">
                  Kein Download nötig. Die App wird mit Kodax-Symbol installiert und öffnet sich
                  danach in einem eigenen Fenster. Zum ersten Öffnen und Laden der Werkzeuge ist
                  eine Internetverbindung nötig.
                </p>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
                  <li>Öffne <strong className="text-foreground">rigi.kodax.cloud</strong> im Browser.</li>
                  <li>
                    Installieren:
                    <ul className="mt-1.5 list-disc space-y-1 pl-5">
                      <li><strong className="text-foreground">Windows (Chrome / Edge):</strong> Installationssymbol in der Adresszeile klicken oder im Menü „App installieren“ wählen.</li>
                      <li><strong className="text-foreground">Mac (Safari):</strong> „Ablage“ → „Zum Dock hinzufügen“.</li>
                      <li><strong className="text-foreground">iPhone / iPad:</strong> In Safari „Teilen“ → „Zum Home-Bildschirm“.</li>
                      <li><strong className="text-foreground">Android:</strong> Im Browser-Menü „App installieren“ wählen.</li>
                    </ul>
                  </li>
                  <li>Die App erscheint mit dem Kodax-Symbol in deinen Programmen / auf dem Home-Bildschirm.</li>
                </ol>
              </section>

              <section className="rounded-lg border border-border bg-background p-4">
                <h3 className="mb-1 font-mono font-semibold text-primary">
                  Variante 2: Desktop-App (100 % offline)
                </h3>
                <p className="text-muted-foreground">
                  Läuft garantiert ohne Internet. Lade das passende Paket für dein System aus dem
                  bereitgestellten Download-Link (GitHub Release) herunter.
                </p>

                <p className="mt-3 font-mono text-xs font-semibold text-foreground">Windows</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>ZIP-Datei „…Windows.zip“ herunterladen und entpacken.</li>
                  <li>Im entpackten Ordner „KodaxSecureAIRigi.exe“ doppelklicken.</li>
                  <li>Falls Windows eine blaue Schutzmeldung zeigt: „Weitere Informationen“ → „Trotzdem ausführen“.</li>
                </ol>

                <p className="mt-4 font-mono text-xs font-semibold text-foreground">Mac (Apple Silicon / Intel)</p>
                <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Passende ZIP-Datei herunterladen und entpacken.</li>
                  <li>Die App in den Ordner „Programme“ (Applications) bewegen.</li>
                  <li>
                    Beim ersten Start meldet macOS eventuell „App ist beschädigt“. Das ist der
                    Standard-Schutz für unsignierte Apps. Einmalig beheben: „Terminal“ öffnen und
                    eingeben:
                    <code className="mt-1.5 block rounded border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-gold">
                      xattr -cr /Applications/KodaxSecureAIRigi.app
                    </code>
                  </li>
                  <li>Danach startet die App normal per Doppelklick.</li>
                </ol>
              </section>

              <section>
                <h3 className="mb-2 font-mono font-semibold text-primary">Danach: Dokument anonymisieren</h3>
                <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
                  <li>PDF oder Bild in die App ziehen.</li>
                  <li>Erkannte persönliche Daten prüfen, Fundstellen bei Bedarf an-/abwählen.</li>
                  <li>Bereinigten Text kopieren oder als Datei speichern.</li>
                  <li>Den anonymisierten Text in deine starke KI hochladen.</li>
                </ol>
              </section>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
