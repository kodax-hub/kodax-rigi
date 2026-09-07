# Kodax Secure AI "Rigi" — Release Notes

Copy everything below the separator into the GitHub release description field, then attach the three ZIP files as release assets.

---

## Kodax Secure AI "Rigi" — Offline Document Anonymizer

**Rigi** is a fully offline desktop and web app by Kodax. It converts PDFs and images into plain text and automatically removes personal information, so the anonymized result can safely be uploaded to any external AI.

Everything runs locally on your device. No upload. No cloud processing. No network calls.

### What it does

- Open or drop PDFs and images (PNG, JPG)
- Extract text directly from PDFs; OCR fallback for scanned documents
- Detect and replace personal data with placeholders like `[NAME 1]`, `[IBAN 1]`, `[ADDRESS 1]`
- Detects: names, addresses, emails, phone numbers, IBANs, credit card numbers, dates of birth, social insurance numbers
- Add your own custom terms that should always be replaced
- Review and toggle individual matches before exporting
- Copy the result or save it as `.txt`

### Privacy first

All processing — text extraction, OCR, and personal-data detection — happens on your machine. Your documents never leave your device.

### Install

**Windows**
1. Download `KodaxSecureAIRigi-win32-x64.zip`
2. Extract the ZIP
3. Open the folder and run `KodaxSecureAIRigi.exe`

**macOS**
1. Download the ZIP for your Mac (`x64` for Intel, `arm64` for Apple Silicon)
2. Extract it and move `KodaxSecureAIRigi.app` to your **Applications** folder
3. On first launch macOS may show "KodaxSecureAIRigi.app is damaged" because the app is not signed with an Apple certificate. Fix this once by opening **Terminal** and running:

   ```sh
   xattr -cr /Applications/KodaxSecureAIRigi.app
   ```

4. Launch the app normally. This step is only required once.

**Web / PWA**
1. Open [https://rigi.kodax.cloud](https://rigi.kodax.cloud) in Chrome, Edge, or Safari
2. Use the browser's "Install" or "Add to Home Screen" option
3. The app works offline after the first visit

### How to use

1. Drop a file or click to select one
2. Wait for text extraction (OCR shows a progress bar)
3. Review detected personal data in the side panel
4. Toggle any match you want to keep as-is
5. Copy or save the anonymized text

### Notes

- Automatic detection is not perfect. Always review the highlighted matches before exporting.
- The web version loads a local AI model on first use (~170 MB). After that it works fully offline.
- Output is plain text only. Redacted PDF export is not included.

### Assets

Attach these files to the release:

- `KodaxSecureAIRigi-darwin-arm64.zip` — macOS Apple Silicon
- `KodaxSecureAIRigi-darwin-x64.zip` — macOS Intel
- `KodaxSecureAIRigi-win32-x64.zip` — Windows
