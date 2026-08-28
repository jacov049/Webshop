# Datenschutzerklärung — Vorlage & Erläuterung

> Arbeitsvorlage für den Betreiber. Der tatsächlich ausgelieferte Text
> wird im **Admin-Panel unter "Einstellungen"** gepflegt (Startwerte:
> `backend/src/lib/siteSettings.ts`). Diese Datei erläutert zusätzlich die
> Rechtsgrundlagen je Verarbeitung. Vor einem produktiven Einsatz muss der
> konkrete Shop rechtlich geprüft und an das tatsächliche Geschäftsmodell
> angepasst werden.

## Verantwortlicher

[Name/Anschrift/E-Mail des Betreibers — siehe impressum.md]

## Verarbeitungsübersicht

| Verarbeitung | Daten | Rechtsgrundlage (Art. 6 Abs. 1 DSGVO) | Speicherdauer |
|---|---|---|---|
| Bestellabwicklung | Name, Lieferadresse, Artikel (PGP-verschlüsselt) | lit. b (Vertragserfüllung) | technisch konfigurierbar; produktiv mit gesetzlichen Aufbewahrungspflichten abstimmen |
| Bestellpositionen (Lagerverwaltung) | Artikel-ID + Menge, ohne direkten Personenbezug | lit. b | mit Bestellung |
| Zahlungsabgleich BTC/XMR | Zahlungsadresse, Betrag, Bestätigungen | lit. b | wie Bestellung |
| Abfrage öffentlicher Blockchain-APIs/-Nodes | IP-Adresse des Servers gegenüber Node/API-Betreiber | lit. f (berechtigtes Interesse: Zahlungsverifikation) | keine Speicherung durch uns; Drittanbieter gesondert prüfen |
| Kontaktanfragen | Nachricht, optionale Bestellnummer, optionale Messenger-ID (PGP-verschlüsselt) | lit. b/f | konfigurierbar; nach Erledigung möglichst kurz |
| Admin-Login | Benutzername, Argon2id-Passwort-Hash, verschlüsseltes TOTP-Secret, Session-Token-Hash | lit. f (Systemsicherheit) | bis Löschung des Admin-Accounts / Session-Ablauf |
| Server-Logs | HTTP-Methode, maskierter Pfad, Statuscode — keine IP-Adressen | lit. f | rotierend, kurzfristig |

## Automatische Löschung

Der Backend-Löschjob entfernt abgeschlossene kundenbezogene Datensätze nach
`DATA_RETENTION_DAYS`. Der Standardwert von 14 Tagen ist nur für Entwicklung,
Demo und Tests gedacht. Er ist **kein geeigneter pauschaler Produktionswert**
für einen echten Warenverkauf.

Maßgeblich ist derzeit `created_at`. Eine Änderung von
`DATA_RETENTION_DAYS` wirkt dadurch auch auf bereits vorhandene Datensätze.
Offene und bezahlte, noch nicht versendete Bestellungen bleiben bis zur Klärung
erhalten. Stornierte/abgelaufene Bestellungen werden erst nach erfolgreicher
Bestandsfreigabe gelöscht. Bereits im Admin gespeicherte Texte werden durch die
Migration nicht überschrieben und müssen diese Ausnahme ebenfalls erläutern.

Nicht gelöscht werden Artikelstammdaten und die im Admin-Panel gepflegten
Website-Texte, da es sich dabei nicht um Kundendaten handelt.

### Konflikt mit handels- und steuerrechtlichen Aufbewahrungspflichten

Für produktive Verkäufe dürfen steuerlich oder handelsrechtlich
aufbewahrungspflichtige Unterlagen nicht nach wenigen Tagen gelöscht werden.
Stand 2026 gelten insbesondere:

- § 147 Abs. 3 AO: Buchungsbelege nach § 147 Abs. 1 Nr. 4 grundsätzlich **8 Jahre**; bestimmte andere Unterlagen weiterhin 10 bzw. 6 Jahre.
- § 257 Abs. 4 HGB: Buchungsbelege grundsätzlich **8 Jahre**; Handelsbücher, Inventare und Abschlüsse grundsätzlich 10 Jahre, sonstige dort genannte Unterlagen 6 Jahre.
- § 14b UStG: Rechnungen grundsätzlich **8 Jahre**.

Die konkrete Frist beginnt je nach Vorschrift nicht einfach am Bestelltag,
sondern regelmäßig mit dem Schluss des maßgeblichen Kalenderjahres. Deshalb
sollte `DATA_RETENTION_DAYS` nicht als alleinige Lösung für die gesetzliche
Archivierung behandelt werden.

Empfohlene Architektur für einen produktiven Shop: Die operativen,
personenbezogenen Bestelldaten möglichst kurz halten und die gesetzlich
notwendigen Rechnungs-/Buchungsdaten in einer **separaten, auf das erforderliche
Minimum reduzierten und revisionssicher verwalteten Archivierung** führen.
Welche Daten dort konkret erforderlich sind, muss steuerlich/rechtlich geprüft
werden.

## Warum Bestellpositionen unverschlüsselt gespeichert werden

Die Tabelle `order_items` hält fest, welcher Artikel in welcher Menge zu einer
Bestellung gehört – bewusst ohne Namen oder Lieferadresse. Das ist notwendig,
damit reservierter Lagerbestand bei abgelaufenen oder stornierten Bestellungen
automatisch zurückgebucht werden kann. Die Zuordnung zum Kunden liegt nur im
verschlüsselten Payload.

## Warum keine IP-Adressen gespeichert werden

Die Anwendung ist so konfiguriert, dass Backend- und Caddy-Access-Logs
IP-Adressen nicht persistieren. Bestell-Tokens werden in Pfaden maskiert. Das
In-Memory-Rate-Limiting verarbeitet die IP nur vorübergehend für das jeweilige
Zeitfenster.

Das reduziert Datenmenge und Angriffsfläche, erschwert aber die forensische
Nachvollziehbarkeit bei Missbrauch. Diese Abwägung muss für den tatsächlichen
Betrieb bewusst getroffen werden.

## Warum PGP statt nur Datenbankverschlüsselung

Bei rein serverseitiger Verschlüsselung besitzt die Anwendung selbst den
Entschlüsselungsschlüssel. Bei der clientseitigen PGP-Verschlüsselung erhält
das Backend nur einen verschlüsselten Blob und besitzt keinen PGP-Private-Key.
Die zusätzliche AES-256-GCM-Verschlüsselung in der Datenbank ist eine zweite,
unabhängige Schutzschicht gegen einen reinen Datenbank-/Backup-Diebstahl.

## Rechte der betroffenen Person

Da Bestelldaten verschlüsselt und nicht unter einem Klartext-Kundenkonto
geführt werden, kann die Zuordnung einer Anfrage zur Bestellung beispielsweise
über den Bestell-Token oder andere vom Kunden mitgeteilte Angaben erfolgen.
Die konkrete Umsetzung der Rechte aus Art. 15 ff. DSGVO muss im produktiven
Betrieb so gestaltet sein, dass Betroffenenrechte trotz Datensparsamkeit
praktisch erfüllbar bleiben.
