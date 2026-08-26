/**
 * Live-Umrechnungskurse EUR -> BTC/XMR für die Preisanzeige und die
 * Berechnung des bei Checkout fälligen Krypto-Betrags.
 * Nutzt die öffentliche, kostenlose coingecko-API (kein Tracking-Cookie,
 * einfacher GET ohne Nutzerbezug).
 */

interface RateResponse {
  bitcoin: { eur: number };
  monero: { eur: number };
}

let cache: { rates: RateResponse; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

async function fetchRates(): Promise<RateResponse> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero&vs_currencies=eur"
  );
  if (!res.ok) {
    if (cache) return cache.rates; // stale-while-error
    throw new Error(`Kursabfrage fehlgeschlagen: HTTP ${res.status}`);
  }
  const rates = (await res.json()) as RateResponse;
  cache = { rates, fetchedAt: Date.now() };
  return rates;
}

export async function eurToBtc(amountEur: number): Promise<number> {
  const rates = await fetchRates();
  return amountEur / rates.bitcoin.eur;
}

export async function eurToXmr(amountEur: number): Promise<number> {
  const rates = await fetchRates();
  return amountEur / rates.monero.eur;
}
