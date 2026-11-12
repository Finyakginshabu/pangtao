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
