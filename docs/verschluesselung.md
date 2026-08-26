# Verschlüsselungskonzept im Detail

Referenziert aus mehreren Code-Kommentaren (`frontend/src/lib/crypto/pgp.ts`,
`admin/src/lib/decrypt/pgp.svelte.ts`, `backend/src/services/crypto/atRest.ts`).
Entspricht Konzept-Dokument Abschnitt 4, hier mit den konkreten
Implementierungsdetails dieses Repos.

## Ablauf: Bestellung aufgeben

```
Kunde-Browser                    Backend                    Admin-Browser
──────────────                   ───────                    ─────────────
1. Formular ausfüllen
2. Public Key laden
   (/pgp-public-key.asc,
   statisch, kein API-Call)
3. openpgp.encrypt()
   -> ASCII-armored Blob
4. POST /api/checkout
   { encryptedPayload, ... } ──> 5. Preis serverseitig neu
                                     berechnen (nie Client
                                     vertrauen)
                                  6. AES-256-GCM "at rest"
                                     über den PGP-Blob legen
                                     (encryptAtRest)
                                  7. In orders.encrypted_
                                     payload speichern
                                                              8. GET /admin/orders
                                  9. decryptAtRest() ────────>   (liefert weiterhin
                                     (nur AES-Schicht                PGP-Blob zurück)
                                     entfernt, PGP-Blob
                                     bleibt für Backend
                                     unlesbar)
                                                              10. Privaten Key lokal
                                                                  entsperren (Datei +
                                                                  Passphrase)
                                                              11. openpgp.decrypt()
                                                                  im Browser
                                                              12. Klardaten nur im
                                                                  Speicher des Admin-
                                                                  Tabs, nie persistiert
```

## Warum zwei Verschlüsselungsschichten?

| Schicht | Schutz gegen | Schlüssel-Ort |
|---|---|---|
| PGP (Client → Betreiber) | Server-Kompromiss (RCE), böswilliger Betreiber-Mitarbeiter mit DB-Zugriff aber ohne privaten Schlüssel, Backup-Diebstahl | Nur auf dem Gerät des Betreibers (idealerweise Hardware-Token/YubiKey) |
| AES-256-GCM "at rest" (Backend) | Reiner DB-/Backup-Diebstahl ohne Server-RCE (z.B. gestohlene Backup-Datei) | `AT_REST_KEY`, Backend-Prozessumgebung/Secret-Store |

Ein Angreifer bräuchte **beide** Schlüssel (privater PGP-Key des Betreibers
+ `AT_REST_KEY` des Servers), um Klardaten zu erhalten — die beiden
Schlüssel liegen bewusst an unterschiedlichen Orten (Betreiber-Endgerät vs.
Server-Secret-Store).

## Was NICHT verschlüsselt wird (bewusst)

- `payment_address`, `amount_crypto`, `amount_eur`, `status`,
  `confirmations`: notwendig für Zahlungsabgleich und öffentlichen
  Bestellstatus-Abruf über `order_token`, enthalten für sich genommen
  keinen Personenbezug.
- `order_token`: eine zufällige UUIDv4 (122 Bit Entropie), dient als
  unerratbares Capability-Token für den Kunden-Statusabruf — kein
  Personenbezug, aber vertraulich zu behandeln (nicht teilen).

## Schlüsselverwaltung (operativ)

1. Betreiber generiert ein eigenes PGP-Schlüsselpaar
   (`gpg --full-generate-key`, empfohlen: ed25519/Curve25519 oder RSA 4096).
2. Öffentlicher Schlüssel → `frontend/static/pgp-public-key.asc` (wird Teil
   des öffentlichen Frontend-Builds, kein Geheimnis).
3. Privater Schlüssel verbleibt ausschließlich lokal beim Betreiber,
   idealerweise passphrasegeschützt und/oder auf einem Hardware-Token.
   Er wird bei Bedarf im Admin-Panel (`KeyUnlock`-Komponente) hochgeladen
   und mit `openpgp.decryptKey()` **im Browser** entsperrt — der
   entschlüsselte Schlüssel lebt nur im JS-Heap des Tabs (Modulvariable),
   nie in `localStorage`/`IndexedDB`, und wird beim Sperren/Reload
   verworfen.
4. Schlüsselrotation: neues Schlüsselpaar erzeugen, öffentlichen Schlüssel
   austauschen; bereits gespeicherte, mit dem alten Schlüssel verschlüsselte
   Bestellungen bleiben nur mit dem alten privaten Schlüssel lesbar — dieser
   muss also bis zum Ablauf der Aufbewahrungsfrist (10 Jahre) sicher
   aufbewahrt werden.

## Threat Model (Kurzfassung für den Projektbericht)

| Angreifer-Fähigkeit | Abgedeckt? |
|---|---|
| Liest DB-Dump/Backup | Ja (PGP + AES) |
| RCE auf Backend-Server, live | Ja für Bestelldaten (kein privater PGP-Key auf dem Server); **nein** für `AT_REST_KEY` selbst, der im Prozessspeicher liegt — ein Live-RCE mit Speicherzugriff könnte neu eingehende Klardaten vor der PGP-Verschlüsselung ohnehin nicht sehen (die findet im Browser statt), aber theoretisch den `AT_REST_KEY` extrahieren und damit die AES-Schicht brechen (PGP-Schicht bleibt trotzdem bestehen) |
| Kompromittierter Admin-Browser (Malware) beim Entschlüsseln | **Nein** — sobald der Admin den privaten Schlüssel lokal entsperrt, kann Malware auf demselben Gerät mitlesen. Außerhalb des Scopes dieser Anwendung (Endpoint-Sicherheit des Betreiber-Geräts). |
| MITM auf TLS-Verbindung | Nein, sofern TLS korrekt konfiguriert (HSTS, aktuelle Cipher) — siehe infra/Caddyfile |
