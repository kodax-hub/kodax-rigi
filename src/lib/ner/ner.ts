import type { Category } from "@/lib/redaction/types";
import type { RawMatch } from "@/lib/redaction/detect";

/**
 * Lokale KI-Erkennung (Named Entity Recognition) mit einem mehrsprachigen
 * BERT-Modell. Läuft vollständig im Browser / in Electron, ohne Netzwerk.
 * Das Modell liegt unter /bert-ner (public), alles bleibt offline.
 */

type NerLabel = "PER" | "ORG" | "LOC" | "DATE";

const LABEL_TO_CATEGORY: Record<NerLabel, Category> = {
  PER: "name",
  ORG: "company",
  LOC: "address",
  DATE: "birthdate",
};

const MIN_SCORE = 0.55;
const MIN_LENGTH = 3;
/** Zeichen pro Chunk – mehrsprachiges BERT verträgt 512 Token. */
const CHUNK_SIZE = 1500;

interface NerToken {
  entity: string;
  word: string;
  score: number;
  start?: number | null;
  end?: number | null;
}

type NerPipeline = (text: string) => Promise<NerToken[]>;

let pipelinePromise: Promise<NerPipeline> | null = null;

async function getPipeline(): Promise<NerPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");
      // Strikt offline: nur lokale Dateien, kein Fernzugriff.
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = "/";
      env.useBrowserCache = true;
      const pipe = await pipeline("token-classification", "bert-ner", {
        dtype: "q8",
      });
      return pipe as unknown as NerPipeline;
    })();
    pipelinePromise.catch(() => {
      pipelinePromise = null;
    });
  }
  return pipelinePromise;
}

/** Zerlegt den Text in Chunks an Absatz-/Wortgrenzen und merkt die Offsets. */
function chunkText(text: string): { chunk: string; offset: number }[] {
  const chunks: { chunk: string; offset: number }[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) {
      const paraBreak = text.lastIndexOf("\n", end);
      const spaceBreak = text.lastIndexOf(" ", end);
      if (paraBreak > start + CHUNK_SIZE / 2) end = paraBreak + 1;
      else if (spaceBreak > start + CHUNK_SIZE / 2) end = spaceBreak + 1;
    }
    chunks.push({ chunk: text.slice(start, end), offset: start });
    start = end;
  }
  return chunks;
}

/** Fasst B-/I-Token zu Entitäten zusammen und bestimmt ihre Textposition. */
function tokensToMatches(tokens: NerToken[], chunk: string, offset: number, out: RawMatch[]) {
  let current: { label: NerLabel; words: string[]; scores: number[] } | null = null;
  let cursor = 0;

  const flush = () => {
    if (!current) return;
    const value = current.words
      .join(" ")
      .replace(/ ##/g, "")
      .replace(/\s+([.,;:!?%)\]])/g, "$1")
      .replace(/([(\[])\s+/g, "$1")
      .trim();
    const avg = current.scores.reduce((a, b) => a + b, 0) / current.scores.length;
    if (value.length >= MIN_LENGTH && avg >= MIN_SCORE) {
      const idx = chunk.indexOf(value, cursor);
      if (idx >= 0) {
        out.push({
          category: LABEL_TO_CATEGORY[current.label],
          value,
          start: offset + idx,
          end: offset + idx + value.length,
        });
        cursor = idx + value.length;
      }
    }
    current = null;
  };

  for (const tok of tokens) {
    const [prefix, label] = tok.entity.split("-") as [string, NerLabel | undefined];
    if (prefix === "B" && label && label in LABEL_TO_CATEGORY) {
      flush();
      current = { label, words: [tok.word], scores: [tok.score] };
    } else if (prefix === "I" && current && label === current.label) {
      current.words.push(tok.word);
      current.scores.push(tok.score);
    } else {
      flush();
    }
  }
  flush();
}

export type NerStatus = "idle" | "loading" | "ready" | "error";

/**
 * Erkennt Personen, Organisationen, Orte und Daten per KI.
 * Gibt RawMatches zurück, die mit den Regex-Fundstellen verschmolzen werden.
 */
export async function detectEntities(
  text: string,
  onStatus?: (status: NerStatus) => void,
): Promise<RawMatch[]> {
  const out: RawMatch[] = [];
  try {
    onStatus?.("loading");
    const pipe = await getPipeline();
    const chunks = chunkText(text);
    for (const { chunk, offset } of chunks) {
      if (!chunk.trim()) continue;
      const tokens = await pipe(chunk);
      tokensToMatches(tokens, chunk, offset, out);
    }
    onStatus?.("ready");
  } catch (err) {
    console.error("KI-Erkennung fehlgeschlagen:", err);
    onStatus?.("error");
  }
  // Doppelte Fundstellen (gleiche Position) entfernen
  const seen = new Set<string>();
  return out.filter((m) => {
    const key = `${m.start}:${m.end}:${m.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
