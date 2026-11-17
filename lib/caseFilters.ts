/**
 * Case filter model shared by the Cases list, its export dialog and the dashboard analytics.
 * Maps 1:1 onto the backend's `parseCaseFilter` query string (multi-values are comma-joined).
 */
export interface CaseFilters {
  search: string;
  status: string[];
  bankId: string[];
  dealerId: string[];
  product: string[];
  firm: string[];
  loanType: string[];
  assignedTo: string[];
  coordinatorId: string[];
  state: string[];
  city: string[];
  createdFrom: string;
  createdTo: string;
  disbursedFrom: string;
  disbursedTo: string;
  minAmount: string;
  maxAmount: string;
  hypothecation: "" | "true" | "false";
  nocRequired: "" | "true" | "false";
  hasDocuments: "" | "true" | "false";
  openDocRequests: boolean;
  sortBy: string;
  order: "asc" | "desc";
}

export const EMPTY_FILTERS: CaseFilters = {
  search: "", status: [], bankId: [], dealerId: [], product: [], firm: [], loanType: [], assignedTo: [], coordinatorId: [],
  state: [], city: [], createdFrom: "", createdTo: "", disbursedFrom: "", disbursedTo: "", minAmount: "", maxAmount: "",
  hypothecation: "", nocRequired: "", hasDocuments: "", openDocRequests: false, sortBy: "createdAt", order: "desc",
};

export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "createdAt", label: "Created date" },
  { value: "disbursementDate", label: "Disbursement date" },
  { value: "loanAmount", label: "Loan amount" },
  { value: "caseCode", label: "Case ID" },
  { value: "status", label: "Status" },
  { value: "bankName", label: "Bank" },
  { value: "dealerName", label: "Dealer" },
  { value: "assignedToName", label: "Sales rep" },
];

const ARRAY_KEYS = ["status", "bankId", "dealerId", "product", "firm", "loanType", "assignedTo", "coordinatorId", "state", "city"] as const;
const SCALAR_KEYS = ["createdFrom", "createdTo", "disbursedFrom", "disbursedTo", "minAmount", "maxAmount", "hypothecation", "nocRequired", "hasDocuments"] as const;

/** Query-string params for the API; empty filters are omitted. */
export function filtersToQuery(f: CaseFilters, extra: Record<string, string | number | boolean | undefined> = {}) {
  const q: Record<string, string | number | boolean | undefined> = { ...extra };
  if (f.search.trim()) q.search = f.search.trim();
  for (const k of ARRAY_KEYS) if (f[k].length) q[k] = f[k].join(",");
  for (const k of SCALAR_KEYS) if (f[k]) q[k] = f[k];
  if (f.openDocRequests) q.openDocRequests = "true";
  if (f.sortBy !== EMPTY_FILTERS.sortBy || f.order !== EMPTY_FILTERS.order) { q.sortBy = f.sortBy; q.order = f.order; }
  return q;
}

/** Number of narrowing filters in use (search counts; sorting does not). */
export function countActiveFilters(f: CaseFilters): number {
  let n = f.search.trim() ? 1 : 0;
  for (const k of ARRAY_KEYS) if (f[k].length) n++;
  // A from/to pair (dates, amounts) is one filter, matching the chips.
  if (f.createdFrom || f.createdTo) n++;
  if (f.disbursedFrom || f.disbursedTo) n++;
  if (f.minAmount || f.maxAmount) n++;
  for (const k of ["hypothecation", "nocRequired", "hasDocuments"] as const) if (f[k]) n++;
  if (f.openDocRequests) n++;
  return n;
}

export interface CaseFacets {
  banks: { id: string; name: string }[];
  dealers: { id: string; name: string }[];
  reps: { id: string; name: string }[];
  coordinators: { id: string; name: string }[];
  products: string[]; firms: string[]; loanTypes: string[]; states: string[]; cities: string[]; statuses: string[];
  amount: { min: number; max: number };
}

export const EMPTY_FACETS: CaseFacets = {
  banks: [], dealers: [], reps: [], coordinators: [], products: [], firms: [], loanTypes: [], states: [], cities: [], statuses: [],
  amount: { min: 0, max: 0 },
};

export interface FilterChip { key: string; label: string; clear: (f: CaseFilters) => CaseFilters }

/** One removable chip per active filter, for the "applied filters" row. */
export function describeFilters(f: CaseFilters, facets: CaseFacets): FilterChip[] {
  const chips: FilterChip[] = [];
  const names = (ids: string[], list: { id: string; name: string }[]) => ids.map((i) => list.find((x) => x.id === i)?.name ?? i).join(", ");
  const arr = (key: (typeof ARRAY_KEYS)[number], label: string, text: string) => {
    if (f[key].length) chips.push({ key, label: `${label}: ${text}`, clear: (x) => ({ ...x, [key]: [] }) });
  };
  if (f.search.trim()) chips.push({ key: "search", label: `Search: "${f.search.trim()}"`, clear: (x) => ({ ...x, search: "" }) });
  arr("status", "Status", f.status.join(", "));
  arr("bankId", "Bank", names(f.bankId, facets.banks));
  arr("dealerId", "Dealer", names(f.dealerId, facets.dealers));
  arr("product", "Product", f.product.join(", "));
  arr("firm", "Firm", f.firm.join(", "));
  arr("loanType", "Loan type", f.loanType.join(", "));
  arr("assignedTo", "Sales rep", names(f.assignedTo, facets.reps));
  arr("coordinatorId", "Coordinator", names(f.coordinatorId, facets.coordinators));
  arr("state", "State", f.state.join(", "));
  arr("city", "City", f.city.join(", "));
  const range = (a: "createdFrom" | "disbursedFrom", b: "createdTo" | "disbursedTo", label: string) => {
    if (f[a] || f[b]) chips.push({ key: a, label: `${label}: ${f[a] || "…"} → ${f[b] || "…"}`, clear: (x) => ({ ...x, [a]: "", [b]: "" }) });
  };
  range("createdFrom", "createdTo", "Created");
  range("disbursedFrom", "disbursedTo", "Disbursed");
  if (f.minAmount || f.maxAmount) {
    chips.push({ key: "amount", label: `Amount: ₹${f.minAmount || "0"} – ${f.maxAmount ? "₹" + f.maxAmount : "any"}`, clear: (x) => ({ ...x, minAmount: "", maxAmount: "" }) });
  }
  const tri = (key: "hypothecation" | "nocRequired" | "hasDocuments", label: string) => {
    if (f[key]) chips.push({ key, label: `${label}: ${f[key] === "true" ? "Yes" : "No"}`, clear: (x) => ({ ...x, [key]: "" }) });
  };
  tri("hypothecation", "Hypothecation");
  tri("nocRequired", "NOC required");
  tri("hasDocuments", "Has documents");
  if (f.openDocRequests) chips.push({ key: "openDocRequests", label: "Open document requests", clear: (x) => ({ ...x, openDocRequests: false }) });
  return chips;
}
