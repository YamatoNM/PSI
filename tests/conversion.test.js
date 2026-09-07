import { convertCurrency, calculateReverseRate } from "../currency-utils.js";

describe("Test 1 — currency conversion", () => {
  const rates = { USD: 1, EUR: 1.2345, GBP: 0.8 };

  test("converts a valid amount and currency pair", () => {
    expect(convertCurrency(100, "USD", "EUR", rates)).toBe(123.45);
  });

  test("rounds the result to exactly two decimals", () => {
    const result = convertCurrency(10.01, "USD", "EUR", rates);
    expect(result).toBe(12.36);
    expect(result.toFixed(2)).toBe("12.36");
  });

  test("returns zero for amount zero", () => {
    expect(convertCurrency(0, "USD", "EUR", rates)).toBe(0);
  });

  test.each([-1, -100])("rejects negative amount %s", (amount) => {
    expect(() => convertCurrency(amount, "USD", "EUR", rates)).toThrow();
  });

  test("handles non-numeric input gracefully", () => {
    expect(() => convertCurrency("invalid", "USD", "EUR", rates)).toThrow(
      "Amount must be a number"
    );
  });

  test("reports a missing target rate instead of returning NaN", () => {
    expect(() => convertCurrency(100, "USD", "CAD", rates)).toThrow(
      "Missing exchange rate"
    );
  });

  test("calculates the reverse rate independently of typed amount", () => {
    const referenceRate = calculateReverseRate("USD", "EUR", rates);
    expect(referenceRate).toBe(1.2345);
    expect(referenceRate).toBe(convertCurrency(100, "USD", "EUR", rates) / 100);
    expect(convertCurrency(1, "USD", "EUR", rates)).toBe(1.23);
  });
});
