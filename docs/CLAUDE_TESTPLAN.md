# Übergabe an Claude: Webshop-Review und Regressionstests

## Auftrag und Basis

Bitte den Branch `codex/review-fixes` gegen `main` prüfen. Er enthält die Änderungen
aus dem bisherigen Sicherheits-PR #1 plus die Korrekturen des Reviews vom 28.08.2026.
PR #1 zielte nicht auf main; dieser Korrekturstand ist für main vorgesehen.
Nicht automatisch mergen oder mit echten Kundendaten/Zahlungen testen.

Die Kommentare an den kritischen Funktionen erläutern die Invarianten. Diese Datei
ordnet jeden ursprünglichen Befund seiner Korrektur und seinem Test zu. Ein grüner
Build allein bestätigt keine korrekte Zahlungsabwicklung.

## Reproduzierbare Befehle

Voraussetzung: Node.js 22.18+ (CI: aktuelle 22.x), npm, Git. Keine echten Secrets in Tests.

```sh
cd backend
npm ci
npm test
npm run typecheck
npm run build
```

Ohne `TEST_DATABASE_URL` nutzen die SQL-/HTTP-Tests PGlite (eingebettetes PostgreSQL).
Ein Test für parallele Verbindungen wird dann ausdrücklich übersprungen. Die Tests
legen synthetische Produkte, Bestellungen und eine Test-Adminsession an. Sie prüfen
keinen echten TOTP-Login. Die synthetischen Checkout-Payloads sind absichtlich keine
vollständig verschlüsselten PGP-Nachrichten: Der Test prüft die Vertrauensgrenze,
nicht die PGP-Bibliothek. Den PGP-Fluss separat im Browser prüfen (unten).

Für dieselben Tests gegen einen echten separaten PostgreSQL-Dienst:

```sh
TEST_DATABASE_URL=postgres://postgres:test-only@localhost:5432/cryptoshop_test npm test
```

PowerShell:

```powershell
$env:TEST_DATABASE_URL='postgres://postgres:test-only@localhost:5432/cryptoshop_test'
npm test
Remove-Item Env:TEST_DATABASE_URL
```

Die Tests erzeugen ein zufälliges `audit_<uuid>`-Schema und entfernen nur dieses.
Trotzdem niemals eine Produktions-URL verwenden. Die CI startet PostgreSQL 16 und
führt auch den Parallelitätstest aus. Ein abgebrochener Test kann sein isoliertes
Schema hinterlassen; ausschließlich dieses nach Prüfung manuell entfernen.

```sh
cd ../frontend
npm ci
PUBLIC_API_BASE_URL="" npm run check
PUBLIC_API_BASE_URL="" npm run build
cd ../admin
npm ci
PUBLIC_API_BASE_URL="" npm run check
PUBLIC_API_BASE_URL="" npm run build
```

PowerShell vor den Frontend-/Adminbefehlen: `$env:PUBLIC_API_BASE_URL=''`.
Die Lockdateien wurden um fehlende Plattformpakete ergänzt. `npm ci` soll nun
auch auf Windows/npm 11 ohne Änderung der Lockdateien funktionieren.

## Befund → Korrektur → Nachweis

