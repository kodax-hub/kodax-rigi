import { createFileRoute } from "@tanstack/react-router";
import { AnonymizerApp } from "@/components/AnonymizerApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kodax Secure AI „Rigi“ – Dokumente offline anonymisieren" },
      {
        name: "description",
        content:
          "Kodax-Desktop-App, die PDFs und Bilder per Drag & Drop einliest, Text lokal erkennt und Namen, IBANs sowie Adressen zu 100 % offline anonymisiert.",
      },
      { property: "og:title", content: "Kodax Secure AI „Rigi“ – Dokumente offline anonymisieren" },
      {
        property: "og:description",
        content:
          "PDFs und Bilder lokal einlesen, personenbezogene Daten automatisch ersetzen – ohne Upload, ohne Cloud.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#18283e" },
    ],
    links: [
      { rel: "canonical", href: "https://rigi.kodax.cloud/" },
    ],
  }),
  component: AnonymizerApp,
});
