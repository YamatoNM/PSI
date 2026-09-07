// ============================================================
//  Currency Exchange — plain JS (ES module)
//  All API URLs come from config.js — never hardcode one here.
// ============================================================

import {
  API_LATEST_BASE,
  API_HISTORICAL_BASE,
  CURRENT_ISO_CURRENCIES,
} from "./config.js";
import { debounce as debounceFn } from "./debounce.js";
import { filterCurrencyMap as filterCurrencyMapBase } from "./currency-list.js";
import {
  cacheRates as cacheRatesBase,
  readCachedRates as readCachedRatesBase,
} from "./rate-cache.js";

// Set of active currency codes for O(1) lookups.
const ACTIVE_CURRENCIES = new Set(CURRENT_ISO_CURRENCIES.map((c) => c.toLowerCase()));

// Derived endpoint for the master currency list.
const CURRENCY_LIST_URL = `${API_LATEST_BASE}.json`;

// Default quick-select currencies (always shown, in this order).
const DEFAULT_CODES = ["EUR", "USD", "GBP", "RON", "MDL"];

// localStorage keys.
const LS_FAVORITES = "cc:favorites";
const lsRatesKey = (base) => `cc:rates:${base.toLowerCase()}`;

// Currency symbols keyed by lowercase ISO code.
const CURRENCY_SYMBOLS = {
  usd: "$", eur: "€", gbp: "£", jpy: "¥", chf: "Fr",
  ron: "lei", mdl: "L", cny: "¥", aud: "A$", cad: "C$",
  nzd: "NZ$", hkd: "HK$", sgd: "S$", inr: "₹", rub: "₽",
  krw: "₩", brl: "R$", zar: "R", try: "₺", uah: "₴",
  pln: "zł", huf: "Ft", czk: "Kč", sek: "kr", nok: "kr",
  dkk: "kr", ils: "₪", thb: "฿", php: "₱", idr: "Rp",
  myr: "RM", mxn: "$", vnd: "₫", ngn: "₦", bgn: "лв",
};

/* ------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------ */

/** Symbol for a currency code, or "" when none is known. */
function symbolFor(code) {
  return CURRENCY_SYMBOLS[code.toLowerCase()] || "";
}

/** Full name for a code from the loaded list, falling back to the code. */
function nameFor(code) {
  return CURRENCY_NAMES[code.toLowerCase()] || code.toUpperCase();
}

