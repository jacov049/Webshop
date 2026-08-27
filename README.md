# CryptoShop

Datensparsamer Krypto-Webshop mit clientseitiger PGP-Verschlüsselung, Bitcoin-/Monero-Zahlungen, Admin-Panel und gehärtetem Single-VPS-Deployment.

## Wichtige Sicherheits-/Deployment-Hinweise

Vor einem produktiven Einsatz müssen mindestens folgende Punkte erfüllt sein:

- `TOTP_ENCRYPTION_KEY` als eigener zufälliger 32-Byte-Hex-Key setzen; nicht mit `AT_REST_KEY` wiederverwenden.
- `PGP_PUBLIC_KEY_FINGERPRINT` passend zu `frontend/static/pgp-public-key.asc` setzen.
- Echte Shop-/Admin-Domains konfigurieren und TLS über Caddy prüfen.
- Rechtstexte im Admin-Panel vollständig mit den tatsächlichen Betreiberangaben ausfüllen und vor Live-Betrieb rechtlich prüfen.
- `DATA_RETENTION_DAYS=14` ist nur ein Entwicklungs-/Demowert. Gesetzlich erforderliche Rechnungs-/Buchungsdaten müssen separat und entsprechend der jeweils geltenden Fristen archiviert werden.
- Bitcoin-/Monero-Wallet-/Node-Konfiguration mit kleinen Testzahlungen verifizieren, bevor echte Bestellungen angenommen werden.

## CI

Die GitHub-Actions-Workflowdatei `.github/workflows/ci.yml` führt für Backend, Frontend und Admin jeweils Installation, Type-/Svelte-Checks und Produktions-Builds aus, sofern GitHub Actions für das Repository aktiviert ist.

Weitere technische Hinweise stehen in `docs/` sowie den jeweiligen `.env.example`-Dateien.
