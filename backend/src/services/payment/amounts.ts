/** Exact invoice amounts, including historical fractional-satoshi invoices. */
export function decimalToUnits(value: string, decimals: number): bigint {
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value.trim());
  if (!match) throw new Error("Ungültiger positiver Dezimalbetrag");
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? 0);
  if (Math.abs(exponent) > 100) throw new Error("Betrag außerhalb des Wertebereichs");
  const digits = BigInt(match[1]! + fraction);
  const shift = decimals + exponent - fraction.length;
  if (shift >= 0) return digits * 10n ** BigInt(shift);
  const divisor = 10n ** BigInt(-shift);
  return (digits + divisor - 1n) / divisor; // round up to payable atomic units
}

export function unitsToDecimal(units: bigint, decimals: number): string {
  const digits = units.toString().padStart(decimals + 1, "0");
  return `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
}

export function quoteCrypto(cents: bigint, eurPerCoin: number, decimals: number): string {
  if (cents <= 0n || !Number.isFinite(eurPerCoin) || eurPerCoin <= 0) throw new Error("Preis und Kurs müssen positiv sein");
  const rate = decimalToUnits(String(eurPerCoin), 12);
  const numerator = cents * 10n ** BigInt(decimals) * 10n ** 12n;
  const denominator = 100n * rate;
  return unitsToDecimal((numerator + denominator - 1n) / denominator, decimals);
}

export function toleratedTarget(amount: bigint): bigint {
  if (amount <= 0n) throw new Error("Zahlungsbetrag muss positiv sein");
  return (amount * 995n + 999n) / 1000n;
}

export function summarizePayments(payments: { amount: bigint; confirmations: number }[], target: bigint, depth: number) {
  const total = payments.reduce((sum, p) => sum + p.amount, 0n);
  const confirmed = payments.filter(p => p.confirmations >= depth).reduce((sum, p) => sum + p.amount, 0n);
  const depths = [...new Set(payments.map(p => p.confirmations))].sort((a, b) => b - a);
  // Confirmation depth belongs to a sufficient SUM, not to an unrelated tiny transfer.
  const confirmations = depths.find(d => payments.filter(p => p.confirmations >= d).reduce((s, p) => s + p.amount, 0n) >= target) ?? 0;
  return { anyReceived: total > 0n, confirmedEnough: confirmed >= target, confirmations };
}
