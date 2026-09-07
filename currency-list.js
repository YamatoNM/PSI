export function filterCurrencyMap(rawMap, activeCodes = [], extraCodes = []) {
  if (!rawMap || typeof rawMap !== "object" || Array.isArray(rawMap)) {
    return {};
  }

  const allowed = new Set([
    ...activeCodes,
    ...extraCodes,
  ].map((code) => String(code).toLowerCase()));

  return Object.fromEntries(
    Object.entries(rawMap).filter(([code]) => allowed.has(code.toLowerCase()))
  );
}
