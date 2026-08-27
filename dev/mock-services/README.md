# Mock-Dienste für die lokale Entwicklung

Bildet die drei externen Abhängigkeiten des Backends originalgetreu nach,
damit der komplette Zahlungsablauf **offline** getestet werden kann — ohne
echtes Geld, ohne öffentliche Nodes zu belasten und ohne Netzwerkzugriff.

| Port | Dienst | Entspricht |
|---|---|---|
| 9101 | Esplora-HTTP-API | `blockstream.info/api` |
| 9102 | `monero-wallet-rpc` (JSON-RPC) | lokale Wallet-RPC-Instanz |
| 9103 | Kursquelle | coingecko `simple/price` |
| 9100 | Steuer-API | *kein* echtes Gegenstück — simuliert Zahlungen |

## Starten

```bash
npm run mocks          # aus dem Repo-Root
# oder: node dev/mock-services/server.mjs
```

Passende Werte in `backend/.env`:

```
BTC_ESPLORA_URL=http://127.0.0.1:9101
XMR_WALLET_RPC_URL=http://127.0.0.1:9102/json_rpc
RATES_API_URL=http://127.0.0.1:9103/price
PAYMENT_POLL_INTERVAL_MS=2000
```

## Zahlungen simulieren

Die Steuer-API auf Port 9100 erzeugt Zahlungseingänge und Blöcke:

```bash
# Bitcoin: Zahlung in den Mempool (unbestätigt)
curl -X POST localhost:9100/btc/pay -H 'Content-Type: application/json' \
  -d '{"address":"bc1q...","sats":171173,"confirmed":false}'

# Monero: Zahlung auf eine Subadresse (Index aus orders.derivation_index)
curl -X POST localhost:9100/xmr/pay -H 'Content-Type: application/json' \
  -d '{"addressIndex":1,"atomic":700427260629,"confirmed":false}'

# Ausstehende Transaktionen in den nächsten Block aufnehmen
curl -X POST localhost:9100/confirm-pending

# Weitere Blöcke -> mehr Bestätigungen
curl -X POST localhost:9100/mine -H 'Content-Type: application/json' -d '{"blocks":5}'

curl localhost:9100/state     # aktueller Zustand
curl -X POST localhost:9100/reset
```

## Damit verifizierter Ablauf

Beide Zahlungswege wurden vollständig durchgespielt:

- **Bitcoin**: `pending` → `confirming` (Mempool) → `confirming` (1 Bestätigung)
  → `paid` (2 Bestätigungen, `BTC_REQUIRED_CONFIRMATIONS`)
- **Monero**: Subadresse über `create_address`, Pool-Zahlung → `confirming`
  → bei 9 Bestätigungen weiterhin `confirming` → `paid` bei 10
  (`XMR_REQUIRED_CONFIRMATIONS`)
- **Unterzahlung**: 10 % zu wenig wird trotz ausreichender Bestätigungen
  nicht als bezahlt gewertet (Toleranz: 0,5 %)

> Die Mocks sind ein reines Entwicklungswerkzeug und werden im
> Produktionsbetrieb nie eingesetzt — dort stehen in der `.env` die echten
> Endpunkte (siehe `.env.example`).
