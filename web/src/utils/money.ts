/**
 * Display-only formatting of integer satang as THB (NFR-03): `1234550` → `12,345.50 ฿`,
 * `-123450` → `-1,234.50 ฿`. Uses BigInt division, never floating-point arithmetic.
 */
export function formatSatang(satang: number): string {
  if (!Number.isSafeInteger(satang)) {
    throw new Error('Amount must be an integer number of satang');
  }
  const value = BigInt(satang);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const baht = (magnitude / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const satangPart = (magnitude % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${baht}.${satangPart} ฿`;
}

/**
 * Display-only formatting with an explicit plus sign for positive values (f-08 §2.2):
 * `3000000` → `+30,000.00 ฿`, `-120000` → `-1,200.00 ฿`, `0` → `0.00 ฿`.
 */
export function formatSignedSatang(satang: number): string {
  const formatted = formatSatang(satang);
  return satang > 0 ? `+${formatted}` : formatted;
}

const THB_INPUT = /^\d+(?:\.\d{1,2})?$/;

/**
 * Parses user-entered THB (`50000`, `50000.5`, `1,000.50`) into integer satang.
 * Uses BigInt arithmetic, never floating point. Returns null for anything that is
 * not a non-negative amount with at most two decimal places, so the caller can
 * show an inline validation message (f-04 §2.2).
 */
export function parseThbToSatang(input: string): number | null {
  const normalized = input.trim().replace(/,/g, '');
  if (!THB_INPUT.test(normalized)) return null;

  const [bahtPart, satangPart = ''] = normalized.split('.');
  const satang = BigInt(bahtPart) * 100n + BigInt(satangPart.padEnd(2, '0'));
  const value = Number(satang);
  return Number.isSafeInteger(value) ? value : null;
}