/** Derive a flag emoji from the first two letters of a currency code. */
function flagFor(code) {
  const cc = code.slice(0, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Format a unit exchange rate with sensible precision. */
function formatRate(n) {
  if (!isFinite(n)) return "—";
  if (n >= 100) return n.toFixed(2);
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

/** Rate with trailing zeros trimmed — used for compact chart labels/tooltips. */
function trimRate(n) {
  if (!isFinite(n)) return "—";
  const digits = n >= 100 ? 2 : n >= 1 ? 4 : 6;
  return String(Number(n.toFixed(digits)));
}

/** Clamp a number to [lo, hi]. */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** "2026-09-03" -> "Sep 3, 2026". */
function formatDay(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d)
    ? iso
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Minimal escaping for text placed inside an SVG attribute. */
function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const money = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
/** Format a converted money amount, rounded to 2 decimals. */
const fmtMoney = (n) => money.format(n);

/** Generic debounce. */
const debounce = debounceFn;
export { debounce };

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersReduced = () => reducedMotion.matches;

/* ------------------------------------------------------------
   DOM references
   ------------------------------------------------------------ */
const amountInput = document.getElementById("amount");
const fromSelect = document.getElementById("from");
const toSelect = document.getElementById("to");
const fromQuickRow = document.getElementById("from-quick");
const toQuickRow = document.getElementById("to-quick");
const fromFavRow = document.getElementById("from-fav");
const toFavRow = document.getElementById("to-fav");
const fromListEl = document.getElementById("from-list");
const toListEl = document.getElementById("to-list");
const fromFilter = document.getElementById("from-filter");
const toFilter = document.getElementById("to-filter");
const swapButton = document.getElementById("swap");
const moreToggles = document.querySelectorAll(".more-toggle");

const loadingEl = document.getElementById("loading");
const offlineEl = document.getElementById("offline");
const errorEl = document.getElementById("error");
const resultMainEl = document.getElementById("result-main");
const reverseEl = document.getElementById("reverse");
const resultDateEl = document.getElementById("result-date");

const trendBodyEl = document.getElementById("trend-body");
const trendMetaEl = document.getElementById("trend-meta");
const trendSrEl = document.getElementById("trend-sr");
const trendRangeBtns = document.querySelectorAll(".trend-range-btn");

/* ------------------------------------------------------------
   State
   ------------------------------------------------------------ */
// currentData: { base, date, rates, stale } — rates maps lowercase code -> rate.
let currentData = null;
let CURRENCY_NAMES = {}; // lowercase code -> name
let favorites = loadFavorites(); // array of uppercase codes
let trendDays = 7;
let shownValue = null; // last converted number rendered (for count animation)
let valueRaf = 0; // running rAF id for the count animation
let trendReqId = 0; // guards against out-of-order trend responses
let sparkTipTimer = 0; // auto-hides the sparkline tooltip after a tap

/* ------------------------------------------------------------
   localStorage: favorites + rate cache
   ------------------------------------------------------------ */
function loadFavorites() {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_FAVORITES) || "[]");
    return Array.isArray(arr) ? arr.map((c) => String(c).toUpperCase()) : [];
  } catch {
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(LS_FAVORITES, JSON.stringify(favorites));
  } catch {
    /* storage unavailable — favorites just won't persist */
  }
}

/** Cache a successful fetch, keyed by base currency. */
function cacheRates(data) {
  try {
    cacheRatesBase(localStorage, data);
  } catch {
    /* ignore */
  }
}

