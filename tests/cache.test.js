import { jest } from "@jest/globals";
import {
  cacheRates,
  fetchRatesWithFallback,
  readCachedRates,
} from "../rate-cache.js";

const rates = { usd: 1, eur: 0.92 };

function createStorage() {
  return new MapStorage();
}

class MapStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

describe("Test 2 — cache and offline fallback", () => {
  test("successful fetch stores rates, date, and base currency", async () => {
    const storage = createStorage();
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ date: "2026-09-07", rates }),
    });

    const result = await fetchRatesWithFallback({
      base: "USD",
      fetchImpl,
      storage,
    });

    expect(readCachedRates(storage, "USD")).toEqual({
      base: "USD",
      date: "2026-09-07",
      rates,
    });
    expect(result.stale).toBe(false);
  });

  test("network failure falls back to cached rates for the same base", async () => {
    const storage = createStorage();
    cacheRates(storage, { base: "USD", date: "2026-09-06", rates });

    const result = await fetchRatesWithFallback({
      base: "USD",
      fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      storage,
    });

    expect(result.rates).toEqual(rates);
    expect(result.stale).toBe(true);
  });

  test("fallback reports the correct cached date", async () => {
    const storage = createStorage();
    cacheRates(storage, { base: "USD", date: "2026-09-01", rates });
    const onOffline = jest.fn();

    await fetchRatesWithFallback({
      base: "USD",
      fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      storage,
      onOffline,
    });

    expect(onOffline).toHaveBeenCalledWith("2026-09-01");
  });

  test("missing cache returns a clear error instead of crashing", async () => {
    const onError = jest.fn();

    await expect(
      fetchRatesWithFallback({
        base: "USD",
        fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
        storage: createStorage(),
        onError,
      })
    ).resolves.toMatchObject({ error: expect.stringContaining("no saved copy") });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("no saved copy"));
  });

  test("a different base currency cache is not used", async () => {
    const storage = createStorage();
    cacheRates(storage, {
      base: "EUR",
      date: "2026-09-01",
      rates: { eur: 1, usd: 1.09 },
    });

    const result = await fetchRatesWithFallback({
      base: "USD",
      fetchImpl: jest.fn().mockRejectedValue(new Error("offline")),
      storage,
    });

    expect(result.error).toContain("no saved copy");
  });
});
