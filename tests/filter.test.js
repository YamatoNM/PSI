import { filterCurrencyMap } from "../currency-list.js";
import { CURRENT_ISO_CURRENCIES } from "../config.js";

const activeCodes = CURRENT_ISO_CURRENCIES;
const defaults = ["EUR", "USD", "GBP", "RON"];

describe("Test 4 — currency list filtering", () => {
  test("excludes defunct currencies from the API response", () => {
    const result = filterCurrencyMap(
      { ITL: "Italian Lira", ROL: "Old Leu", DEM: "German Mark", FRF: "French Franc", EUR: "Euro" },
      activeCodes,
      defaults
    );

    expect(Object.keys(result)).toEqual(["EUR"]);
  });

  test("keeps currently active currencies", () => {
    const result = filterCurrencyMap(
      { EUR: "Euro", USD: "Dollar", RON: "Leu", GBP: "Pound", JPY: "Yen" },
      activeCodes,
      defaults
    );

    expect(Object.keys(result)).toEqual(["EUR", "USD", "RON", "GBP", "JPY"]);
  });

  test("returns an empty object for empty or malformed input", () => {
    for (const input of [null, undefined, [], "invalid", 42]) {
      expect(filterCurrencyMap(input, activeCodes, defaults)).toEqual({});
    }
  });

  test("keeps lowercase active currency codes case-insensitively", () => {
    const result = filterCurrencyMap(
      { eur: "Euro", usd: "Dollar", ron: "Leu", gbp: "Pound", jpy: "Yen", itl: "Lira" },
      activeCodes,
      defaults
    );

    expect(Object.keys(result)).toEqual(["eur", "usd", "ron", "gbp", "jpy"]);
  });
});
