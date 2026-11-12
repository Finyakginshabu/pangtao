/**
 * API boundary conversion for integer satang (NFR-03). Prisma returns BIGINT as `bigint`,
 * which JSON cannot carry; every amount fits a safe integer (|x| ≤ 2^53 − 1), so it is
 * sent as a JSON number. A value outside that range is a bug, never silently rounded.
 */
export function satangToJson(value: bigint): number {
  const asNumber = Number(value);
  if (!Number.isSafeInteger(asNumber)) {
    throw new Error('Satang amount exceeds the safe integer range');
  }
  return asNumber;
}