/** Read cached rates for a base currency, or null. */
function readCachedRates(base) {
  try {
    return readCachedRatesBase(localStorage, base);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   Currency list (dropdowns)
   ------------------------------------------------------------ */

/** Fill a <select> with every currency code, marking `selected`. */
function populateSelect(selectEl, selected) {
  selectEl.innerHTML = "";
  for (const lc of Object.keys(CURRENCY_NAMES).sort()) {
    const upper = lc.toUpperCase();
    const sym = symbolFor(lc);
    const opt = document.createElement("option");
    opt.value = upper;
    opt.textContent = `${upper}${sym ? ` (${sym})` : ""} — ${CURRENCY_NAMES[lc] || upper}`;
    if (upper === selected) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

/** Minimal offline fallback list if the master list request fails. */
function fallbackCurrencyNames() {
  return {
    eur: "Euro", usd: "US Dollar", gbp: "Pound Sterling", ron: "Romanian Leu",
    mdl: "Moldovan Leu", chf: "Swiss Franc", jpy: "Japanese Yen",
    aud: "Australian Dollar", cad: "Canadian Dollar", cny: "Chinese Yuan",
    pln: "Polish Zloty", huf: "Hungarian Forint", sek: "Swedish Krona",
  };
}

/**
 * Keep only currently-active currencies (plus the default quick codes and
 * any codes the user has already favorited — those are known-good).
 * This drops obsolete API entries like ITL, DEM, FRF, ROL, ...
 */
export function filterCurrencyMap(rawMap) {
  return filterCurrencyMapBase(rawMap, ACTIVE_CURRENCIES, [
    ...DEFAULT_CODES,
    ...favorites,
  ]);
}

/** Fetch the master currency list; fall back to a small built-in map. */
async function loadCurrencyList() {
  let rawMap;
  try {
    const res = await fetch(CURRENCY_LIST_URL);
    if (!res.ok) throw new Error(`status ${res.status}`);
    rawMap = await res.json();
  } catch (err) {
    console.error("Currency list failed, using fallback:", err);
    rawMap = fallbackCurrencyNames();
  }
  CURRENCY_NAMES = filterCurrencyMap(rawMap);
  populateSelect(fromSelect, "EUR");
  populateSelect(toSelect, "USD");
}

/* ------------------------------------------------------------
   "More currencies" list with favorite stars
   ------------------------------------------------------------ */

/** Build the scrollable currency list (pick + star per row) for one side. */
function buildCurrencyList(side) {
  const listEl = side === "from" ? fromListEl : toListEl;
  listEl.innerHTML = "";
  for (const lc of Object.keys(CURRENCY_NAMES).sort()) {
    const code = lc.toUpperCase();
    const li = document.createElement("li");
    li.className = "cur-row";
    li.dataset.code = code;
    li.dataset.search = `${code} ${CURRENCY_NAMES[lc] || ""}`.toLowerCase();

    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "cur-pick";
    const sym = symbolFor(lc);
    pick.textContent = `${code}${sym ? ` ${sym}` : ""} — ${CURRENCY_NAMES[lc] || code}`;
    pick.addEventListener("click", () => selectCurrency(side, code));

    const star = document.createElement("button");
    star.type = "button";
    star.className = "cur-star";
    star.textContent = "★";
    star.addEventListener("click", () => toggleFavorite(code));

    li.append(pick, star);
    listEl.appendChild(li);
  }
  syncCurrencyList(side);
}

/** Refresh selected/favorite state + labels in one side's currency list. */
function syncCurrencyList(side) {
  const listEl = side === "from" ? fromListEl : toListEl;
  const current = (side === "from" ? fromSelect : toSelect).value;
  listEl.querySelectorAll(".cur-row").forEach((li) => {
    const code = li.dataset.code;
    const selected = code === current;
    li.classList.toggle("selected", selected);

    const pick = li.querySelector(".cur-pick");
    pick.setAttribute("aria-current", selected ? "true" : "false");

    const star = li.querySelector(".cur-star");
    const fav = isFavorite(code);
    star.classList.toggle("on", fav);
    star.setAttribute("aria-pressed", fav ? "true" : "false");
    star.setAttribute(
      "aria-label",
      `${fav ? "Remove" : "Add"} ${nameFor(code)} ${fav ? "from" : "to"} favorites`
    );
  });
}

/** Filter one side's list by code/name substring. */
function filterList(side, query) {
  const listEl = side === "from" ? fromListEl : toListEl;
  const q = query.trim().toLowerCase();
  listEl.querySelectorAll(".cur-row").forEach((li) => {
    li.hidden = q !== "" && !li.dataset.search.includes(q);
  });
}

/* ------------------------------------------------------------
   Quick-select buttons (defaults + favorites)
   ------------------------------------------------------------ */

/** Create one quick-select button. */
function makeQuickButton(side, code, isFavButton) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "quick-btn" + (isFavButton ? " is-fav" : "");
  btn.dataset.code = code;

  const flag = flagFor(code);
  const sym = symbolFor(code);
  btn.innerHTML =
    (flag ? `<span class="qb-flag" aria-hidden="true">${flag}</span>` : "") +
    `<span class="qb-code">${code}</span>` +
    (sym ? `<span class="qb-sym" aria-hidden="true">${sym}</span>` : "") +
    (isFavButton ? `<span class="fav-badge" aria-hidden="true">★</span>` : "");

  btn.setAttribute(
    "aria-label",
    `${side === "from" ? "Set base currency to" : "Set target currency to"} ${nameFor(code)}`
  );
  btn.addEventListener("click", () => selectCurrency(side, code));
  return btn;
}

/** Build the fixed default quick row for one side. */
function buildDefaultQuickRow(side) {
  const row = side === "from" ? fromQuickRow : toQuickRow;
  row.innerHTML = "";
  for (const code of DEFAULT_CODES) row.appendChild(makeQuickButton(side, code, false));
}

/**
 * A favorite chip = the quick-select button + a small "×" that unpins the
 * currency straight from the row (no need to reopen the dropdown).
 */
function makeFavoriteChip(side, code) {
  const chip = document.createElement("span");
  chip.className = "fav-chip";
  chip.dataset.code = code;

  const main = makeQuickButton(side, code, true);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "fav-remove";
  remove.textContent = "×";
  remove.title = `Unpin ${nameFor(code)}`;
  remove.setAttribute("aria-label", `Unpin ${nameFor(code)} from quick access`);
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    unpinFavorite(chip, code);
  });

  chip.append(main, remove);
  return chip;
}

/** Build the favorites quick row (extras only) for one side. */
function buildFavoriteRow(side) {
  const row = side === "from" ? fromFavRow : toFavRow;
  const extras = favorites.filter((c) => !DEFAULT_CODES.includes(c));
  row.innerHTML = "";
  if (extras.length === 0) {
    row.hidden = true;
    return;
  }
  row.hidden = false;
  for (const code of extras) row.appendChild(makeFavoriteChip(side, code));
}

/** Fade a favorite chip out, then remove it from favorites everywhere. */
function unpinFavorite(chipEl, code) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    toggleFavorite(code); // removes from localStorage + rebuilds rows + dropdown stars
  };

  if (prefersReduced()) {
    finish();
    return;
  }
  chipEl.classList.add("removing");
  chipEl.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 260); // fallback if transitionend doesn't fire
}

