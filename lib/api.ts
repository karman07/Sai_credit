// ════════════════════════════════════════════════════════════════════
// Typed API client — NestJS backend, unwraps { success, data, meta }
// and transparently refreshes the access token on 401.
// ════════════════════════════════════════════════════════════════════

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:4000/api/v1";

const ACCESS_KEY = "coordinator-access-token";
const REFRESH_KEY = "coordinator-refresh-token";

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
    } catch {}
    tokenStore.clear(); return false;
  })();
  const p = refreshing;
  p.finally(() => (refreshing = null));
  return p;
}

export const api = {
  get:   <T>(path: string, query?: RequestOptions["query"]) => request<T>(path, { query }),
  post:  <T>(path: string, body?: unknown, auth = true) => request<T>(path, { method: "POST", body, auth }),
  put:   <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del:   <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// ── Domain types ──────────────────────────────────────────────────────

export type CaseStatus = "Draft" | "Sales" | "Pending" | "In Credit" | "Incomplete" | "Approved" | "Disbursed" | "Hold" | "Rejected" | "Cancelled";
export const CASE_STATUSES: CaseStatus[] = ["Draft", "Sales", "Pending", "In Credit", "Incomplete", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"];
export const PRODUCTS = ["Car Loan", "Truck", "Personal Loan", "BT Topup", "Two Wheeler"] as const;

export interface Bank { _id: string; name: string; branch?: string; bmName?: string; bmContact?: string; executive?: string; isActive: boolean; }
export interface Dealer { _id: string; name: string; contact?: string; location?: string; isActive: boolean; }

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
  customer: {
    firstName: string; lastName: string; contact: string;
    altContact?: string; fatherName?: string;
    location?: string; state?: string; district?: string; pinCode?: string;
    residentialStatus?: string; ebillOwner?: boolean;
  };
  product: string; loanAmount?: number; loanType?: string;
  vehicleModel?: string; regNumber?: string; ownerSerial?: string;
  existingInsurer?: string; hypothecation?: boolean; nocRequired?: boolean; challanCount?: number;
  bankId?: string; bankName?: string; bankBranch?: string; bmName?: string; bmContact?: string; bankExecutive?: string;
  dealerId?: string; dealerName?: string; payoutPct?: number;
  status: CaseStatus; disbursementDate?: string;
  remarks?: string;
  assignedTo?: string; assignedToName?: string;
  pipeline?: { stage: string; status: string; doneAt?: string; doneByName?: string; remarks?: string }[];
  documents: CaseDocument[];
  docRequests: DocRequest[];
  customFields?: Record<string, any>;
  createdAt: string;
}

export interface DashboardStats {
  totalLeads: number; disbursedMTD: number; disbursedMTDAmount: number; activeCases: number;
  statusBreakdown: Record<string, number>;
  bankWise: { _id: string; count: number; volume: number }[];
  productMix: { _id: string; count: number }[];
}

export interface LinkedCase {
  caseId: string; caseCode: string; customerName?: string; loanAmount?: number;
}

export interface PayoutRecord {
  _id: string; businessMonth: string; invoiceDate?: string;
  bankId?: string; bankName?: string; company?: string;
  volumeCases: number;
  linkedCases: LinkedCase[];
  invoiceStatus: string; invoiceNumber?: string; invoiceAmount: number;
  commission: number; cgstAmount: number; sgstAmount: number; gstAmount: number; totalAmount: number;
  payoutStatus: string; payoutDate?: string; remarks?: string;
  customFields?: Record<string, any>; createdAt: string;
}

export interface Notification {
  _id: string; type: string; title: string; message: string;
  caseId?: string; caseCode?: string; isRead: boolean; createdAt: string;
}

// ── Domain API helpers ─────────────────────────────────────────────────

export const casesApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<LoanCase[]>("/cases", q),
  get: (id: string) => api.get<LoanCase>(`/cases/${id}`),
  stats: () => api.get<DashboardStats>("/cases/stats"),
  update: (id: string, body: unknown) => api.put<LoanCase>(`/cases/${id}`, body),
  updateStatus: (id: string, body: { status: string; note?: string; disbursementDate?: string }) => api.put<LoanCase>(`/cases/${id}/status`, body),
  requestDocs: (id: string, body: { docTypes: string[]; remarks: string }) => api.post<LoanCase>(`/cases/${id}/request-docs`, body),
  uploadDoc: (id: string, formData: FormData) => api.post<LoanCase>(`/cases/${id}/upload-doc`, formData),
  deleteDoc: (id: string, docId: string) => api.del<LoanCase>(`/cases/${id}/docs/${docId}`),
  editDoc: (id: string, docId: string, body: { fileName?: string; remarks?: string }) => api.put<LoanCase>(`/cases/${id}/docs/${docId}`, body),
  resolveDocRequest: (id: string, reqId: string) => api.put<LoanCase>(`/cases/${id}/resolve-doc-request/${reqId}`),
  submitForVerification: (id: string) => api.put<LoanCase>(`/cases/${id}/submit-for-verification`),
};

