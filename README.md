# Secure Document Handler

Erstelle eine Desktop-App mit Electron/Tauri und React. Die App soll Dokumente (PDFs/Bilder) lokal per Drag & Drop annehmen. Nutze eine lokale JavaScript-Bibliothek wie pdf-parse für den Text-Extrakt oder integriere eine WASM-Version von Tesseract (tesseract.js) für lokales OCR direkt im Client. Verwende ein clientseitiges Regex- und Regelwerk zur Anonymisierung von Namen, IBANs und Adressen, damit alles zu 100 % offline im Client läuft.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d67e220c-5c40-4616-b706-03491af75515).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