/** Refresh active state on every quick button + the list for one side. */
function syncSide(side) {
  const value = (side === "from" ? fromSelect : toSelect).value;
  const rows = side === "from" ? [fromQuickRow, fromFavRow] : [toQuickRow, toFavRow];
  rows.forEach((row) =>
    row.querySelectorAll(".quick-btn").forEach((btn) => {
      const active = btn.dataset.code === value;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    })
  );
  syncCurrencyList(side);
}

/* ------------------------------------------------------------
   Favorites
   ------------------------------------------------------------ */
const isFavorite = (code) => favorites.includes(code.toUpperCase());

/** Add/remove a currency from favorites and re-render everything that shows them. */
function toggleFavorite(code) {
  code = code.toUpperCase();
  favorites = isFavorite(code)
    ? favorites.filter((c) => c !== code)
    : [...favorites, code];
  saveFavorites();
  buildFavoriteRow("from");
  buildFavoriteRow("to");
  syncSide("from");
  syncSide("to");
}

/* ------------------------------------------------------------
   Selection
   ------------------------------------------------------------ */

/** Set a side's currency from any source, then run the matching change logic. */
function selectCurrency(side, code) {
  const select = side === "from" ? fromSelect : toSelect;
  if (select.value === code) return;
  select.value = code;
  if (side === "from") onFromChange();
  else onToChange();
}

/* ------------------------------------------------------------
   Status helpers
   ------------------------------------------------------------ */
function setLoading(isLoading) {
  loadingEl.hidden = !isLoading;
}

function showOffline(cachedDate) {
  offlineEl.textContent = `Showing last known rates from ${cachedDate} — currently offline.`;
  offlineEl.hidden = false;
}
function hideOffline() {
  offlineEl.hidden = true;
  offlineEl.textContent = "";
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  resultMainEl.textContent = "—";
  resultDateEl.textContent = "";
  reverseEl.hidden = true;
  shownValue = null;
}
function hideError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

/* ------------------------------------------------------------
   Fetch latest rates (with offline fallback)
   ------------------------------------------------------------ */
