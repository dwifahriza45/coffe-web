export function normalizeSupplierPhone(phone: string): string {
  const original = phone.trim();
  const compact = original.replace(/[\s().-]/g, "").replace(/^\+/, "");
  if (!/^\d+$/.test(compact)) return original;
  if (compact.startsWith("628")) return `0${compact.slice(2)}`;
  if (compact.startsWith("08")) return compact;
  if (compact.startsWith("8")) return `0${compact}`;
  return original;
}

export function supplierWhatsAppUrl(phone: string): string | undefined {
  const normalized = normalizeSupplierPhone(phone);
  return /^08\d{8,11}$/.test(normalized)
    ? `https://wa.me/62${normalized.slice(1)}`
    : undefined;
}

export function isValidSupplierPhone(phone: string): boolean {
  return phone === "" || /^08\d{8,11}$/.test(phone);
}