| Befund | Korrektur / wichtige Dateien | Automatisierter Nachweis |
|---|---|---|
| Unbestätigte Großzahlung erbt Bestätigungen einer Kleinstzahlung | `payment/amounts.ts`, `btc.ts`, `xmr.ts`, `poller.ts`: ausreichende Summe pro Bestätigungstiefe | `payment.test.mjs`: gemischte BTC-/XMR-Transfers, Toleranzgrenzen; SQL-Poller-Test |
| Manipulierbare Versandpositionen | Checkout speichert serverseitige Namen-/Einzelpreis-Snapshots; Admin zeigt ausschließlich diese Artikel | `integration.test.mjs`: kontrollierter Kundenpayload, geänderte Produktstammdaten, unveränderlicher Admin-Snapshot |
| BTC-Bruchteile eines Satoshis im PR | `quoteCrypto` erzeugt exakte Dezimalstrings aus Integern; alte offene Beträge werden aufgerundet | EUR 10 / EUR 60000 → `0.00016667`; alter Wert `0.000166666667` wird verarbeitet |
| Ablauf vor letzter Zahlungsprüfung | Polling vor Ablauf; frischer erfolgreicher Check nach Frist, Nachfrist, Status erneut unter Sperre geprüft | Ablauf ohne/mit altem/frischem Check |
| Globales 64-KB-Limit verhindert Bilder | `app.ts`: authentifizierte Uploadroute vor allgemeinem Parser, CSRF vor Uploadparser | >64-KB-Bild erfolgreich; ungültiges Bild 400; fehlende Anmeldung 401 |
| Doppelte Artikel / falsche Rückbuchung | Doppelte IDs im neuen Checkout abgelehnt; `SUM` für Altdaten | 2+3 Positionen ergeben genau 5 zurückgebuchte Einheiten |
| Nicht-atomare Status-/Bestandsänderung | `stock.ts`: eine Transaktion, Order-Lock, feste Produkt-Lockreihenfolge, terminale Status gesperrt | SQL-Fehler rollt Status zurück; Wiederholung; echte PG-Konkurrenz |
| Lange externe Requests | `lib/http.ts`: expliziter Timeout bis einschließlich Antwortkörper; externe Checkout-Aufrufe vor Bestandssperren | Hängender Antwortkörper wird abgebrochen |
| Klartext bleibt nach PGP-Sperre sichtbar | Komponenten leeren `decrypted`; Generationszähler verwirft verspätete Ergebnisse | Browserprüfung erforderlich, siehe unten |
| Nur neueste 200 Vorgänge erreichbar | Cursor-Pagination mit Zeit+UUID, „Weitere laden“ im Admin | API-Cursor liefert nächste andere Bestellung; ungültige Cursor abgewiesen |
| Unbegrenzt veralteter Kurs | maximal 5 Minuten Cachealter, danach 503 | Simulierte Zeit und Kursausfall |
| BTC-Mock ohne `vout` | realistische Outputs, mehrere Transfers pro Adresse, nur Loopback-Bindung | `mock-services.test.mjs` startet die mitgelieferten Dienste und prüft beide Währungen |

Weitere Änderungen: offene Vorgänge werden nicht durch Retention gelöscht; alte
unterbrochene Freigaben werden vorher repariert. Demo-PGP-Key wird in Produktions-
Frontend-Builds abgelehnt. Caddy ergänzt `X-Frame-Options: DENY` für die statische SPA.
Die Firewallvorlage löscht keine Docker-Regeln mehr und setzt keine konkurrierende
Forward-Drop-Policy. Firewallwirkung weiterhin auf dem Zielhost prüfen.

## API- und Verhaltensänderungen

- `GET /admin/orders` und `GET /admin/contact` liefern jetzt
  `{ items: [...], nextCursor: string | null }`, optional `limit=1..200` und `cursor`.
  Shop und Admin gemeinsam aktualisieren; alte externe Clients müssen angepasst werden.
- `POST /api/checkout`: `amountCrypto` und `amountEur` sind Dezimalstrings, keine
  JavaScript-Fließkommazahlen. Gleiche Werte für DB, Antwort und Zahlungsanzeige.
- Versandpositionen stammen aus `order.items`, nicht aus `decrypted.items`.
  Historische Positionen ohne Snapshot werden klar als unverifiziert angezeigt.
  Nicht anhand alter Kundenangaben blind versenden.
- Statuswechsel: `pending → cancelled`, `confirming → paid/cancelled`,
  `paid → shipped/cancelled`; terminale Status werden nicht wieder geöffnet.
  `confirming → paid` ist eine ausdrückliche manuelle Zahlungsentscheidung des Admins.
  Automatische Zahlungserkennung erfolgt separat im Poller.
- `expired` kommt vom kontrollierten Ablauf, nicht vom freien Admin-Dropdown.
- Nichtpositive Gesamtbestellungen werden abgewiesen; keine Nullbetrag-Zahlungen.
- `RATES_MAX_AGE_MS=300000`, `EXTERNAL_REQUEST_TIMEOUT_MS=8000` sind neue Defaults.

## Migration und Deployment

1. Backup inklusive separat gesicherter Secrets erstellen und Restore prüfen.
2. Backend für die Migration stoppen bzw. Wartungsmodus aktivieren; nicht alte und
   neue schreibende Backends gleichzeitig betreiben.
3. Separate `TOTP_ENCRYPTION_KEY` und `AT_REST_KEY` konfigurieren; neue TOTP-Anforderung
   stammt aus PR #1. Keine vorhandenen Verschlüsselungsschlüssel beiläufig ersetzen.