async function fetchRates(baseCurrency) {
  const base = baseCurrency.toLowerCase();
  setLoading(true);
  hideError();

  try {
    const res = await fetch(`${API_LATEST_BASE}/${base}.json`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

    const data = await res.json();
    const rates = data[base];
    if (!rates) throw new Error("Unexpected API response format");

    currentData = { base: baseCurrency, date: data.date || "unknown date", rates, stale: false };
    cacheRates(currentData);
    hideOffline();
    updateResult();
  } catch (err) {
    console.error(err);
    const cached = readCachedRates(base);
    if (cached) {
      // Fall back to the last known rates for this base currency.
      currentData = { base: cached.base, date: cached.date, rates: cached.rates, stale: true };
      showOffline(cached.date);
      updateResult();
    } else {
      // Nothing cached — show a clean error state, not a broken UI.
      currentData = null;
      showError(
        `Couldn't load rates for ${baseCurrency} and no saved copy is available. ` +
          `Check your connection and try again.`
      );
      clearTrend("Trend unavailable while offline.");
    }
  } finally {
    setLoading(false);
  }

  if (currentData) scheduleTrend();
}

/* ------------------------------------------------------------
   Conversion + result rendering
   ------------------------------------------------------------ */

/** Animate the converted number from its previous value to `target`. */
function animateConverted(el, target) {
  cancelAnimationFrame(valueRaf);
  const from = shownValue == null || !isFinite(shownValue) ? target : shownValue;

  if (prefersReduced() || from === target) {
    shownValue = target;
    el.textContent = fmtMoney(target);
    return;
  }

  const duration = 500;
  const t0 = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    shownValue = from + (target - from) * easeOut(t);
    el.textContent = fmtMoney(shownValue);
    if (t < 1) {
      valueRaf = requestAnimationFrame(step);
    } else {
      shownValue = target;
      el.textContent = fmtMoney(target);
    }
  };
  valueRaf = requestAnimationFrame(step);
}

/** Recalculate + render the result. No network request here. */
function updateResult() {
  if (!currentData) return;

  const amount = parseFloat(amountInput.value);
  const from = fromSelect.value;
  const to = toSelect.value;

  if (isNaN(amount) || amount < 0) {
    showError("Please enter a valid, non-negative amount.");
    return;
  }
  hideError();

  const unitRate = from === to ? 1 : currentData.rates[to.toLowerCase()];
  if (unitRate === undefined) {
    showError(`No exchange rate available for ${from} → ${to}.`);
    return;
  }

  const converted = amount * unitRate;
  const fromSym = symbolFor(from);
  const toSym = symbolFor(to);

  // Result line — the "to" amount lives in its own span so it can count up.
  resultMainEl.innerHTML =
    `<span class="r-side">${fromSym ? fromSym + " " : ""}${amount} ${from}</span>` +
    `<span class="r-eq"> = </span>` +
    `<span class="r-side">${toSym ? toSym + " " : ""}` +
    `<span class="r-num">${fmtMoney(shownValue == null ? converted : shownValue)}</span> ${to}</span>`;
  animateConverted(resultMainEl.querySelector(".r-num"), converted);

  // Fixed reference line, independent of the typed amount.
  reverseEl.textContent = `1 ${from} = ${formatRate(unitRate)} ${to}`;
  reverseEl.hidden = false;

  resultDateEl.textContent =
    `${currentData.stale ? "Cached rate" : "Exchange rate"} date: ${currentData.date}`;
}

/* ------------------------------------------------------------
   Historical trend mini-chart
   ------------------------------------------------------------ */

/** Last `n` calendar dates (YYYY-MM-DD), oldest → newest, ending yesterday. */
function lastNDates(n) {
  const out = [];
  const today = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out.reverse();
}

