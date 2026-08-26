# CryptoShop

Datensparsamer Krypto-Webshop — Ausbildungsprojekt FISI (Systemintegration
& Sicherheit). Ein E-Commerce-Referenzaufbau mit Ende-zu-Ende-Verschlüsselung
(PGP), ausschließlicher Zahlung per Bitcoin/Monero und maximaler
Datensparsamkeit (keine Tracker, keine Analytics, keine Fremd-CDNs, keine
IP-Adress-Speicherung).

Das vollständige Konzept inkl. Architekturentscheidungen liegt in
[`docs/`](docs/); siehe insbesondere
[`docs/verschluesselung.md`](docs/verschluesselung.md) für den
Ende-zu-Ende-Verschlüsselungsfluss.

## Aufbau des Repos

```
backend/    Node.js/Express-API (Bestellungen, Zahlungs-Polling, Admin-Auth)
frontend/   Kunden-Shop (SvelteKit, adapter-node)
admin/      Admin-Panel (SvelteKit-SPA, adapter-static)
infra/      docker-compose, Caddyfile (Reverse Proxy/TLS), nftables.conf
docs/       Impressum/Datenschutz/Widerruf-Vorlagen, Verschlüsselungskonzept,
            Demo-PGP-Schlüsselpaar für lokale Entwicklung
```

## Kernprinzipien

- **Privacy by Design & by Default**: keine Analytics, keine
  Drittanbieter-Ressourcen, keine IP-Logs.
- **Automatische Löschung**: alle kundenbezogenen Daten (Bestellungen
  inkl. Positionen, Kontaktanfragen) werden nach `DATA_RETENTION_DAYS`
  – standardmäßig **14 Tagen** – unwiderruflich gelöscht. Der Löschlauf
  läuft alle 6 Stunden im Backend-Prozess, ein externer Cronjob ist
  nicht erforderlich.
- **Ende-zu-Ende-Verschlüsselung**: Bestell- und Kontaktdaten werden
  clientseitig mit dem PGP-Public-Key des Betreibers verschlüsselt, bevor
  sie das Backend erreichen. Der Server sieht sie nie im Klartext.
- **Nur Kryptowährungen**: Bitcoin (on-chain, HD-Wallet, watch-only) und
  Monero (Subadressen über `monero-wallet-rpc`).
- **Zwei getrennte Frontends**: öffentlicher Shop und Admin-Panel sind
  separate Anwendungen auf getrennten Domains. Die Admin-API liegt
  same-origin bei der Admin-Domain – dadurch greifen `SameSite=Strict`-
  Cookies, es wird kein CORS benötigt, und ein XSS im öffentlichen Shop
  kann die Admin-API nicht mit Anmeldedaten aufrufen.
- **Inhalte im Admin-Panel pflegbar**: Shopname, Startseiten- und
  Kassentexte sowie Impressum, Datenschutz und Widerruf werden unter
  „Einstellungen" bearbeitet und in der Datenbank gespeichert – kein
  Redeploy nötig. Die Texte werden als Markdown gespeichert und mit einem
  bewusst escapenden Renderer ausgegeben (kein HTML-Durchgriff, siehe
  `frontend/src/lib/markdown.ts`).

## Lokale Entwicklung

Voraussetzung: Node.js 22+, eine lokale PostgreSQL-Instanz.

```bash
# 1. Backend
cd backend
cp .env.example .env   # DATABASE_URL etc. anpassen (siehe unten)
npm install
npm run migrate         # legt das Schema an
npm run create-admin    # interaktiv: Admin-User + TOTP-Secret anlegen
npm run dev              # http://localhost:3000

# 2. Kunden-Shop (neues Terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173

# 3. Admin-Panel (neues Terminal)
cd admin
npm install
npm run dev               # http://localhost:5174 (Standard-Vite-Port, ggf. abweichend)
```

`backend/.env` benötigt mindestens `DATABASE_URL`, `SESSION_SECRET` (>= 32
Zeichen) und `AT_REST_KEY` (32-Byte-Hex, z.B. `openssl rand -hex 32`) —
siehe `backend/src/lib/env.ts` für alle Variablen und Defaults.