4. `npm run migrate` mit der richtigen Zielkonfiguration ausführen. Die Migration
   ist wiederholbar: neue Snapshot-Spalten, vorhandener Payment-Check-Zeitpunkt,
   Rundung nur offener BTC-Bestellungen um weniger als einen Satoshi nach oben.
   Abgeschlossene historische Rechnungsbeträge werden nicht verändert.
5. Historische Namen/Preise werden bewusst NICHT aus aktuellen Produktdaten erfunden.
   Altfälle manuell anhand verlässlicher Belege klären.
6. Backend, Shop und Admin zusammen deployen. Eigenen PGP-Key und passenden
   `PGP_PUBLIC_KEY_FINGERPRINT` konfigurieren. Der veröffentlichte Demo-Private-Key
   macht den Demo-Public-Key für Produktionsdaten ungeeignet.
7. Bereits gespeicherte Datenschutzhinweise im Admin an die Retention-Ausnahmen und
   gespeicherten Artikel-/Preis-Snapshots anpassen. Die Migration überschreibt keine
   redaktionellen Betreibertexte. Keine Rechtsprüfung durch diese Codeänderung.
8. Caddy-/Docker-/Firewallkonfiguration erst in Staging prüfen. Keine Firewallregeln
   blind auf dem Server einspielen; alternative SSH-/Konsolenverbindung bereithalten.

## Manuelle Browserprüfungen für Claude

Diese Punkte sind nicht durch die Backendtests oder den Svelte-Typcheck bewiesen:

1. **PGP:** Lokalen Dev-Shop mit passendem Fingerprint starten; Bestellung und Kontakt
   verschlüsseln, im Admin mit passendem Key entschlüsseln. Falscher Fingerprint/Key
   muss verständlich scheitern. Im Produktionsbuild muss der Demo-Key abgewiesen werden.
2. **Sperren:** Bestellung und Kontakt entschlüsseln, „Sperren“ klicken: alle zuvor
   sichtbaren Namen/Adressen/Nachrichten verschwinden. Auch unmittelbar während einer
   laufenden Entschlüsselung sperren; ein späteres Promise-Ergebnis darf nichts zeigen.
   Wieder entsperren erfordert erneute Entschlüsselung. Kein persistierter privater Key.
3. **Artikelmanipulation:** Im Testrequest verschlüsselte Artikel anders als `items`
   setzen; Admin muss ausschließlich serverseitige Positionen als Versandgrundlage zeigen.
4. **Pagination:** Mehr als 200 Bestellungen/Kontakte anlegen, bis zum letzten Datensatz
   weiterladen. Filter wechseln. Fehlende Serververbindung zeigt eine Fehlermeldung.
5. **Bilder:** Gültiges PNG/JPEG deutlich >64 KB hochladen, ansehen, ersetzen, löschen.
   Fehlende Session/CSRF sowie ungültige Datei müssen scheitern.
6. **Zahlungsmonitor:** BTC-/XMR-Teilzahlungen, Bestätigungsfortschritt und Unterzahlung
   beobachten. Mehr als 200 offene Vorgänge müssen auf die vollständige Liste verweisen.
7. **Session/2FA:** Falsches Passwort, falscher TOTP-Code, abgelaufene Session, Logout,
   Rate-Limits, fremde Origin, fehlende CSRF-Header und nicht authentifizierte Admin-API.
8. **Staging:** Dockerbuild, Migration auf Kopie einer Alt-Datenbank, TLS/Headers,
   Reverse-Proxy-IP-Rate-Limit, Logmaskierung, Backup/Restore und Neustart prüfen.
9. **Erst danach:** Kontrollierte kleine Zahlungen gegen die tatsächlich eingesetzten
   Wallet-/Node-Dienste. Keine Walletschlüssel oder echten Kundendaten in Logs/PRs posten.

## Lokaler Nachweis dieses Änderungsstands

Windows / Node 24.16.0 / npm 11.13.0: saubere Installation aller drei Lockdateien;
Backendtests mit PGlite: 14 erfolgreich, ein echter PG-Parallelitätstest lokal übersprungen.
Backend-Typcheck/Build sowie Shop-/Admin-Check/Build erfolgreich, keine Svelte-Warnungen.
GitHub-CI prüft den tatsächlichen gepushten Commit separat unter Node 22/PostgreSQL 16;
vor Freigabe dessen Status prüfen. Keine Produktionsbereitstellung oder echten Zahlungen
im Rahmen dieser Änderungen durchgeführt.
