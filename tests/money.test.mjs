import test from "node:test";
import assert from "node:assert/strict";
import { calculateSwipeAmounts } from "../lib/money.mjs";

test("fees and net amounts are rounded to the nearest paise once", () => {
  assert.deepEqual(calculateSwipeAmounts(100.10, 1.5), {
    gross: 100.1, fee: 1.5, net: 98.6,
  });
  assert.deepEqual(calculateSwipeAmounts(0.05, 50), {
    gross: 0.05, fee: 0.03, net: 0.02,
  });
  assert.deepEqual(calculateSwipeAmounts(1000.01, 1.5), {
    gross: 1000.01, fee: 15, net: 985.01,
  });
});

test("zero and full fees preserve the exact paise total", () => {
  assert.deepEqual(calculateSwipeAmounts(234.56, 0), {
    gross: 234.56, fee: 0, net: 234.56,
  });
  assert.deepEqual(calculateSwipeAmounts(234.56, 100), {
    gross: 234.56, fee: 234.56, net: 0,
  });
});

test("invalid amounts or fee percentages cannot produce a swipe", () => {
  for (const gross of [-1, 0, 0.001, 1.234, Infinity, NaN, Number.MAX_SAFE_INTEGER]) {
    assert.equal(calculateSwipeAmounts(gross, 1.5), null);
  }
  for (const fee of [-1, 100.01, NaN, Infinity]) {
    assert.equal(calculateSwipeAmounts(100, fee), null);
  }
});

test("fee and net always add back to gross in paise", () => {
  for (const amount of [0.01, 0.05, 10, 100.1, 999999.99]) {
    for (const rate of [0, 0.5, 1.5, 33.33, 99.99, 100]) {
      const result = calculateSwipeAmounts(amount, rate);
      assert.ok(result);
      assert.equal(Math.round(result.fee * 100) + Math.round(result.net * 100), Math.round(result.gross * 100));
    }
  }
});
