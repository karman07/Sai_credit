export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000/api/v1";

const ACCESS_KEY  = "sales-access-token";
const REFRESH_KEY = "sales-refresh-token";

export const tokenStore = {
  get access()  { return typeof window !== "undefined" ? localStorage.getItem(ACCESS_KEY) : null; },
  get refresh() { return typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null; },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export interface PageMeta { page: number; limit: number; total: number; totalPages: number; }

export class ApiError extends Error {
  constructor(public code: string, message: string, public fields?: Record<string, string>, public status?: number) {
    super(message);
  }
}

interface RequestOptions {
  method?: string; body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean; _retried?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: PageMeta }> {
  const { method = "GET", body, query, auth = true } = opts;
  const url = new URL(API_BASE + path);
  if (query) for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;
  const res = await fetch(url.toString(), { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  if (res.status === 401 && auth && !opts._retried && tokenStore.refresh) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(path, { ...opts, _retried: true });
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const err = json?.error ?? { code: "ERROR", message: res.statusText };
    throw new ApiError(err.code, err.message, err.fields, res.status);
  }
  return { data: json.data as T, meta: json.meta as PageMeta | undefined };
}

let refreshing: Promise<boolean> | null = null;
function tryRefresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await fetch(API_BASE + "/auth/refresh", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokenStore.refresh }),
      });
      const json = await res.json();
      if (json?.success) { tokenStore.set(json.data.accessToken, json.data.refreshToken); return true; }
    } catch {}
    tokenStore.clear(); return false;
  })();
  const p = refreshing;
  p.finally(() => (refreshing = null));
  return p;
}

export const api = {
  get:  <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "POST", body, auth }),
  put:  <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  del:  <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Domain types ──────────────────────────────────────────────────────

export type CaseStatus = "Sales" | "Pending" | "In Credit" | "Approved" | "Disbursed" | "Hold" | "Rejected" | "Cancelled";
export const CASE_STATUSES: CaseStatus[] = ["Sales", "Pending", "In Credit", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"];
export const PRODUCTS = ["Car Loan", "Truck", "Personal Loan", "BT Topup", "Two Wheeler"] as const;
export const LOAN_TYPES = ["New", "Used", "Refinance"] as const;
export const RESIDENTIAL_STATUSES = ["Own", "Rented", "Family Owned"] as const;

export interface Bank { _id: string; name: string; branch?: string; bmName?: string; bmContact?: string; executive?: string; isActive: boolean; }
export interface Dealer { _id: string; name: string; contact?: string; location?: string; coordinatorName?: string; isActive: boolean; }
export interface Coordinator { _id: string; name: string; phone?: string; email?: string; region?: string; isActive: boolean; }

export interface LoanCase {
  _id: string; caseCode: string; date: string;
  customer: { firstName: string; lastName: string; contact: string; location?: string; };
  product: string; loanAmount?: number;
  bankId?: string; bankName?: string; dealerId?: string; dealerName?: string;
  status: CaseStatus; disbursementDate?: string;
  coordinatorId?: string; coordinatorName?: string; remarks?: string; createdAt: string;
}

export interface InsuranceMIS {
  _id: string; caseId?: string; caseCode?: string; customerName?: string;
  insurer: string; ownerType: string; startDate: string; endDate: string; holdAmount: number;
  renewal: boolean; isActive: boolean; createdAt: string;
}

export interface RTORecord {
  _id: string; caseId?: string; caseCode?: string; customerName?: string;
  rtoOwnership: string; hypothecation: string; bankNoc: string; nocHoldAmt: number;
  challanClearance: string; aadhaarMatch: string; aadhaarMismatchNote?: string; remarks?: string;
}

export interface PayoutRecord {
  _id: string; businessMonth: string; bankName?: string;
  volumeCases: number; invoiceStatus: string; commission: number; gstAmount: number; totalAmount: number;
  payoutStatus: string; payoutDate?: string;
}

export interface Notification {
  _id: string; type: string; title: string; description: string;
  caseId?: string; isRead: boolean; isDismissed: boolean; createdAt: string;
}

// ── Domain API helpers ─────────────────────────────────────────────────

export const casesApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<LoanCase[]>("/cases", q),
  get: (id: string) => api.get<LoanCase>(`/cases/${id}`),
  create: (body: unknown) => api.post<LoanCase>("/cases", body),
  update: (id: string, body: unknown) => api.put<LoanCase>(`/cases/${id}`, body),
  updateStatus: (id: string, body: { status: string; note?: string }) => api.put<LoanCase>(`/cases/${id}/status`, body),
};

export const banksApi = {
  list: () => api.get<Bank[]>("/banks"),
};

export const dealersApi = {
  list: () => api.get<Dealer[]>("/dealers"),
};

export const coordinatorsApi = {
  list: () => api.get<Coordinator[]>("/coordinators"),
};

export const insuranceApi = {
  list: () => api.get<InsuranceMIS[]>("/insurance-mis"),
  create: (body: unknown) => api.post<InsuranceMIS>("/insurance-mis", body),
  update: (id: string, body: unknown) => api.put<InsuranceMIS>(`/insurance-mis/${id}`, body),
};

export const rtoApi = {
  list: (caseId?: string) => api.get<RTORecord[]>("/rto-tracker", caseId ? { caseId } : undefined),
  upsertByCase: (caseId: string, body: unknown) => api.put<RTORecord>(`/rto-tracker/by-case/${caseId}`, body),
};

export const payoutApi = {
  list: (month?: string) => api.get<PayoutRecord[]>("/payout", month ? { month } : undefined),
  months: () => api.get<string[]>("/payout/months"),
};