export const banksApi = {
  list: () => api.get<Bank[]>("/banks"),
};

export const dealersApi = {
  list: () => api.get<Dealer[]>("/dealers"),
};

export interface InsurancePolicy {
  _id: string; name: string; insurer: string;
  coverageType: string; vehicleTypes: string[];
  premiumAmount: number; idvAmount?: number; tenure: number;
  description?: string; isActive: boolean; createdAt: string;
}

export interface InsuranceMIS {
  _id: string; caseId?: string; caseCode?: string; customerName?: string; customerEmail?: string; vehicleModel?: string;
  policyId?: string; policyName?: string; coverageType?: string; vehicleType?: string;
  premiumAmount: number; insurer: string; ownerType: string; startDate: string; endDate: string;
  holdAmount: number; renewal: boolean; createdByName?: string; isActive: boolean; createdAt: string;
  customFields?: Record<string, any>;
  renewalHistory?: { renewedAt: string; oldEndDate?: string; newEndDate: string; renewedByName?: string }[];
  lastRenewedAt?: string;
}

export const insuranceApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<InsuranceMIS[]>("/insurance-mis", q),
  create: (body: unknown) => api.post<InsuranceMIS>("/insurance-mis", body),
  update: (id: string, body: unknown) => api.put<InsuranceMIS>(`/insurance-mis/${id}`, body),
  requestRenewal: (id: string) => api.put<InsuranceMIS>(`/insurance-mis/${id}/request-renewal`),
  delete: (id: string) => api.del(`/insurance-mis/${id}`),
};

export const insurancePoliciesApi = {
  list: () => api.get<InsurancePolicy[]>("/insurance-policies"),
};

export const payoutApi = {
  list: (month?: string, bankId?: string) => api.get<PayoutRecord[]>("/payout", { month, bankId }),
  months: () => api.get<string[]>("/payout/months"),
  create: (body: unknown) => api.post<PayoutRecord>("/payout", body),
  update: (id: string, body: unknown) => api.put<PayoutRecord>(`/payout/${id}`, body),
  delete: (id: string) => api.del(`/payout/${id}`),
};

export interface MasterItem {
  _id: string; type: string; name: string; code?: string; shortName?: string;
  colorClass?: string; isActive: boolean;
}

export const mastersApi = {
  list: (resource: string) => api.get<MasterItem[]>(`/master/${resource}`),
};

export type FieldType = 'text' | 'number' | 'select' | 'tel' | 'date' | 'boolean';

export interface FieldDef {
  key: string; label: string; type: FieldType; required: boolean;
  placeholder?: string; defaultValue?: string; options: string[];
  order: number; isCore: boolean; isActive: boolean;
}

export interface SectionDef { id: string; title: string; fields: FieldDef[]; }
export interface FormSchema { formId: string; sections: SectionDef[]; }

export const formSchemasApi = {
  get: (formId: string) => api.get<FormSchema>(`/form-schemas/${formId}`),
};

export interface TeamMember { _id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; }

export const usersApi = {
  myTeam: () => api.get<TeamMember[]>("/users/my-team"),
};

export function getCurrentUserId(): string | null {
  const token = tokenStore.access;
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]))?.sub ?? null;
  } catch { return null; }
}

