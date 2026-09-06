import { useRef, useState } from "react";
import { FileUp } from "lucide-react";

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
}

const ACCEPT = ".pdf,image/png,image/jpeg,image/webp";

export function Dropzone({ onFiles, busy }: Props) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files).filter(
          (f) => f.type === "application/pdf" || f.type.startsWith("image/"),
        );
        if (files.length) onFiles(files);
      }}
      onClick={() => !busy && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
        over
          ? "border-primary bg-primary/10"
          : "border-border bg-card/50 hover:border-primary/60 hover:bg-card"
      } ${busy ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <FileUp className="size-8 text-primary" aria-hidden />
      <p className="font-medium text-foreground">Dokumente hierher ziehen</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        PDF, PNG, JPG oder WEBP. Alles wird ausschliesslich auf diesem Gerät verarbeitet – keine
        Datei verlässt den Rechner.
      </p>
    </div>
  );
}
