export function cacheRates(storage, data) {
  const key = `cc:rates:${String(data.base).toLowerCase()}`;
  storage.setItem(
    key,
    JSON.stringify({
      base: data.base,
      date: data.date,
      rates: data.rates,
    })
  );
}

export function readCachedRates(storage, base) {
  const key = `cc:rates:${String(base).toLowerCase()}`;
  const raw = storage.getItem(key);

  if (!raw) return null;

  try {
    const cached = JSON.parse(raw);
    return cached && cached.rates ? cached : null;
  } catch {
    return null;
  }
}

export async function fetchRatesWithFallback({
  base,
  fetchImpl,
  storage,
  onOffline = () => {},
  onError = () => {},
}) {
  try {
    const response = await fetchImpl(base);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const rates = data?.rates ?? data?.[String(base).toLowerCase()];

    if (!rates) throw new Error("Unexpected API response format");

    const result = {
      base,
      date: data.date || "unknown date",
      rates,
      stale: false,
    };

    cacheRates(storage, result);
    return result;
  } catch (error) {
    const cached = readCachedRates(storage, base);

    if (cached) {
      const result = { ...cached, stale: true };
      onOffline(cached.date);
      return result;
    }

    const message =
      `Couldn't load rates for ${base} and no saved copy is available. ` +
      `Check your connection and try again.`;
    onError(message);
    return { error: message, stale: false };
  }
}
