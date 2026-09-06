// Alle Verarbeitung passiert im Browser/Renderer - keine Netzwerkaufrufe.

export interface ExtractProgress {
  stage: "pdf" | "ocr" | "done";
  message: string;
  progress: number; // 0..1
}

export type ProgressFn = (p: ExtractProgress) => void;

const TESS_BASE = "/tesseract";

async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
  return pdfjs;
}

async function ocrCanvases(
  canvases: HTMLCanvasElement[],
  onProgress: ProgressFn,
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["deu", "eng"], 1, {
    workerPath: `${TESS_BASE}/worker.min.js`,
    corePath: TESS_BASE,
    langPath: `${TESS_BASE}/tessdata`,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress({ stage: "ocr", message: "Texterkennung läuft…", progress: m.progress });
      }
    },
  });
  try {
    const parts: string[] = [];
    for (let i = 0; i < canvases.length; i++) {
      onProgress({
        stage: "ocr",
        message: `Texterkennung Seite ${i + 1} von ${canvases.length}…`,
        progress: i / canvases.length,
      });
      const canvas = canvases[i]!;
      const { data } = await worker.recognize(canvas);
      parts.push(data.text);
    }
    return parts.join("\n\n");
  } finally {
    await worker.terminate();
  }
}

async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export async function extractText(file: File, onProgress: ProgressFn): Promise<string> {
  if (file.type.startsWith("image/")) {
    const canvas = await imageToCanvas(file);
    const text = await ocrCanvases([canvas], onProgress);
    onProgress({ stage: "done", message: "Fertig", progress: 1 });
    return text;
  }

  const pdfjs = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const pageTexts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress({
      stage: "pdf",
      message: `Seite ${p} von ${doc.numPages} wird gelesen…`,
      progress: p / doc.numPages,
    });
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/[ \t]+/g, " ");
    pageTexts.push(text);
  }

  const joined = pageTexts.join("\n\n").trim();
  if (joined.replace(/\s/g, "").length > 40) {
    onProgress({ stage: "done", message: "Fertig", progress: 1 });
    return joined;
  }

  // Kein Textlayer -> OCR über gerenderte Seiten (alle Seiten, eine nach der anderen)
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["deu", "eng"], 1, {
    workerPath: `${TESS_BASE}/worker.min.js`,
    corePath: TESS_BASE,
    langPath: `${TESS_BASE}/tessdata`,
    gzip: true,
  });
  const parts: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress({
        stage: "ocr",
        message: `Texterkennung Seite ${p} von ${doc.numPages}…`,
        progress: (p - 1) / doc.numPages,
      });
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
      }).promise;
      const { data: res } = await worker.recognize(canvas);
      parts.push(res.text);
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await worker.terminate();
  }
  onProgress({ stage: "done", message: "Fertig", progress: 1 });
  return parts.join("\n\n");
}

