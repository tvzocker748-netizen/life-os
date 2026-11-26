# LIFE OS

Persönliche Lebens- und Finanz-App als Progressive Web App (PWA).
100 % offline, keine Server, keine Tracker, keine KI-Dienste. Alle Daten bleiben in IndexedDB auf deinem Gerät.

**Wichtig:** Dieses Repository enthält nur den Programmcode – niemals deine persönlichen Daten.

## Dateien
| Datei | Zweck |
|---|---|
| index.html | Grundgerüst der App |
| styles.css | Design (hell/dunkel) |
| app.js | Gesamte Logik: Finanzen, Ziele, Gewohnheiten, Journal, Berichte, Empfehlungen, Backup |
| sw.js | Service Worker für die Offline-Nutzung |
| manifest.webmanifest | Installationsdaten (Name, Icons, Farben) |
| icon-192.png, icon-512.png, apple-touch-icon.png | App-Symbole |

## Updates einspielen
Geänderte Dateien hochladen und in `sw.js` die Zeile `const VERSION = 'lifeos-v…'` erhöhen.
Die App zeigt danach „Neue Version verfügbar – Aktualisieren“.

## Datensicherung
Einstellungen (Zahnrad) → „Backup erstellen“. Die Sicherung ist eine JSON-Datei, die über
„Backup wiederherstellen“ auf jedem Gerät wieder eingespielt werden kann.