Zum Testen des Verschlüsselungsflows ohne eigenes PGP-Schlüsselpaar liegt
unter `frontend/static/pgp-public-key.asc` bereits ein **Demo-Public-Key**;
der zugehörige (ausschließlich zum lokalen Testen gedachte) private
Schlüssel liegt in `docs/demo-keys/DEMO-private-key.asc` — Details und
Warnhinweis in [`docs/demo-keys/README.md`](docs/demo-keys/README.md).
BTC/XMR-Zahlungen benötigen zusätzlich `BTC_XPUB` bzw. eine erreichbare
`monero-wallet-rpc`-Instanz; ohne diese schlägt nur der Checkout für die
jeweilige Zahlungsmethode fehl, der Rest der Anwendung funktioniert.

## Produktions-Deployment

Siehe [`infra/`](infra/): `docker-compose.yml` orchestriert PostgreSQL,
Backend, den Kunden-Shop (Node-Server) und einen Build-Container für das
statische Admin-Panel-Bundle; `Caddyfile` übernimmt automatisches TLS,
Security-Header und das Routing (Shop-Domain vs. separate Admin-Domain);
`nftables.conf` ist eine minimale VPS-Firewall-Vorlage.

```bash
cp .env.example .env   # alle Werte ausfüllen, insb. Secrets/Domains
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
docker compose -f infra/docker-compose.yml --env-file .env exec backend npm run migrate
docker compose -f infra/docker-compose.yml --env-file .env exec backend npm run create-admin
```

Vor dem Live-Betrieb zwingend:

1. Eigenes PGP-Schlüsselpaar erzeugen und `frontend/static/pgp-public-key.asc`
   ersetzen (siehe `docs/demo-keys/README.md`).
2. Rechtstexte im Admin-Panel unter „Einstellungen" ausfüllen; die
   Vorlagen mit Erläuterungen liegen in `docs/impressum.md`,
   `docs/datenschutz.md` und `docs/widerruf.md`.
3. `infra/Caddyfile`: E-Mail-Adresse für ACME anpassen.
4. `DATA_RETENTION_DAYS` prüfen. Standard sind **14 Tage** – siehe den
   Hinweis zur Aufbewahrungspflicht unten. Ein Cronjob ist nicht nötig,
   der Löschlauf ist im Backend eingebaut; `npm run delete-expired`
   stößt ihn bei Bedarf manuell an.
5. `TRUST_PROXY_HOPS=1` setzen (hinter Caddy), damit das Rate-Limiting die
   echte Client-IP unterscheidet. `CORS_ORIGINS` bleibt in dieser
   Topologie leer.

## Sicherheits-Checkliste

Siehe Konzept-Dokument (im ursprünglichen Auftrag), Abschnitt 8 — im Code
umgesetzt u.a. als: strikte CSP ohne `unsafe-inline`-Skripte (SvelteKit-CSP
mit Nonces, siehe `frontend/vite.config.ts` und `admin/vite.config.ts`),
Argon2id + TOTP für Admin-Logins (inkl. Drosselung pro Benutzername),
In-Memory-Rate-Limiting auf `/api/checkout`, `/api/contact` und
`/admin/auth/login`, CSRF-Schutz auf allen zustandsändernden Endpoints
(Double-Submit-Cookie **und** Origin-Prüfung), serverseitige
Zod-Validierung aller Eingaben, enge Body-Limits sowie ein
kein-IP-Logging-Prinzip in Backend (`pino`) und Reverse Proxy (Caddy) –
inklusive Maskierung der Bestell-Tokens in Log-Pfaden.

Bestellungen reservieren beim Checkout Lagerbestand; läuft das
Zahlungsfenster ab oder wird storniert, bucht der Zahlungs-Poller den
Bestand automatisch und idempotent zurück (`orders.stock_released`).

## Aufbewahrungsfrist — rechtlicher Hinweis

Der Standard von **14 Tagen** (`DATA_RETENTION_DAYS`) ist maximal
datensparsam, steht aber im Widerspruch zu § 147 Abs. 3 AO und
§ 257 Abs. 4 HGB, die für Rechnungs- und Buchungsbelege **10 Jahre**
Aufbewahrung verlangen. Für ein Demo-/Ausbildungssystem ohne echte
Umsätze ist das unkritisch; vor einem produktiven Warenverkauf ist
`DATA_RETENTION_DAYS=3650` zu setzen oder eine reduzierte Rechnungskopie
außerhalb des Shops zu archivieren. Die Abwägung ist in
[`docs/datenschutz.md`](docs/datenschutz.md) ausführlich dokumentiert.
