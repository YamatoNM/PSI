import {
  DEFAULT_CODES,
  loadFavorites,
  removeFavorite,
  saveFavorites,
  toggleFavorite,
} from "../favorites.js";

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

describe("Test 3 — favorite currencies", () => {
  test("adding a favorite persists it in localStorage", () => {
    const storage = new MapStorage();

    toggleFavorite(storage, "jpy");

    expect(loadFavorites(storage)).toEqual(["JPY"]);
  });

  test("star toggle removes a favorite from storage and the UI state", () => {
    const storage = new MapStorage();
    toggleFavorite(storage, "JPY");

    const remaining = toggleFavorite(storage, "JPY");

    expect(remaining).not.toContain("JPY");
    expect(loadFavorites(storage)).not.toContain("JPY");
  });

  test("removing through the quick-select chip has the same effect", () => {
    const storage = new MapStorage();
    toggleFavorite(storage, "JPY");

    removeFavorite(storage, "JPY");

    expect(loadFavorites(storage)).not.toContain("JPY");
  });

  test("favorites persist across a simulated page reload", () => {
    const storage = new MapStorage();
    toggleFavorite(storage, "JPY");

    expect(loadFavorites(storage)).toEqual(["JPY"]);
  });

  test("duplicate favorites are not added twice", () => {
    const storage = new MapStorage();
    saveFavorites(storage, ["JPY", "jpy", "JPY"]);

    expect(loadFavorites(storage)).toEqual(["JPY"]);
  });

  test("default currencies remain available without favorites", () => {
    const storage = new MapStorage();

    expect(DEFAULT_CODES).toEqual(expect.arrayContaining(["EUR", "USD", "GBP", "RON"]));
    expect(loadFavorites(storage)).toEqual([]);
  });
});