// ── HR Types ──────────────────────────────────────────────────────────

export interface AttendanceRecord {
  _id: string;
  userId: string | { _id: string; firstName: string; lastName: string; employeeCode?: string; role: string };
  date: string;
  clockIn?: string;
  clockOut?: string;
  workHours: number;
  status: 'present' | 'absent' | 'half_day' | 'on_leave' | 'holiday';
  note?: string;
  createdAt: string;
}

export interface AttendanceSummary {
  present: number; absent: number; halfDay: number; onLeave: number; holiday: number;
  total: number; totalWorkHours: number;
}

export interface Claim {
  _id: string;
  userId: string | { _id: string; firstName: string; lastName: string; employeeCode?: string; role: string };
  month: string;
  type: 'travel' | 'food' | 'accommodation' | 'other';
  amount: number;
  description: string;
  receiptUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string | { _id: string; firstName: string; lastName: string };
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface PayrollRecord {
  _id: string;
  userId: string | { _id: string; firstName: string; lastName: string; employeeCode?: string; role: string; designation?: string };
  month: string;
  basicSalary: number;
  workingDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  paidLeaveDays?: number;
  lwpDays?: number;
  hra?: number;
  travelAllowance?: number;
  da?: number;
  medicalAllowance?: number;
  otherAllowance?: number;
  incentives: { reason: string; amount: number }[];
  reimbursementTotal: number;
  lopDeduction: number;
  grossPay: number;
  netPay: number;
  status: 'draft' | 'processed' | 'paid';
  paidAt?: string;
  remarks?: string;
  createdAt: string;
}

// ── HR API helpers ────────────────────────────────────────────────────

export const attendanceApi = {
  clockIn: (body?: { date?: string; note?: string }) => api.post<AttendanceRecord>('/attendance/clock-in', body ?? {}),
  clockOut: (body?: { date?: string; note?: string }) => api.post<AttendanceRecord>('/attendance/clock-out', body ?? {}),
  today: () => api.get<AttendanceRecord | null>('/attendance/today'),
  summary: (month?: string) => api.get<AttendanceSummary>('/attendance/summary', month ? { month } : undefined),
  list: (q?: Record<string, string | number | undefined>) => api.get<{ records: AttendanceRecord[]; total: number }>('/attendance', q),
};

export const claimsApi = {
  create: (body: { month: string; type: string; amount: number; description: string; receiptUrl?: string }) =>
    api.post<Claim>('/claims', body),
  list: (q?: Record<string, string | number | undefined>) => api.get<{ claims: Claim[]; total: number }>('/claims', q),
  cancel: (id: string) => api.del(`/claims/${id}`),
};

export const payslipsApi = {
  list: (q?: Record<string, string | number | undefined>) => api.get<{ payrolls: PayrollRecord[]; total: number }>('/payroll', q),
  get: (id: string) => api.get<PayrollRecord>(`/payroll/${id}`),
};

export interface Leave {
  _id: string;
  userId: string | { _id: string; firstName: string; lastName: string };
  type: 'casual' | 'sick' | 'earned' | 'unpaid';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewedBy?: string | { _id: string; firstName: string; lastName: string };
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface LeaveBalance {
  annualLeaveQuota: number;
  leaveBalance: number;
  usedPaidDays: number;
  pendingCount: number;
  weeklyOffDays: number[];
  currentMonthAttendance: { date: string; status: string }[];
}

export const leavesApi = {
  balance: () => api.get<LeaveBalance>('/leaves/balance'),
  create: (body: { type: string; startDate: string; endDate: string; reason: string }) =>
    api.post<Leave>('/leaves', body),
  list: (q?: Record<string, string | number | undefined>) =>
    api.get<{ leaves: Leave[]; total: number }>('/leaves', q),
  cancel: (id: string) => api.del(`/leaves/${id}`),
};

export const authApi = {
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.put<{ ok: boolean }>('/auth/change-password', body),
};

export const notificationsApi = {
  list: (limit?: number) => api.get<Notification[]>('/notifications', limit ? { limit } : undefined),
  unreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),
  markRead: (id: string) => api.patch<Notification>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<{ ok: boolean }>('/notifications/read-all'),
};