/** Fetch a single day's from→to rate; return a number or null on any failure. */
async function fetchHistoricalRate(date, from, to) {
  try {
    const dayBase = API_HISTORICAL_BASE.replace("{date}", date);
    const res = await fetch(`${dayBase}/${from}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data && data[from] ? data[from][to] : undefined;
    return typeof rate === "number" && isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}

/** Clear the chart area and show a short message. */
function clearTrend(message) {
  clearTimeout(sparkTipTimer);
  trendBodyEl.innerHTML = "";
  trendMetaEl.textContent = message || "";
  if (trendSrEl) trendSrEl.textContent = message || "";
}

/**
 * Draw an inline-SVG sparkline for [{date, value}] points, with:
 *  - hover/tap tooltip showing the day + exact rate
 *  - permanent min/max markers with value labels
 *  - a dashed "current rate" reference line
 *  - a dashed "average rate" reference line
 *  - an accessible text summary (svg aria-label + visually-hidden <p>)
 */
function drawSparkline(points, from, to) {
  // viewBox keeps its aspect ratio (meet) so text/circles are never distorted.
  const W = 320;
  const H = 96;
  const PL = 10;
  const PR = 10;
  const PT = 20;
  const PB = 20;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minIdx = values.indexOf(min);
  const maxIdx = values.indexOf(max);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const current = values[values.length - 1];
  const span = max - min || 1;

  const x = (i) => PL + (i * (W - PL - PR)) / (points.length - 1);
  const y = (v) => PT + (1 - (v - min) / span) * (H - PT - PB);

  const linePts = points
    .map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPts =
    `${x(0).toFixed(1)},${(H - PB).toFixed(1)} ${linePts} ` +
    `${x(points.length - 1).toFixed(1)},${(H - PB).toFixed(1)}`;

  const rising = current >= values[0];
  // Plain hex — CSS var() is not valid inside SVG presentation attributes.
  const stroke = rising ? "#34d399" : "#f87171";

  const yAvg = y(avg);
  const yCur = y(current);

  // Where a label near point i should anchor so it never runs off-canvas.
  const anchorFor = (i) => {
    const px = x(i);
    if (px < PL + 34) return "start";
    if (px > W - PR - 34) return "end";
    return "middle";
  };

  const summary =
    `Rate ranged from ${trimRate(min)} to ${trimRate(max)} over the last ` +
    `${points.length} days for 1 ${from.toUpperCase()} in ${to.toUpperCase()}, ` +
    `currently ${trimRate(current)}. Average ${trimRate(avg)}.`;

  trendBodyEl.innerHTML =
    `<svg class="sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" ` +
    `role="img" aria-label="${escapeAttr(summary)}">` +
      // reference lines
      `<line class="spark-ref spark-ref-avg" x1="${PL}" x2="${W - PR}" y1="${yAvg.toFixed(1)}" y2="${yAvg.toFixed(1)}" />` +
      `<line class="spark-ref spark-ref-cur" x1="${PL}" x2="${W - PR}" y1="${yCur.toFixed(1)}" y2="${yCur.toFixed(1)}" />` +
      `<text class="spark-ref-label" x="${PL}" y="${clamp(yAvg - 3, 8, H - 3).toFixed(1)}" text-anchor="start">avg ${trimRate(avg)}</text>` +
      `<text class="spark-ref-label" x="${W - PR}" y="${clamp(yCur - 3, 8, H - 3).toFixed(1)}" text-anchor="end">now ${trimRate(current)}</text>` +
      // area + line
      `<polygon class="spark-area" points="${areaPts}" fill="${stroke}" />` +
      `<polyline class="spark-line" points="${linePts}" fill="none" stroke="${stroke}" ` +
      `stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />` +
      // max marker + label
      `<circle class="spark-mm spark-max" cx="${x(maxIdx).toFixed(1)}" cy="${y(max).toFixed(1)}" r="3.6" />` +
      `<text class="spark-mm-label" x="${clamp(x(maxIdx), PL, W - PR).toFixed(1)}" ` +
      `y="${clamp(y(max) - 6, 9, H).toFixed(1)}" text-anchor="${anchorFor(maxIdx)}">High ${trimRate(max)}</text>` +
      // min marker + label
      `<circle class="spark-mm spark-min" cx="${x(minIdx).toFixed(1)}" cy="${y(min).toFixed(1)}" r="3.6" />` +
      `<text class="spark-mm-label" x="${clamp(x(minIdx), PL, W - PR).toFixed(1)}" ` +
      `y="${clamp(y(min) + 11, 9, H - 2).toFixed(1)}" text-anchor="${anchorFor(minIdx)}">Low ${trimRate(min)}</text>` +
      // current-value dot
      `<circle class="spark-dot" cx="${x(points.length - 1).toFixed(1)}" cy="${yCur.toFixed(1)}" r="3.2" fill="${stroke}" />` +
      // interaction layer (hidden until hover/tap)
      `<line class="spark-cursor" x1="0" x2="0" y1="${PT}" y2="${H - PB}" hidden />` +
      `<circle class="spark-active" r="4.2" hidden />` +
      `<rect class="spark-overlay" x="0" y="0" width="${W}" height="${H}" fill="transparent" />` +
    `</svg>`;

  if (trendSrEl) trendSrEl.textContent = summary;

  wireSparkInteraction({ points, from, to, x, y, W, H, stroke });
}

/** Attach hover/tap tooltip behaviour to the freshly-rendered sparkline. */
function wireSparkInteraction({ points, from, to, x, y, W, H, stroke }) {
  const svgEl = trendBodyEl.querySelector("svg.sparkline");
  if (!svgEl) return;
  const overlay = svgEl.querySelector(".spark-overlay");
  const cursor = svgEl.querySelector(".spark-cursor");
  const active = svgEl.querySelector(".spark-active");

  // One reusable tooltip element inside the (position:relative) trend body.
  let tip = trendBodyEl.querySelector(".spark-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "spark-tip";
    tip.setAttribute("role", "status");
    tip.hidden = true;
    trendBodyEl.appendChild(tip);
  }

  const nearestIndex = (clientX) => {
    const r = svgEl.getBoundingClientRect();
    const dataX = ((clientX - r.left) / r.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(x(i) - dataX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  // SVG elements don't reflect the `hidden` IDL property — toggle the attribute.
  const setHidden = (el, on) =>
    on ? el.setAttribute("hidden", "") : el.removeAttribute("hidden");

  const showPoint = (i) => {
    const px = x(i);
    const py = y(points[i].value);

    cursor.setAttribute("x1", px);
    cursor.setAttribute("x2", px);
    setHidden(cursor, false);
    active.setAttribute("cx", px);
    active.setAttribute("cy", py);
    active.setAttribute("fill", stroke);
    setHidden(active, false);

    const svgR = svgEl.getBoundingClientRect();
    const bodyR = trendBodyEl.getBoundingClientRect();
    const leftPx = (px / W) * svgR.width + (svgR.left - bodyR.left);
    const topPx = (py / H) * svgR.height + (svgR.top - bodyR.top);

    tip.innerHTML =
      `<span class="tip-date">${formatDay(points[i].date)}</span>` +
      `<span class="tip-rate">1 ${from.toUpperCase()} = ${trimRate(points[i].value)} ${to.toUpperCase()}</span>`;
    tip.hidden = false;

    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    tip.style.left = `${clamp(leftPx - tw / 2, 2, bodyR.width - tw - 2)}px`;
    tip.style.top = `${topPx - th - 10 < 0 ? topPx + 16 : topPx - th - 10}px`;
  };

  const hide = () => {
    setHidden(cursor, true);
    setHidden(active, true);
    tip.hidden = true; // tip is an HTML element — property is fine here
  };

  overlay.addEventListener("pointermove", (e) => {
    clearTimeout(sparkTipTimer);
    showPoint(nearestIndex(e.clientX));
  });
  overlay.addEventListener("pointerdown", (e) => {
    clearTimeout(sparkTipTimer);
    showPoint(nearestIndex(e.clientX));
  });
  // Mouse leaves -> hide immediately; touch -> auto-hide shortly after lifting.
  overlay.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") hide();
  });
  overlay.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "mouse") {
      clearTimeout(sparkTipTimer);
      sparkTipTimer = setTimeout(hide, 2500);
    }
  });
  overlay.addEventListener("pointercancel", hide);
}

/** Load + render the trend for the current from→to pair (non-blocking). */
async function renderTrend() {
  if (!currentData) return;

  const from = fromSelect.value.toLowerCase();
  const to = toSelect.value.toLowerCase();
  const reqId = ++trendReqId;

  if (from === to) {
    clearTrend("Pick two different currencies to see a trend.");
    return;
  }

  // Loading skeleton.
  trendBodyEl.innerHTML = `<div class="trend-skeleton" aria-hidden="true"></div>`;
  trendMetaEl.textContent = `Loading ${trendDays}-day history…`;

  const dates = lastNDates(trendDays);
  const results = await Promise.all(dates.map((d) => fetchHistoricalRate(d, from, to)));

  if (reqId !== trendReqId) return; // a newer request superseded this one

  const points = [];
  dates.forEach((d, i) => {
    if (results[i] != null) points.push({ date: d, value: results[i] });
  });

  if (points.length < 2) {
    clearTrend("Not enough historical data to draw a trend right now.");
    return;
  }

  drawSparkline(points, from, to);

  const first = points[0].value;
  const last = points[points.length - 1].value;
  const changePct = ((last - first) / first) * 100;
  const arrow = changePct > 0 ? "▲" : changePct < 0 ? "▼" : "▪";
  trendMetaEl.textContent =
    `${points.length} days · ${arrow} ${Math.abs(changePct).toFixed(2)}% · ` +
    `latest 1 ${from.toUpperCase()} = ${formatRate(last)} ${to.toUpperCase()}`;
}

// Debounced so rapid from/to/swap changes only fire one trend load.
const scheduleTrend = debounce(renderTrend, 250);

/* ------------------------------------------------------------
   Event handlers
   ------------------------------------------------------------ */

/** "From" changed → new base → re-fetch (fetchRates also refreshes the trend). */
function onFromChange() {
  syncSide("from");
  fetchRates(fromSelect.value);
}

/** "To" changed → recalc + refresh trend, no fetch. */
function onToChange() {
  syncSide("to");
  updateResult();
  scheduleTrend();
}

/** Swap currencies → base changed → re-fetch. */
function onSwap() {
  const prevFrom = fromSelect.value;
  fromSelect.value = toSelect.value;
  toSelect.value = prevFrom;
  syncSide("from");
  syncSide("to");
  fetchRates(fromSelect.value);
}

/** Amount input: clamp negatives instantly, debounce the recalculation. */
const debouncedRecalc = debounce(updateResult, 300);
function onAmountInput() {
  if (parseFloat(amountInput.value) < 0) amountInput.value = "0";
  debouncedRecalc();
}

/** Toggle a "More currencies" panel. */
function onMoreToggle(event) {
  const btn = event.currentTarget;
  const panel = document.getElementById(`${btn.dataset.target}-panel`);
  const open = panel.hidden;
  panel.hidden = !open;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

/* ------------------------------------------------------------
   Wire up listeners
   ------------------------------------------------------------ */
fromSelect.addEventListener("change", onFromChange);
toSelect.addEventListener("change", onToChange);
amountInput.addEventListener("input", onAmountInput);
swapButton.addEventListener("click", onSwap);
moreToggles.forEach((btn) => btn.addEventListener("click", onMoreToggle));
fromFilter.addEventListener("input", () => filterList("from", fromFilter.value));
toFilter.addEventListener("input", () => filterList("to", toFilter.value));

trendRangeBtns.forEach((btn) =>
  btn.addEventListener("click", () => {
    trendDays = Number(btn.dataset.days);
    trendRangeBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderTrend();
  })
);

/* ------------------------------------------------------------
   Init
   ------------------------------------------------------------ */
(async function init() {
  await loadCurrencyList(); // fills both <select>s (EUR / USD preselected)

  buildDefaultQuickRow("from");
  buildDefaultQuickRow("to");
  buildFavoriteRow("from");
  buildFavoriteRow("to");
  buildCurrencyList("from");
  buildCurrencyList("to");

  syncSide("from");
  syncSide("to");

  await fetchRates(fromSelect.value); // initial result; trend loads right after
})();
