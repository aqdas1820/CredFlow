/**
 * Calculate a hypothetical swipe fee in integer paise, rounding the fee to
 * the nearest paise (half up) once. All returned rupee amounts have two-decimal
 * precision. Invalid user-entered values return null, never NaN or Infinity.
 *
 * @param {number} grossRupees
 * @param {number} feePercent
 * @returns {{gross: number, fee: number, net: number} | null}
 */
export function calculateSwipeAmounts(grossRupees, feePercent) {
  if (!Number.isFinite(grossRupees) || grossRupees <= 0 ||
      !Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
    return null;
  }

  const grossPaise = Math.round(grossRupees * 100);
  // Reject fractional-paise inputs and values too large for precise arithmetic.
  if (!Number.isSafeInteger(grossPaise) || grossPaise <= 0 ||
      grossPaise > Number.MAX_SAFE_INTEGER / 100 ||
      Math.abs(grossRupees - grossPaise / 100) > 1e-8) {
    return null;
  }

  const feePaise = Math.round((grossPaise * feePercent) / 100);
  return {
    gross: grossPaise / 100,
    fee: feePaise / 100,
    net: (grossPaise - feePaise) / 100,
  };
}
