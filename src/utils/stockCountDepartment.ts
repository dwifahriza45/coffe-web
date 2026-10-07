export const stockCountDepartments = [
  { key: "barista", label: "Barista", category: "BEVERAGE" },
  { key: "kitchen", label: "Kitchen", category: "KITCHEN" },
  { key: "waiters", label: "Waiters", category: "OTHER" },
] as const;

export function getStockCountDepartment(key: string | null) {
  return stockCountDepartments.find((department) => department.key === key);
}

export function matchesStockCountDepartment(categoryName: string, department: string) {
  const normalized = categoryName.trim().toLowerCase();
  if (department === "barista") return /^(beverages?|baverages?)$/.test(normalized);
  if (department === "kitchen") return normalized === "kitchen";
  if (department === "waiters") return /^others?$/.test(normalized);
  return true;
}
