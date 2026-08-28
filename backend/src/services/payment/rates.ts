import { fetchJson } from "../../lib/http.ts";
import { env } from "../../lib/env.ts";
import { logger } from "../../lib/logger.ts";

/**
 * Live-Umrechnungskurse EUR -> BTC/XMR für die Preisanzeige und die
 * Berechnung des bei Checkout fälligen Krypto-Betrags.
 *
 * Standardquelle ist die öffentliche coingecko-API (einfacher GET ohne
 * Nutzerbezug, kein Tracking-Cookie). Die URL ist konfigurierbar, damit
 * eine andere/selbst gehostete Kursquelle eingesetzt werden kann – das
 * ist zugleich der einzige verbleibende Drittanbieter im Bestellweg.
 */

export class RateUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateUnavailableError";
  }
}

interface RateResponse {
  bitcoin: { eur: number };
  monero: { eur: number };
}

let cache: { rates: RateResponse; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

function isValid(rates: RateResponse | undefined): rates is RateResponse {
  return !!rates && (
    Number.isFinite(rates?.bitcoin?.eur) &&
    rates.bitcoin.eur > 0 &&
    Number.isFinite(rates?.monero?.eur) &&
    rates.monero.eur > 0
  );
}

export async function fetchRates(): Promise<RateResponse> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  try {
    const rates = await fetchJson<RateResponse>(env.RATES_API_URL);
    if (!isValid(rates)) throw new Error("Unerwartetes Antwortformat der Kursquelle");

    cache = { rates, fetchedAt: Date.now() };
    return rates;
  } catch (err) {
    // Bei einem Ausfall der Kursquelle lieber einen leicht veralteten
    // Kurs verwenden als den Bestellvorgang komplett zu blockieren.
    if (cache && Date.now() - cache.fetchedAt <= env.RATES_MAX_AGE_MS) {
      logger.warn({ err }, "Kursabfrage fehlgeschlagen – verwende zwischengespeicherten Kurs");
      return cache.rates;
    }
    throw new RateUnavailableError(
      `Kurse sind derzeit nicht abrufbar: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function eurToBtc(amountEur: number): Promise<number> {
  const rates = await fetchRates();
  return amountEur / rates.bitcoin.eur;
}

export async function eurToXmr(amountEur: number): Promise<number> {
  const rates = await fetchRates();
  return amountEur / rates.monero.eur;
}
