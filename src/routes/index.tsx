import { createFileRoute } from "@tanstack/react-router";
import { AnonymizerApp } from "@/components/AnonymizerApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Anonymo – Dokumente offline anonymisieren" },
      {
        name: "description",
        content:
          "Desktop-App, die PDFs und Bilder per Drag & Drop einliest, Text lokal erkennt und Namen, IBANs sowie Adressen zu 100 % offline anonymisiert.",
      },
      { property: "og:title", content: "Anonymo – Dokumente offline anonymisieren" },
      {
        property: "og:description",
        content:
          "PDFs und Bilder lokal einlesen, personenbezogene Daten automatisch ersetzen – ohne Upload, ohne Cloud.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnonymizerApp,
});
