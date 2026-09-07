export function convertCurrency(amount, from, to, rates) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    throw new Error("Amount must be a number");
  }

  if (numericAmount < 0) {
    throw new Error("Amount cannot be negative");
  }

  if (!rates || !Number.isFinite(rates[from]) || !Number.isFinite(rates[to])) {
    throw new Error(`Missing exchange rate for ${from} or ${to}`);
  }

  return Number((numericAmount * rates[to] / rates[from]).toFixed(2));
}

export function calculateReverseRate(from, to, rates) {
  if (!rates || !Number.isFinite(rates[from]) || !Number.isFinite(rates[to])) {
    throw new Error(`Missing exchange rate for ${from} or ${to}`);
  }

  return rates[to] / rates[from];
}
