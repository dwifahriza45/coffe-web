export function stripNumberCommas(value: string) {
  return value.replace(/,/g, "");
}

export function formatNumber(value: string, maximumFractionDigits = 6) {
  const cleanValue = stripNumberCommas(value);
  if (cleanValue === "") return "";
  const numberValue = Number(cleanValue);
  if (!Number.isFinite(numberValue)) return value;
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(numberValue);
}

export function normalizeNumberInput(value: string, allowDecimal = true) {
  const cleanValue = stripNumberCommas(value);
  const allowedPattern = allowDecimal ? /[^\d.]/g : /\D/g;
  const sanitized = cleanValue.replace(allowedPattern, "");
  if (!allowDecimal) return sanitized;
  const [whole, ...decimalParts] = sanitized.split(".");
  return decimalParts.length > 0
    ? `${whole}.${decimalParts.join("")}`
    : whole;
}

// Keep the fractional text intact while the user is typing (e.g. "1,000.").
export function formatNumberInput(value: string) {
  const [whole, fraction] = stripNumberCommas(value).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction === undefined ? grouped : `${grouped}.${fraction}`;
}
