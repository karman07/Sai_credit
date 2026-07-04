// ════════════════════════════════════════════════════════════════════
// Typed API client — NestJS backend, unwraps { success, data, meta }
// and transparently refreshes the access token on 401.
// ════════════════════════════════════════════════════════════════════

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000/api/v1";

const ACCESS_KEY = "crm-access-token";
const REFRESH_KEY = "crm-refresh-token";

export const tokenStore = {
  get access() { return typeof window !== "undefined" ? localStorage.getItem(ACCESS_KEY) : null; },
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
  const headers: Record<string, string> = {};
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (auth && tokenStore.access) headers.Authorization = `Bearer ${tokenStore.access}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
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
    } catch { /* fall through */ }
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

// ── Domain types ─────────────────────────────────────────────────────

export type CaseStatus = "Draft" | "Sales" | "Pending" | "In Credit" | "Incomplete" | "Approved" | "Disbursed" | "Hold" | "Rejected" | "Cancelled";
export const CASE_STATUSES: CaseStatus[] = ["Draft", "Sales", "Pending", "In Credit", "Incomplete", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"];
export const PRODUCTS = ["Car Loan", "Truck", "Personal Loan", "BT Topup", "Two Wheeler"] as const;
export const LOAN_TYPES = ["New", "Used", "Refinance"] as const;
export const RESIDENTIAL_STATUSES = ["Own", "Rented", "Family Owned"] as const;
export const CHECKLIST_STATUSES = ["Received", "Pending", "Not Required"] as const;

export interface Bank { _id: string; name: string; branch?: string; bmName?: string; bmContact?: string; executive?: string; isActive: boolean; createdAt: string; }
export interface Dealer { _id: string; name: string; contact?: string; location?: string; coordinatorId?: string; coordinatorName?: string; isActive: boolean; createdAt: string; }
export interface Coordinator { _id: string; name: string; phone?: string; email?: string; region?: string; isActive: boolean; createdAt: string; }
export interface SalesUser { _id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; }
export interface DocumentType { _id: string; name: string; isActive: boolean; }

export interface CaseDocument {
  _id: string; docType: string; fileName: string; url: string; remarks?: string;
  uploadedBy: string; uploadedByName: string; uploadedAt: string;
}
export interface DocRequest {
  _id: string; docTypes: string[]; remarks: string;
  requestedBy: string; requestedByName: string; requestedAt: string;
  resolvedAt?: string; isResolved: boolean;
}

export interface LoanCase {
  _id: string; caseCode: string; date: string;
  customer: { firstName: string; lastName: string; fatherName?: string; contact: string; altContact?: string; location?: string; pinCode?: string; residentialStatus?: string; ebillOwner?: boolean; };
  product: string; loanType?: string; vehicleModel?: string; regNumber?: string; ownerSerial?: string;
  existingInsurer?: string; hypothecation?: boolean; nocRequired?: boolean; challanCount?: number; loanAmount?: number;
  bankId?: string; bankName?: string; bankBranch?: string; bmName?: string; bmContact?: string; bankExecutive?: string;
  dealerId?: string; dealerName?: string; payoutPct?: number;
  status: CaseStatus; disbursementDate?: string;
  coordinatorId?: string; coordinatorName?: string; remarks?: string;
  assignedTo?: string; assignedToName?: string;
  documents: CaseDocument[];
  docRequests: DocRequest[];
  createdAt: string; isActive: boolean;
}

export interface PayoutRecord {
  _id: string; businessMonth: string; bankId?: string; bankName?: string; company?: string;
  volumeCases: number; invoiceStatus: string; invoiceNumber?: string; invoiceAmount: number;
  commission: number; gstAmount: number; totalAmount: number;
  payoutStatus: string; payoutDate?: string; remarks?: string; createdAt: string;
}

export interface InsuranceMIS {
  _id: string; caseId?: string; caseCode?: string; customerName?: string; vehicleModel?: string;
  insurer: string; ownerType: string; startDate: string; endDate: string; holdAmount: number;
  renewal: boolean; isActive: boolean; createdAt: string;
}

export interface RTORecord {
  _id: string; caseId?: string; caseCode?: string; customerName?: string;
  rtoOwnership: string; hypothecation: string; bankNoc: string; nocHoldAmt: number;
  challanClearance: string; aadhaarMatch: string; aadhaarMismatchNote?: string; remarks?: string; createdAt: string;
}

export interface Activity {
  _id: string; caseId: string; type: string; description: string; note?: string;
  oldStatus?: string; newStatus?: string; createdBy: string; createdByName?: string; createdAt: string;
}

export interface DashboardStats {
  totalLeads: number; disbursedMTD: number; disbursedMTDAmount: number; activeCases: number;
  statusBreakdown: Record<string, number>;
  bankWise: { _id: string; count: number; volume: number }[];
  productMix: { _id: string; count: number }[];
}

// ── Domain API helpers ────────────────────────────────────────────────

export const casesApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<LoanCase[]>("/cases", q),
  listWithMeta: (q?: Record<string, string | number | boolean | undefined>) => api.get<LoanCase[]>("/cases", q),
  get: (id: string) => api.get<LoanCase>(`/cases/${id}`),
  stats: () => api.get<DashboardStats>("/cases/stats"),
  create: (body: unknown) => api.post<LoanCase>("/cases", body),
  update: (id: string, body: unknown) => api.put<LoanCase>(`/cases/${id}`, body),
  updateStatus: (id: string, body: { status: string; note?: string; disbursementDate?: string }) => api.put<LoanCase>(`/cases/${id}/status`, body),
  delete: (id: string) => api.del(`/cases/${id}`),
  activities: (id: string) => api.get<Activity[]>(`/activities/case/${id}`),
  assign: (id: string, body: { userId: string; userName: string }) => api.put<LoanCase>(`/cases/${id}/assign`, body),
  requestDocs: (id: string, body: { docTypes: string[]; remarks: string }) => api.post<LoanCase>(`/cases/${id}/request-docs`, body),
  uploadDoc: (id: string, formData: FormData) => api.post<LoanCase>(`/cases/${id}/upload-doc`, formData),
  deleteDoc: (id: string, docId: string) => api.del<LoanCase>(`/cases/${id}/docs/${docId}`),
  editDoc: (id: string, docId: string, body: { fileName?: string; remarks?: string }) => api.put<LoanCase>(`/cases/${id}/docs/${docId}`, body),
  resolveDocRequest: (id: string, reqId: string) => api.put<LoanCase>(`/cases/${id}/resolve-doc-request/${reqId}`),
  submitForVerification: (id: string) => api.put<LoanCase>(`/cases/${id}/submit-for-verification`),
};

export const banksApi = {
  list: (includeInactive = false) => api.get<Bank[]>("/banks", includeInactive ? { includeInactive: true } : undefined),
  get: (id: string) => api.get<Bank>(`/banks/${id}`),
  create: (body: unknown) => api.post<Bank>(`/banks`, body),
  update: (id: string, body: unknown) => api.put<Bank>(`/banks/${id}`, body),
  toggle: (id: string) => api.put(`/banks/${id}/toggle-status`),
  delete: (id: string) => api.del(`/banks/${id}`),
};

export const dealersApi = {
  list: (includeInactive = false) => api.get<Dealer[]>("/dealers", includeInactive ? { includeInactive: true } : undefined),
  get: (id: string) => api.get<Dealer>(`/dealers/${id}`),
  create: (body: unknown) => api.post<Dealer>("/dealers", body),
  update: (id: string, body: unknown) => api.put<Dealer>(`/dealers/${id}`, body),
  toggle: (id: string) => api.put(`/dealers/${id}/toggle-status`),
  delete: (id: string) => api.del(`/dealers/${id}`),
};

export const coordinatorsApi = {
  list: (includeInactive = false) => api.get<Coordinator[]>("/coordinators", includeInactive ? { includeInactive: true } : undefined),
  get: (id: string) => api.get<Coordinator>(`/coordinators/${id}`),
  create: (body: unknown) => api.post<Coordinator>("/coordinators", body),
  update: (id: string, body: unknown) => api.put<Coordinator>(`/coordinators/${id}`, body),
  toggle: (id: string) => api.put(`/coordinators/${id}/toggle-status`),
  delete: (id: string) => api.del(`/coordinators/${id}`),
};

export const payoutApi = {
  list: (month?: string, bankId?: string) => api.get<PayoutRecord[]>("/payout", { month, bankId }),
  months: () => api.get<string[]>("/payout/months"),
  create: (body: unknown) => api.post<PayoutRecord>("/payout", body),
  update: (id: string, body: unknown) => api.put<PayoutRecord>(`/payout/${id}`, body),
  delete: (id: string) => api.del(`/payout/${id}`),
};

export const insuranceApi = {
  list: (expiryDays?: number) => api.get<InsuranceMIS[]>("/insurance-mis", expiryDays !== undefined ? { expiryDays } : undefined),
  create: (body: unknown) => api.post<InsuranceMIS>("/insurance-mis", body),
  update: (id: string, body: unknown) => api.put<InsuranceMIS>(`/insurance-mis/${id}`, body),
  delete: (id: string) => api.del(`/insurance-mis/${id}`),
};

export const rtoApi = {
  list: (caseId?: string) => api.get<RTORecord[]>("/rto-tracker", caseId ? { caseId } : undefined),
  create: (body: unknown) => api.post<RTORecord>("/rto-tracker", body),
  update: (id: string, body: unknown) => api.put<RTORecord>(`/rto-tracker/${id}`, body),
  upsertByCase: (caseId: string, body: unknown) => api.put<RTORecord>(`/rto-tracker/by-case/${caseId}`, body),
};

export const usersApi = {
  list: (role?: string) => api.get<SalesUser[]>("/users", role ? { role } : undefined),
};

export const mastersApi = {
  list: (resource: string) => api.get<DocumentType[]>(`/master/${resource}`),
  create: (resource: string, body: unknown) => api.post<DocumentType>(`/master/${resource}`, body),
  update: (resource: string, id: string, body: unknown) => api.put<DocumentType>(`/master/${resource}/${id}`, body),
  toggle: (resource: string, id: string) => api.put(`/master/${resource}/${id}/toggle-status`),
};
