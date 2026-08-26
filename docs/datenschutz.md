# Datenschutzerklärung — Vorlage & Erläuterung

> Arbeitsvorlage für den Betreiber. Der tatsächlich ausgelieferte Text
> wird im **Admin-Panel unter "Einstellungen"** gepflegt (Startwerte:
> `backend/src/lib/siteSettings.ts`). Diese Datei erläutert
> zusätzlich die **Rechtsgrundlagen** je Verarbeitung für den
> Projektbericht (Art. 6 DSGVO) — das ist der Teil, der in einer normalen
> Datenschutzerklärung meist implizit bleibt, hier aber explizit gemacht
> werden soll, weil er Kern der Ausbildungsaufgabe ist.

## Verantwortlicher

[Name/Anschrift des Betreibers — siehe impressum.md]

## Verarbeitungsübersicht

| Verarbeitung | Daten | Rechtsgrundlage (Art. 6 Abs. 1 DSGVO) | Speicherdauer |
|---|---|---|---|
| Bestellabwicklung | Name, Lieferadresse, Artikel (PGP-verschlüsselt) | lit. b (Vertragserfüllung) | 10 Jahre (§ 147 AO) |
| Bestellpositionen (Lagerverwaltung) | Artikel-ID + Menge, **ohne** Personenbezug | lit. b | mit Bestellung |
| Zahlungsabgleich BTC/XMR | Zahlungsadresse, Betrag, Bestätigungen (unverschlüsselt, aber ohne Personenbezug in der DB) | lit. b | wie Bestellung |
| Abfrage öffentlicher Blockchain-APIs/-Nodes | IP-Adresse des Servers (nicht des Kunden) gegenüber Blockstream/Node-Betreiber | lit. f (berechtigtes Interesse: Zahlungsverifikation) | keine Speicherung durch uns; siehe Datenschutz des jeweiligen Node-Betreibers |
| Kontaktanfragen | Nachricht, optionale Bestellnummer, optionale Messenger-ID (PGP-verschlüsselt) | lit. b/f | bis Bearbeitung abgeschlossen + 7 Tage Nachfrist |
| Admin-Login | Benutzername, Argon2id-Passwort-Hash, TOTP-Secret, Session-Token-Hash | lit. f (Systemsicherheit) | bis Löschung des Admin-Accounts / Session-Ablauf |
| Server-Logs | HTTP-Methode, Pfad (ohne Query-String), Statuscode — **keine IP-Adressen** | lit. f | rotierend, kurzfristig |

## Warum Bestellpositionen unverschlüsselt gespeichert werden

Die Tabelle `order_items` hält fest, welcher Artikel in welcher Menge zu
einer Bestellung gehört – bewusst ohne jeden Personenbezug (wer bestellt
hat, steht ausschließlich im PGP-Blob). Das ist notwendig, damit
reservierter Lagerbestand bei abgelaufenen oder stornierten Bestellungen
automatisch zurückgebucht werden kann; ohne diese Angabe könnte der Server
nach Ablauf eines Zahlungsfensters nicht wissen, welche Artikel wieder
freizugeben sind, und der Bestand würde dauerhaft blockiert. Die Abwägung
(minimale zusätzliche Datenhaltung vs. funktionierende Lagerverwaltung)
gehört in den Projektbericht.

## Warum keine IP-Adressen gespeichert werden

Die Anwendung ist bewusst so konfiguriert, dass Access-Logs (Backend:
`pino-http`-Serializer, Caddy: `log`-Filter-Direktive) IP-Adressen aktiv
herausfiltern. Zusätzlich werden Bestell-Tokens (UUIDs) in geloggten
Pfaden zu `:id` maskiert – sonst hätte jeder mit Log-Zugriff über den
`order_token` Einsicht in den Bestellstatus. Dies reduziert die Angriffsfläche bei einem Server-Kompromiss
und minimiert die datenschutzrechtlich relevante Datenmenge. Trade-off: Ohne
IP-Logging ist forensische Nachvollziehbarkeit bei Missbrauch (z.B.
DoS-Versuche) eingeschränkt — das In-Memory-Rate-Limiting
(`backend/src/middleware/rateLimit.ts`) verarbeitet die IP nur transient
für die Dauer des Zeitfensters, ohne sie zu persistieren oder zu loggen.

## Warum PGP statt „normaler“ Datenbankverschlüsselung

Bei klassischer serverseitiger Verschlüsselung besitzt die Anwendung selbst
den Schlüssel und kann die Daten jederzeit entschlüsseln — bei einem
kompromittierten Server (RCE, gestohlenes Backup, böswilliger Admin-Zugriff
auf die laufende Anwendung) sind die Klardaten dann trotzdem einsehbar. Mit
clientseitiger PGP-Verschlüsselung (Public Key des Betreibers) besitzt der
Server **nie** den privaten Schlüssel — ein Server-Kompromiss allein
reicht nicht aus, um Bestelldaten zu lesen. Die zusätzliche AES-256-GCM-
Verschlüsselung "at rest" (`backend/src/services/crypto/atRest.ts`) ist
eine zweite, unabhängige Schutzschicht für den Fall eines reinen
Datenbank-/Backup-Diebstahls.

## Rechte der betroffenen Person

Da personenbezogene Bestelldaten ausschließlich verschlüsselt und ohne
direkten Identitätsbezug in der Datenbank liegen, kann der Betreiber
Auskunfts-, Berichtigungs- und Löschanfragen (Art. 15, 16, 17 DSGVO) nur
nach Selbstauskunft der betroffenen Person bearbeiten (z.B. über die
Bestellnummer, mitgeteilt über das Kontaktformular). Dies ist im
Projektbericht als bewusste Abwägung zwischen Datensparsamkeit und
Komfort der Rechtewahrnehmung zu dokumentieren.
