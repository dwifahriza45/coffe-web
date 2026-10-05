import type { Supplier, SupplierPayload } from "../api/supplier.api";
import { normalizeSupplierPhone } from "./supplierPhone";

export function supplierImportChanged(existing: Supplier, incoming: SupplierPayload): boolean {
  return existing.name.trim() !== incoming.name ||
    normalizeSupplierPhone(existing.phone) !== incoming.phone ||
    existing.email.trim() !== incoming.email ||
    existing.address.trim() !== incoming.address ||
    (existing.link || "").trim() !== incoming.link ||
    existing.active !== incoming.active;
}
