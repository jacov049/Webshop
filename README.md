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
- **Ende-zu-Ende-Verschlüsselung**: Bestell- und Kontaktdaten werden
  clientseitig mit dem PGP-Public-Key des Betreibers verschlüsselt, bevor
  sie das Backend erreichen. Der Server sieht sie nie im Klartext.
- **Nur Kryptowährungen**: Bitcoin (on-chain, HD-Wallet, watch-only) und
  Monero (Subadressen über `monero-wallet-rpc`).
- **Zwei getrennte Frontends**: öffentlicher Shop und Admin-Panel sind
  separate Anwendungen mit unterschiedlichen Vertrauensgrenzen.

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
2. `docs/impressum.md`, `docs/datenschutz.md`, `docs/widerruf.md` ausfüllen
   und in die jeweiligen `+page.svelte`-Dateien in `frontend/src/routes/`
   übertragen.
3. `infra/Caddyfile`: E-Mail-Adresse für ACME anpassen.
4. Einen Cronjob für `backend/scripts/delete-expired.ts` einrichten
   (löscht abgelaufene Bestellungen/Kontaktanfragen gemäß den in `.env`
   konfigurierten Aufbewahrungsfristen).

## Sicherheits-Checkliste

Siehe Konzept-Dokument (im ursprünglichen Auftrag), Abschnitt 8 — im Code
umgesetzt u.a. als: strikte CSP ohne `unsafe-inline`-Skripte (SvelteKit-CSP
mit Nonces, siehe `frontend/vite.config.ts` und `admin/vite.config.ts`),
Argon2id + TOTP für Admin-Logins, In-Memory-Rate-Limiting auf
`/api/checkout`, `/api/contact` und `/admin/auth/login`, CSRF-Schutz
(Double-Submit-Cookie) auf allen zustandsändernden Endpoints, serverseitige
Zod-Validierung aller Eingaben und ein kein-IP-Logging-Prinzip in
Backend (`pino`) und Reverse Proxy (Caddy).
