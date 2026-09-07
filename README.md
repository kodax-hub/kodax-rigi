# Kodax Secure AI „Rigi"

Offline-Desktop-App zur Anonymisierung von Dokumenten.

PDFs und Bilder werden lokal in Text umgewandelt, persönliche Daten (Namen, Adressen,
E-Mail-Adressen, Telefonnummern, IBANs, Geburtsdaten u. a.) werden erkannt und ersetzt.
Die anonymisierte Fassung kann anschliessend gefahrlos an eine externe KI übergeben werden.

Die App arbeitet vollständig offline – es werden keine Daten übertragen.

## Entwicklung

Voraussetzung: Node.js und npm.

```sh
npm i
npm run dev
```

## Desktop-Pakete bauen

```sh
npm run build
npx vite build --config electron/vite.electron.config.ts
```

## Verwendete Technik

- TanStack Start, React, TypeScript, Tailwind CSS
- Electron für die Desktop-Pakete (Windows, macOS)
- Lokale Texterkennung (OCR) und lokales Erkennungsmodell – ohne Netzwerkzugriff

© Kodax
