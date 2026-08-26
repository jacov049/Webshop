# Datenschutzerklärung — Vorlage & Erläuterung

> Arbeitsvorlage für den Betreiber. Der ausgelieferte Text liegt in
> `frontend/src/routes/datenschutz/+page.svelte`. Diese Datei erläutert
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
| Zahlungsabgleich BTC/XMR | Zahlungsadresse, Betrag, Bestätigungen (unverschlüsselt, aber ohne Personenbezug in der DB) | lit. b | wie Bestellung |
| Abfrage öffentlicher Blockchain-APIs/-Nodes | IP-Adresse des Servers (nicht des Kunden) gegenüber Blockstream/Node-Betreiber | lit. f (berechtigtes Interesse: Zahlungsverifikation) | keine Speicherung durch uns; siehe Datenschutz des jeweiligen Node-Betreibers |
| Kontaktanfragen | Nachricht, optionale Bestellnummer, optionale Messenger-ID (PGP-verschlüsselt) | lit. b/f | bis Bearbeitung abgeschlossen + 7 Tage Nachfrist |
| Admin-Login | Benutzername, Argon2id-Passwort-Hash, TOTP-Secret, Session-Token-Hash | lit. f (Systemsicherheit) | bis Löschung des Admin-Accounts / Session-Ablauf |
| Server-Logs | HTTP-Methode, Pfad (ohne Query-String), Statuscode — **keine IP-Adressen** | lit. f | rotierend, kurzfristig |

## Warum keine IP-Adressen gespeichert werden

Die Anwendung ist bewusst so konfiguriert, dass Access-Logs (Backend:
`pino-http`-Serializer, Caddy: `log`-Filter-Direktive) IP-Adressen aktiv
herausfiltern. Dies reduziert die Angriffsfläche bei einem Server-Kompromiss
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
