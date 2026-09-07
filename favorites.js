const FAVORITES_KEY = "cc:favorites";

export function loadFavorites(storage) {
  try {
    const value = JSON.parse(storage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value)
      ? [...new Set(value.map((code) => String(code).toUpperCase()))]
      : [];
  } catch {
    return [];
  }
}

export function saveFavorites(storage, favorites) {
  storage.setItem(
    FAVORITES_KEY,
    JSON.stringify([...new Set(favorites.map((code) => String(code).toUpperCase()))])
  );
}

export function toggleFavorite(storage, code) {
  const normalized = String(code).toUpperCase();
  const favorites = loadFavorites(storage);
  const next = favorites.includes(normalized)
    ? favorites.filter((item) => item !== normalized)
    : [...favorites, normalized];

  saveFavorites(storage, next);
  return next;
}

export function removeFavorite(storage, code) {
  const normalized = String(code).toUpperCase();
  const next = loadFavorites(storage).filter((item) => item !== normalized);
  saveFavorites(storage, next);
  return next;
}

export const DEFAULT_CODES = ["EUR", "USD", "GBP", "RON"];
