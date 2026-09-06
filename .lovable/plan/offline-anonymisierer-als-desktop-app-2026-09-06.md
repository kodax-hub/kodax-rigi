# Offline-Anonymisierer als Desktop-App

Eine Desktop-App (Electron + React), die PDFs und Bilder per Drag & Drop annimmt, den Text lokal ausliest und persönliche Daten automatisch unkenntlich macht. Alles läuft zu 100 % auf dem Rechner – keine Internetverbindung, kein Upload.

## Ablauf für Nutzer

1. Datei(en) ins Fenster ziehen (PDF, PNG, JPG) oder über Dateiauswahl öffnen.
2. Die App liest den Text: bei PDFs direkt, bei Bildern (und PDFs ohne Textebene) über eine eingebaute Texterkennung mit Fortschrittsanzeige.
3. Erkannte persönliche Daten werden ersetzt, z. B. `[NAME 1]`, `[IBAN 1]`, `[ADRESSE 1]`.
4. Ergebnis erscheint nebeneinander: Original links, anonymisierte Fassung rechts, gefundene Stellen farbig markiert.
5. Nutzer kann einzelne Fundstellen an-/abwählen und den bereinigten Text kopieren oder als `.txt` speichern.

## Erkennung

- Namen (Vor-/Nachname, Anreden wie Herr/Frau/Dr., Namenslisten für DE/CH)
- IBANs (mit Prüfziffernkontrolle, damit keine falschen Treffer)
- Adressen (Straße + Hausnummer, PLZ + Ort für DE/AT/CH)
- E-Mail-Adressen, Telefonnummern
- Geburtsdaten
- AHV-/Sozialversicherungsnummern
- Kreditkartennummern (mit Luhn-Prüfung)
- Eigene Begriffsliste: Nutzer pflegt eigene Wörter (z. B. Firmennamen), die immer ersetzt werden; wird lokal gespeichert und bleibt nach Neustart erhalten.

Jede Kategorie lässt sich einzeln ein- und ausschalten. Gleiche Werte bekommen konsistent dasselbe Kürzel.

## Technische Umsetzung

- TanStack Start/React-Oberfläche, in Electron verpackt (`electron/main.cjs`, `@electron/packager`), `base: './'` in der Vite-Konfiguration.
- PDF-Textebene: `pdfjs-dist` im Browser-Kontext; OCR-Fallback: `tesseract.js` mit lokal gebündelten Worker-, Core- und Sprachdateien (deu + eng) unter `public/`, damit keine CDN-Downloads nötig sind.
- Alle Verarbeitung im Renderer, OCR in einem Web Worker; keinerlei Netzwerkaufrufe. Electron-Fenster mit `contextIsolation: true`, `nodeIntegration: false`.
- Erkennungsregeln als eigenständiges Modul (`src/lib/redaction/*`) mit Regex + Validatoren (IBAN mod-97, Luhn) und Unit-Tests via vitest.
- Eigene Begriffsliste und Kategorie-Einstellungen in `localStorage`.
- Paketierung für Windows und macOS per `@electron/packager` als `.zip` unter `/mnt/documents/`.

## Hinweise

- Automatische Erkennung ist nie perfekt; die Oberfläche macht das transparent und erlaubt manuelles Nachbessern vor dem Export.
- Ausgabe ist bereinigter Text (Kopieren + `.txt`). Ein geschwärztes PDF ist nicht Teil dieses Umfangs.
