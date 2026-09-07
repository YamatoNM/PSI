// ============================================================
//  config.js — single source of truth for API endpoints.
//  Change an endpoint here and the whole app follows.
//  script.js must never hardcode one of these URLs itself.
// ============================================================

// "Latest" rates for a base currency:  `${API_LATEST_BASE}/${base}.json`
export const API_LATEST_BASE =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";

// Historical rates for a specific day. Replace the {date} token with a
// YYYY-MM-DD string, then append `/${base}.json`.
export const API_HISTORICAL_BASE =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies";

// ------------------------------------------------------------
//  Currently active ISO 4217 currency codes (lowercase).
//  The API's currency list also contains obsolete codes (ITL, DEM,
//  FRF, ROL, ...) and non-fiat tickers; script.js keeps only codes
//  present in this array. Maintain this list rather than a denylist:
//  when a currency is retired, just remove its line here.
//  Precious-metal codes (xau/xag/xpt/xpd) are included; crypto is not.
// ------------------------------------------------------------
export const CURRENT_ISO_CURRENCIES = [
  "aed", "afn", "all", "amd", "ang", "aoa", "ars", "aud", "awg", "azn",
  "bam", "bbd", "bdt", "bgn", "bhd", "bif", "bmd", "bnd", "bob", "brl",
  "bsd", "btn", "bwp", "byn", "bzd", "cad", "cdf", "chf", "clp", "cny",
  "cop", "crc", "cup", "cve", "czk", "djf", "dkk", "dop", "dzd", "egp",
  "ern", "etb", "eur", "fjd", "fkp", "gbp", "gel", "ghs", "gip", "gmd",
  "gnf", "gtq", "gyd", "hkd", "hnl", "htg", "huf", "idr", "ils", "inr",
  "iqd", "irr", "isk", "jmd", "jod", "jpy", "kes", "kgs", "khr", "kmf",
  "kpw", "krw", "kwd", "kyd", "kzt", "lak", "lbp", "lkr", "lrd", "lsl",
  "lyd", "mad", "mdl", "mga", "mkd", "mmk", "mnt", "mop", "mru", "mur",
  "mvr", "mwk", "mxn", "myr", "mzn", "nad", "ngn", "nio", "nok", "npr",
  "nzd", "omr", "pab", "pen", "pgk", "php", "pkr", "pln", "pyg", "qar",
  "ron", "rsd", "rub", "rwf", "sar", "sbd", "scr", "sdg", "sek", "sgd",
  "shp", "sle", "sos", "srd", "ssp", "stn", "svc", "syp", "szl", "thb",
  "tjs", "tmt", "tnd", "top", "try", "ttd", "twd", "tzs", "uah", "ugx",
  "usd", "uyu", "uzs", "ved", "ves", "vnd", "vuv", "wst", "xaf", "xcd",
  "xof", "xpf", "xdr", "yer", "zar", "zmw", "zwg",
  "xau", "xag", "xpt", "xpd",
];
