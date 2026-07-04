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
export const LOAN_TYPES = ["New", "Used", "Refinance"] as const;
export const RESIDENTIAL_STATUSES = ["Own", "Rented", "Family Owned"] as const;

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

export interface InsurancePolicy {
  _id: string; name: string; insurer: string;
  coverageType: string; vehicleTypes: string[];
  premiumAmount: number; idvAmount?: number; tenure: number;
  description?: string; isActive: boolean; createdAt: string;
}

export interface InsuranceMIS {
  _id: string; caseId?: string; caseCode?: string; customerName?: string; vehicleModel?: string;
  policyId?: string; policyName?: string; coverageType?: string; vehicleType?: string;
  premiumAmount: number; insurer: string; ownerType: string; startDate: string; endDate: string;
  holdAmount: number; renewal: boolean; createdByName?: string; isActive: boolean; createdAt: string;
  customFields?: Record<string, any>;
}

export interface RTORecord {
  _id: string; caseId?: string; caseCode?: string; customerName?: string;
  rtoOwnershipType?: string;
  rtoOwnership: string; rtoReceiving: boolean;
  challanCheck: string; bankNocCheck: string; nocHoldAmt: number;
  insuranceCheck: string; hypothecation: string;
  aadhaarMatch: string; aadhaarMismatchNote?: string;
  pendingDocuments: string[];
  rtoSlipUrl?: string; rtoSlipFileName?: string;
  verification: string; approval: string; approvalDate?: string;
  insuranceEndorsement: string; balancePayment: number;
  remarks?: string; createdAt?: string;
  customFields?: Record<string, any>;
}

export interface PayoutRecord {
  _id: string; businessMonth: string; bankName?: string;
  volumeCases: number; invoiceStatus: string; commission: number; gstAmount: number; totalAmount: number;
  payoutStatus: string; payoutDate?: string;
}

export interface Notification {
  _id: string; type: string; title: string; message: string;
  caseId?: string; caseCode?: string; isRead: boolean; createdAt: string;
}

export interface SalesCustomer {
  _id: string;
  customerCode: string;
  firstName: string;
  lastName: string;
  customerType: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  assignedTo?: { _id: string; firstName: string; lastName: string } | null;
  latestCaseStatus?: string;
  latestCaseCode?: string;
  totalCases: number;
  createdAt: string;
}

// ── Domain API helpers ─────────────────────────────────────────────────

export const casesApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<LoanCase[]>("/cases", q),
  get: (id: string) => api.get<LoanCase>(`/cases/${id}`),
  create: (body: unknown) => api.post<LoanCase>("/cases", body),
  update: (id: string, body: unknown) => api.put<LoanCase>(`/cases/${id}`, body),
  updateStatus: (id: string, body: { status: string; note?: string }) => api.put<LoanCase>(`/cases/${id}/status`, body),
  uploadDoc: (id: string, formData: FormData) => api.post<LoanCase>(`/cases/${id}/upload-doc`, formData),
  deleteDoc: (id: string, docId: string) => api.del<LoanCase>(`/cases/${id}/docs/${docId}`),
  editDoc: (id: string, docId: string, body: { fileName?: string; remarks?: string }) => api.put<LoanCase>(`/cases/${id}/docs/${docId}`, body),
  submitForVerification: (id: string) => api.put<LoanCase>(`/cases/${id}/submit-for-verification`),
};

export const customersApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) =>
    api.get<SalesCustomer[]>("/customers", q),
  update: (id: string, body: { firstName?: string; lastName?: string; phone?: string; alternatePhone?: string; email?: string }) =>
    api.put<SalesCustomer>(`/customers/${id}`, body),
};

export function getCurrentUserId(): string | null {
  const token = tokenStore.access;
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]))?.sub ?? null;
  } catch { return null; }
}

export const banksApi = {
  list: () => api.get<Bank[]>("/banks"),
};

export const dealersApi = {
  list: () => api.get<Dealer[]>("/dealers"),
};

export const insuranceApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<InsuranceMIS[]>("/insurance-mis", q),
  create: (body: unknown) => api.post<InsuranceMIS>("/insurance-mis", body),
  update: (id: string, body: unknown) => api.put<InsuranceMIS>(`/insurance-mis/${id}`, body),
  delete: (id: string) => api.del(`/insurance-mis/${id}`),
};

export const insurancePoliciesApi = {
  list: () => api.get<InsurancePolicy[]>("/insurance-policies"),
};

export const rtoApi = {
  list: (caseId?: string) => api.get<RTORecord[]>("/rto-tracker", caseId ? { caseId } : undefined),
  upsertByCase: (caseId: string, body: unknown) => api.put<RTORecord>(`/rto-tracker/by-case/${caseId}`, body),
};

export const payoutApi = {
  list: (month?: string) => api.get<PayoutRecord[]>("/payout", month ? { month } : undefined),
  months: () => api.get<string[]>("/payout/months"),
};

export const mastersApi = {
  list: (resource: string) => api.get<any[]>(`/master/${resource}`),
};

// ── Form Schema Types & API ───────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'select' | 'tel' | 'date' | 'boolean';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options: string[];
  order: number;
  isCore: boolean;
  isActive: boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  fields: FieldDef[];
}

export interface FormSchema {
  formId: string;
  sections: SectionDef[];
}

export const formSchemasApi = {
  get: (formId: string) => api.get<FormSchema>(`/form-schemas/${formId}`),
};

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
  weeklyOffDays: number[];  // 0=Sun,1=Mon,...,6=Sat
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

// ── Insurance Leads ──────────────────────────────────────────────────────────

export type InsuranceLeadStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
export type InsuranceLeadSource = 'walk_in' | 'referral' | 'campaign' | 'online' | 'other';

export interface InsuranceLead {
  _id: string;
  leadCode: string;
  firstName: string;
  lastName: string;
  contact: string;
  altContact?: string;
  vehicleType?: string;
  vehicleModel?: string;
  regNumber?: string;
  vehicleYear?: number;
  existingInsurer?: string;
  policyExpiryDate?: string;
  location?: string;
  state?: string;
  status: InsuranceLeadStatus;
  source: InsuranceLeadSource;
  remarks?: string;
  followUpDate?: string;
  assignedTo?: { _id: string; firstName: string; lastName: string } | null;
  createdByName: string;
  convertedMisId?: string;
  convertedAt?: string;
  createdAt: string;
}

export interface InsuranceLeadStats {
  total: number; new: number; contacted: number;
  interested: number; converted: number; lost: number;
}

export const insuranceLeadsApi = {
  list:   (q?: Record<string, any>) =>
    api.get<{ leads: InsuranceLead[]; total: number }>('/insurance-leads', { mine: true, ...q }),
  stats:  () => api.get<InsuranceLeadStats>('/insurance-leads/stats'),
  create: (body: Partial<InsuranceLead>) => api.post<InsuranceLead>('/insurance-leads', body),
  update: (id: string, body: Partial<InsuranceLead>) => api.put<InsuranceLead>(`/insurance-leads/${id}`, body),
};

