# CryptoShop

Datensparsamer Krypto-Webshop mit Ende-zu-Ende-Verschlüsselung (PGP), ausschließlicher Zahlung per Bitcoin/Monero und konsequenter Datensparsamkeit (keine Tracker, keine Analytics, keine Fremd-CDNs, keine IP-Adress-Speicherung).

Das vollständige Konzept inkl. Architekturentscheidungen liegt in [`docs/`](docs/); siehe insbesondere [`docs/verschluesselung.md`](docs/verschluesselung.md) für den Ende-zu-Ende-Verschlüsselungsfluss.

## Aufbau des Repos

```
backend/    Node.js/Express-API (Bestellungen, Zahlungs-Polling, Admin-Auth)
frontend/   Kunden-Shop (SvelteKit, adapter-node)
admin/      Admin-Panel (SvelteKit-SPA, adapter-static)
dev/        Mock-Dienste (Esplora, monero-wallet-rpc, Kursquelle)
infra/      docker-compose, Caddyfile, nftables.conf
docs/       Impressum/Datenschutz/Widerruf-Vorlagen, Verschlüsselungskonzept,
            Demo-PGP-Schlüsselpaar für lokale Entwicklung
```

## Kernprinzipien

- **Privacy by Design & by Default**: keine Analytics, keine Drittanbieter-Ressourcen, keine IP-Logs.
- **Ende-zu-Ende-Verschlüsselung**: Bestell- und Kontaktdaten werden clientseitig mit dem gepinnten PGP-Public-Key des Betreibers verschlüsselt, bevor sie das Backend erreichen.
- **Zusätzliche Verschlüsselung at rest**: der bereits PGP-verschlüsselte Payload wird zusätzlich mit AES-256-GCM in der Datenbank geschützt.
- **Nur Kryptowährungen**: Bitcoin on-chain mit watch-only HD-Wallet sowie Monero mit Subadressen über `monero-wallet-rpc`.
- **Getrennte Shop-/Admin-Domains**: Admin-Cookies sind `Secure`, `HttpOnly`, `SameSite=Strict` und in Produktion mit `__Host-`-Präfix gebunden.
- **Admin-2FA**: Argon2id-Passwort-Hashing plus TOTP; TOTP-Secrets werden mit einem separaten AES-256-GCM-Key verschlüsselt gespeichert.

## Lokale Entwicklung

Voraussetzung: Node.js 22+ und PostgreSQL.

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run migrate
npm run create-admin
npm run dev

# Kunden-Shop
cd frontend
npm install
npm run dev

# Admin-Panel
cd admin
npm install
npm run dev
```

`backend/.env` benötigt mindestens:

- `DATABASE_URL`
- `SESSION_SECRET` (mindestens 32 Zeichen)
- `AT_REST_KEY` (32-Byte-Hex)
- `TOTP_ENCRYPTION_KEY` (separater 32-Byte-Hex-Key)

Beide AES-Schlüssel **dürfen nicht identisch sein**.

Zum lokalen Testen liegt unter `frontend/static/pgp-public-key.asc` ein Demo-Public-Key. Der zugehörige private Demo-Key liegt in `docs/demo-keys/` und darf niemals produktiv verwendet werden. Für das PGP-Key-Pinning muss zusätzlich der passende Fingerprint als `PUBLIC_PGP_PUBLIC_KEY_FINGERPRINT` bzw. im Docker-Deployment über `PGP_PUBLIC_KEY_FINGERPRINT` gesetzt werden.

## Zahlungsablauf offline testen

Unter [`dev/mock-services/`](dev/mock-services/) liegen Mock-Dienste für Esplora, `monero-wallet-rpc` und die Kursquelle.

```bash
npm run mocks
```

Damit lassen sich Bitcoin- und Monero-Zahlungsabläufe ohne echtes Geld simulieren. Die produktive Payment-Verifikation bewertet Betrag und Bestätigungstiefe pro einzelner Transaktion bzw. pro Transfer gemeinsam; eine alte Kleinstzahlung kann deshalb nicht die Confirmations einer späteren größeren Zahlung übernehmen.

## Produktions-Deployment

Siehe [`infra/`](infra/). Beispiel:

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml --env-file .env up -d --build
docker compose -f infra/docker-compose.yml --env-file .env exec backend npm run migrate
docker compose -f infra/docker-compose.yml --env-file .env exec backend npm run create-admin
```

Vor dem Live-Betrieb zwingend:

1. Eigenes PGP-Schlüsselpaar erzeugen und `frontend/static/pgp-public-key.asc` ersetzen.
2. `PGP_PUBLIC_KEY_FINGERPRINT` passend zum produktiven Public Key setzen.
3. `TOTP_ENCRYPTION_KEY` separat mit `openssl rand -hex 32` erzeugen.
4. Rechtstexte im Admin-Panel vollständig mit echten Betreiberangaben ausfüllen und rechtlich prüfen.
5. `infra/Caddyfile`: ACME-E-Mail-Adresse und Domains anpassen.
6. `TRUST_PROXY_HOPS=1` hinter Caddy setzen; `CORS_ORIGINS` bleibt in dieser Topologie leer.
7. Bitcoin-/Monero-Konfiguration mit kleinen Testzahlungen verifizieren.
8. `DATA_RETENTION_DAYS` nicht blind als gesetzliche Archivierungsfrist verwenden; siehe unten.

## CI

`.github/workflows/ci.yml` prüft:

- Backend: `npm ci`, `npm run typecheck`, `npm run build`
- Frontend: `npm ci`, `npm run check`, `npm run build`
- Admin: `npm ci`, `npm run check`, `npm run build`

Der Security-Hardening-Branch wurde damit erfolgreich durch alle drei Jobs gebaut und typgeprüft.

## Sicherheits-Checkliste

Im Code umgesetzt sind unter anderem:

- strikte CSP ohne Fremd-CDNs
- Argon2id + TOTP für Admin-Logins
- verschlüsselte TOTP-Secrets
- gehashte Session-Tokens
- Login-/Checkout-/Kontakt-Rate-Limiting
- CSRF-Schutz via Origin-Prüfung + Double-Submit-Cookie
- serverseitige Zod-Validierung
- enge Request-Body-Limits
- Bild-Normalisierung zu WebP mit Pixel-Limit
- kein IP-Logging in Backend/Caddy
- Maskierung von Bestell-Tokens in Log-Pfaden
- atomare Lagerreservierung beim Checkout
- Zahlungspoller mit transaktionsbezogener Confirmation-Auswertung
- Expiry nur nach einem erfolgreichen und frischen Payment-Check

## Aufbewahrungsfrist — rechtlicher Hinweis

Der technische Standardwert `DATA_RETENTION_DAYS=14` ist nur für Entwicklung/Demo gedacht. Für einen produktiven Warenverkauf müssen gesetzlich aufzubewahrende Unterlagen separat berücksichtigt werden.

Stand 2026 gelten insbesondere für Buchungsbelege nach § 147 AO und § 257 HGB sowie Rechnungen nach § 14b UStG grundsätzlich **8 Jahre**; für bestimmte andere Unterlagen gelten weiterhin 10- oder 6-jährige Fristen. Der Fristbeginn richtet sich zudem nicht einfach nach dem Bestelltag.

Empfohlen ist deshalb eine getrennte Architektur: operative personenbezogene Shop-Daten möglichst kurz vorhalten und steuerlich/handelsrechtlich erforderliche Rechnungs- bzw. Buchungsdaten separat, auf das notwendige Minimum reduziert und entsprechend den gesetzlichen Anforderungen archivieren. Details siehe [`docs/datenschutz.md`](docs/datenschutz.md).
