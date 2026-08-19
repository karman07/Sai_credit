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
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
};

// ── Domain types ─────────────────────────────────────────────────────

export type CaseStatus = "Draft" | "Sales" | "Pending" | "In Credit" | "Incomplete" | "Approved" | "Disbursed" | "Hold" | "Rejected" | "Cancelled";
export const CASE_STATUSES: CaseStatus[] = ["Draft", "Sales", "Pending", "In Credit", "Incomplete", "Approved", "Disbursed", "Hold", "Rejected", "Cancelled"];
export const RTO_STATUSES = ["Pending", "Documents Pending", "Under Verification", "Approved", "Insurance Endorsement Pending", "Completed", "On Hold", "Rejected"];
/** Products where vehicle RTO registration transfer is relevant. */
export const VEHICLE_PRODUCTS = ["Car Loan", "Commercial Vehicle Loan"];
export const LOAN_TYPES = ["New", "Used", "Refinance"] as const;
export const RESIDENTIAL_STATUSES = ["Own", "Rented", "Family Owned"] as const;
export const FIRMS = ["Sai Credit Solutions Partner", "Sai Credit Solutions Proprietor", "Sai Carz"] as const;
export const CHECKLIST_STATUSES = ["Received", "Pending", "Not Required"] as const;

export const PIPELINE_STAGES = [
  "CIBIL & TVR", "Documentation", "Field Verification", "Valuation",
  "In Credit", "RTO Documents", "Approved", "Detail Confirmation", "Disbursed",
] as const;
export type PipelineStageName = typeof PIPELINE_STAGES[number];

export const RTO_OWNERSHIP_TYPES = ["Banker", "Dealer", "Sai Credit Solutions"] as const;
export const INSURANCE_OWNER_TYPES = ["Bank", "Sai Credit", "Dealer"] as const;

export interface PipelineItem {
  stage: string;
  status: "Pending" | "Done" | "NA";
  doneAt?: string;
  doneByName?: string;
  remarks?: string;
}

export interface Bank { _id: string; name: string; branch?: string; bmName?: string; bmContact?: string; executive?: string; isActive: boolean; createdAt: string; }
export interface Dealer { _id: string; name: string; contact?: string; location?: string; isActive: boolean; createdAt: string; }
export interface SalesUser { _id: string; firstName: string; lastName: string; email: string; role: string; isActive: boolean; }
export interface DocumentType { _id: string; name: string; isActive: boolean; }

export interface MasterItem {
  _id: string; type: string; name: string; code?: string; shortName?: string;
  parentId?: string; colorClass?: string; isTerminal?: boolean;
  category?: string; metadata?: Record<string, unknown>;
  sortOrder?: number; isActive: boolean; createdAt: string;
}

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
  customer: { firstName: string; lastName: string; fatherName?: string; contact: string; altContact?: string; location?: string; state?: string; district?: string; pinCode?: string; residentialStatus?: string; ebillOwner?: boolean; };
  product: string; loanType?: string; firm?: string; vehicleModel?: string; regNumber?: string; ownerSerial?: string;
  existingInsurer?: string; hypothecation?: boolean; nocRequired?: boolean; challanCount?: number; loanAmount?: number;
  bankId?: string; bankName?: string; bankBranch?: string; bmName?: string; bmContact?: string; bankExecutive?: string;
  dealerId?: string; dealerName?: string; payoutPct?: number;
  status: CaseStatus; disbursementDate?: string;
  remarks?: string;
  assignedTo?: string; assignedToName?: string;
  coordinatorId?: string; coordinatorName?: string;
  pipeline: PipelineItem[];
  documents: CaseDocument[];
  docRequests: DocRequest[];
  customFields?: Record<string, any>;
  createdAt: string; isActive: boolean;
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

export interface InsurancePolicy {
  _id: string; name: string; insurer: string;
  coverageType: string; vehicleTypes: string[];
  premiumAmount: number; idvAmount?: number; tenure: number;
  description?: string; isActive: boolean; createdAt: string;
}

export interface InsuranceMIS {
  _id: string; caseId?: string; caseCode?: string; customerName?: string; customerEmail?: string; vehicleModel?: string;
  policyId?: string; policyName?: string; coverageType?: string; vehicleType?: string;
  premiumAmount: number; insurer: string; ownerType: string;
  insuredName?: string; agentName?: string;
  endorsement?: { date?: string; note?: string };
  reminderDate?: string;
  startDate: string; endDate: string;
  holdAmount: number; renewal: boolean; createdByName?: string; isActive: boolean; createdAt: string;
  customFields?: Record<string, any>;
  renewalHistory?: { renewedAt: string; oldEndDate?: string; newEndDate: string; renewedByName?: string }[];
  lastRenewedAt?: string;
}

export interface RTORecord {
  _id: string; caseId?: string; caseCode?: string; customerName?: string;
  status?: string;
  rtoOwnershipType?: string;
  rtoOwnership: string; rtoReceiving: boolean;
  challanCheck: string; bankNocCheck: string; nocHoldAmt: number;
  insuranceCheck: string; hypothecation: string;
  aadhaarMatch: string; aadhaarMismatchNote?: string;
  pendingDocuments: string[];
  rtoSlipUrl?: string; rtoSlipFileName?: string;
  verification: string; approval: string; approvalDate?: string;
  insuranceEndorsement: string; balancePayment: number;
  remarks?: string; createdAt: string;
  customFields?: Record<string, any>;
}

export interface AppNotification {
  _id: string; userId: string; type: string;
  title: string; message: string;
  caseId?: string; caseCode?: string;
  isRead: boolean; createdAt: string;
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

export interface CaseTrendPoint { date: string; leads: number; disbursed: number; volume: number }

export interface StatsFilters {
  from?: string; to?: string; bankId?: string; product?: string; firm?: string;
}

// ── Domain API helpers ────────────────────────────────────────────────

export const casesApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<LoanCase[]>("/cases", q),
  listWithMeta: (q?: Record<string, string | number | boolean | undefined>) => api.get<LoanCase[]>("/cases", q),
  get: (id: string) => api.get<LoanCase>(`/cases/${id}`),
  stats: (q?: StatsFilters) => api.get<DashboardStats>("/cases/stats", q as Record<string, string | undefined>),
  trend: (q?: StatsFilters & { groupBy?: "day" | "month"; status?: string }) =>
    api.get<CaseTrendPoint[]>("/cases/stats/trend", q as Record<string, string | undefined>),
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
  updatePipelineStage: (id: string, stage: string, body: { status: "Pending" | "Done" | "NA"; remarks?: string }) =>
    api.put<LoanCase>(`/cases/${id}/pipeline/${encodeURIComponent(stage)}`, body),
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

export const payoutApi = {
  list: (month?: string, bankId?: string) => api.get<PayoutRecord[]>("/payout", { month, bankId }),
  months: () => api.get<string[]>("/payout/months"),
  create: (body: unknown) => api.post<PayoutRecord>("/payout", body),
  update: (id: string, body: unknown) => api.put<PayoutRecord>(`/payout/${id}`, body),
  delete: (id: string) => api.del(`/payout/${id}`),
};

export const insuranceApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<InsuranceMIS[]>("/insurance-mis", q),
  create: (body: unknown) => api.post<InsuranceMIS>("/insurance-mis", body),
  update: (id: string, body: unknown) => api.put<InsuranceMIS>(`/insurance-mis/${id}`, body),
  requestRenewal: (id: string) => api.put<InsuranceMIS>(`/insurance-mis/${id}/request-renewal`),
  delete: (id: string) => api.del(`/insurance-mis/${id}`),
};

export const insurancePoliciesApi = {
  list: (includeInactive = false) => api.get<InsurancePolicy[]>("/insurance-policies", includeInactive ? { includeInactive: true } : undefined),
  create: (body: unknown) => api.post<InsurancePolicy>("/insurance-policies", body),
  update: (id: string, body: unknown) => api.put<InsurancePolicy>(`/insurance-policies/${id}`, body),
  toggleStatus: (id: string) => api.put<{ id: string; isActive: boolean }>(`/insurance-policies/${id}/toggle-status`),
  delete: (id: string) => api.del(`/insurance-policies/${id}`),
};

export const rtoApi = {
  list: (caseId?: string) => api.get<RTORecord[]>("/rto-tracker", caseId ? { caseId } : undefined),
  create: (body: unknown) => api.post<RTORecord>("/rto-tracker", body),
  update: (id: string, body: unknown) => api.put<RTORecord>(`/rto-tracker/${id}`, body),
  upsertByCase: (caseId: string, body: unknown) => api.put<RTORecord>(`/rto-tracker/by-case/${caseId}`, body),
  uploadSlip: (id: string, formData: FormData) => api.post<RTORecord>(`/rto-tracker/${id}/upload-slip`, formData),
};

export const notificationsApi = {
  list: (limit?: number) => api.get<AppNotification[]>("/notifications", limit ? { limit } : undefined),
  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),
  markRead: (id: string) => api.patch<AppNotification>(`/notifications/${id}/read`),
  markUnread: (id: string) => api.patch<AppNotification>(`/notifications/${id}/unread`),
  markAllRead: () => api.patch<{ ok: boolean }>("/notifications/read-all"),
};

export interface AdminUser {
  _id: string; firstName: string; lastName: string;
  email: string; phone?: string; role: string;
  isActive: boolean; lastLogin?: string; createdAt: string;
  employeeCode?: string;
  basicSalary?: number;
  hra?: number;
  travelAllowance?: number;
  da?: number;
  medicalAllowance?: number;
  otherAllowance?: number;
  designation?: string;
  department?: string;
  joiningDate?: string;
  annualLeaveQuota?: number;
  coordinatorId?: string;
}

export interface CreateUserBody {
  firstName: string; lastName: string; email: string;
  password: string; role: string; phone?: string;
  employeeCode?: string;
  basicSalary?: number;
  hra?: number; travelAllowance?: number; da?: number;
  medicalAllowance?: number; otherAllowance?: number;
  designation?: string; department?: string; joiningDate?: string;
  annualLeaveQuota?: number;
  coordinatorId?: string;
}

export interface UpdateUserBody {
  firstName?: string; lastName?: string; email?: string;
  role?: string; phone?: string;
  employeeCode?: string;
  basicSalary?: number;
  hra?: number; travelAllowance?: number; da?: number;
  medicalAllowance?: number; otherAllowance?: number;
  designation?: string; department?: string; joiningDate?: string;
  annualLeaveQuota?: number;
  coordinatorId?: string;
}

export const usersApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) => api.get<AdminUser[]>("/users", q),
  create: (body: CreateUserBody) => api.post<AdminUser>("/users", body),
  update: (id: string, body: UpdateUserBody) => api.put<AdminUser>(`/users/${id}`, body),
  toggleStatus: (id: string) => api.put<{ id: string; isActive: boolean }>(`/users/${id}/toggle-status`),
  setPassword: (id: string, password: string) => api.put<{ id: string; success: boolean }>(`/users/${id}/set-password`, { password }),
};

export const mastersApi = {
  list: (resource: string, includeInactive = false) =>
    api.get<MasterItem[]>(`/master/${resource}`, includeInactive ? { includeInactive: true } : undefined),
  create: (resource: string, body: unknown) => api.post<MasterItem>(`/master/${resource}`, body),
  update: (resource: string, id: string, body: unknown) => api.put<MasterItem>(`/master/${resource}/${id}`, body),
  toggle: (resource: string, id: string) => api.put<{ id: string; isActive: boolean }>(`/master/${resource}/${id}/toggle-status`),
};

export interface MailTemplate {
  _id: string; key: string; name: string; description?: string;
  variables: string[]; subject: string; html: string; isActive: boolean;
  updatedAt: string;
}

export const mailTemplatesApi = {
  list: () => api.get<MailTemplate[]>("/mail-templates"),
  get: (key: string) => api.get<MailTemplate>(`/mail-templates/${key}`),
  update: (key: string, body: { subject: string; html: string; isActive?: boolean }) =>
    api.put<MailTemplate>(`/mail-templates/${key}`, body),
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
  list: () => api.get<FormSchema[]>(`/form-schemas`),
  get: (formId: string) => api.get<FormSchema>(`/form-schemas/${formId}`),
  update: (formId: string, body: { sections: SectionDef[] }) => api.put<FormSchema>(`/form-schemas/${formId}`, body),
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

export interface StaffAttendanceSummary {
  userId: string; name: string; employeeCode?: string; role: string;
  basicSalary: number; present: number; halfDay: number; absent: number; onLeave: number; totalMarked: number;
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

export interface Incentive { reason: string; amount: number; }
export interface AdditionalDeduction { reason: string; amount: number; }

export interface PayrollRecord {
  _id: string;
  userId: string | { _id: string; firstName: string; lastName: string; employeeCode?: string; role: string; designation?: string };
  month: string;
  basicSalary: number;
  hra: number;
  travelAllowance: number;
  da: number;
  medicalAllowance: number;
  otherAllowance: number;
  workingDaysInMonth: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  leaveDays: number;
  paidLeaveDays: number;
  lwpDays: number;
  incentives: Incentive[];
  additionalDeductions: AdditionalDeduction[];
  reimbursementTotal: number;
  lopDeduction: number;
  grossPay: number;
  netPay: number;
  status: 'draft' | 'processed' | 'paid';
  paidAt?: string;
  remarks?: string;
  processedBy?: string | { _id: string; firstName: string; lastName: string };
  createdAt: string;
}

// ── HR API helpers ────────────────────────────────────────────────────

export const attendanceApi = {
  list: (q?: Record<string, string | number | undefined>) =>
    api.get<{ records: AttendanceRecord[]; total: number }>('/attendance', q),
  summary: (userId: string, month: string) =>
    api.get<AttendanceSummary>('/attendance/summary', { userId, month }),
  staffList: (month: string) =>
    api.get<StaffAttendanceSummary[]>('/attendance/staff-list', { month }),
  adminMark: (body: { userId: string; date: string; status: string; clockIn?: string; clockOut?: string; note?: string }) =>
    api.post<AttendanceRecord>('/attendance/admin-mark', body),
  update: (id: string, body: { status?: string; clockIn?: string; clockOut?: string; note?: string }) =>
    api.put<AttendanceRecord>(`/attendance/${id}`, body),
  autoMarkAbsent: (date: string) =>
    api.post<{ marked: number; skipped: number }>('/attendance/auto-mark-absent', { date }),
  backfillMonth: (month: string) =>
    api.post<{ marked: number; skipped: number }>('/attendance/backfill-month', { month }),
};

export const claimsApi = {
  list: (q?: Record<string, string | number | undefined>) =>
    api.get<{ claims: Claim[]; total: number }>('/claims', q),
  review: (id: string, body: { status: 'approved' | 'rejected'; reviewNote?: string }) =>
    api.put<Claim>(`/claims/${id}/review`, body),
};

export interface UserPayrollOverview {
  user: {
    _id: string; firstName: string; lastName: string;
    role: string; designation?: string; employeeCode?: string; basicSalary: number;
  };
  payroll: PayrollRecord | null;
  attendance: { present: number; halfDay: number; absent: number; onLeave: number };
  cases: { total: number; disbursed: number; rejected: number; inProgress: number };
}

export const payrollApi = {
  overview: (month?: string) =>
    api.get<UserPayrollOverview[]>('/payroll/overview', month ? { month } : undefined),
  generateAll: (month: string) =>
    api.post<{ generated: number; refreshed: number; skipped: number }>('/payroll/generate-all', { month }),
  generateForUser: (userId: string, month: string) =>
    api.post<{ result: string }>('/payroll/generate-for-user', { userId, month }),
  list: (q?: Record<string, string | number | undefined>) =>
    api.get<{ payrolls: PayrollRecord[]; total: number }>('/payroll', q),
  get: (id: string) => api.get<PayrollRecord>(`/payroll/${id}`),
  generate: (body: { userId: string; month: string; workingDaysInMonth?: number; remarks?: string }) =>
    api.post<PayrollRecord>('/payroll/generate', body),
  update: (id: string, body: Partial<PayrollRecord>) =>
    api.put<PayrollRecord>(`/payroll/${id}`, body),
};

export interface Leave {
  _id: string;
  userId: string | { _id: string; firstName: string; lastName: string; employeeCode?: string; role: string };
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
}

export const leavesApi = {
  list: (q?: Record<string, string | number | undefined>) =>
    api.get<{ leaves: Leave[]; total: number }>('/leaves', q),
  review: (id: string, body: { status: 'approved' | 'rejected'; reviewNote?: string }) =>
    api.put<Leave>(`/leaves/${id}/review`, body),
  balance: (userId?: string) =>
    api.get<LeaveBalance>('/leaves/balance', userId ? { userId } : undefined),
};

export interface Customer {
  _id: string;
  customerCode: string;
  customerType: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  whatsappNumber?: string;
  panNumber?: string;
  notes?: string;
  tags: string[];
  assignedTo?: { _id: string; firstName: string; lastName: string } | null;
  latestCaseStatus?: string;
  latestCaseCode?: string;
  totalCases: number;
  isActive: boolean;
  createdAt: string;
}

export const customersApi = {
  list: (q?: Record<string, string | number | boolean | undefined>) =>
    api.get<Customer[]>("/customers", q),
  get: (id: string) => api.get<Customer>(`/customers/${id}`),
  create: (body: { firstName: string; lastName: string; phone: string; email?: string }) =>
    api.post<Customer>("/customers", body),
  update: (id: string, body: Partial<Pick<Customer, "firstName" | "lastName" | "phone" | "alternatePhone" | "email" | "notes" | "tags">>) =>
    api.put<Customer>(`/customers/${id}`, body),
};

// ── Leave Policy Types & API ──────────────────────────────────────────

export interface LeaveTypeConfig {
  id: string; name: string; daysPerYear: number; isPaid: boolean; color: string;
}
export interface PublicHoliday { date: string; name: string; }
export interface LeavePolicy {
  weeklyOffDays: number[];
  leaveTypes: LeaveTypeConfig[];
  publicHolidays: PublicHoliday[];
}
export const leavePolicyApi = {
  get: () => api.get<LeavePolicy>('/leave-policy'),
  update: (body: Partial<LeavePolicy>) => api.put<LeavePolicy>('/leave-policy', body),
  addHoliday: (body: PublicHoliday) => api.post<LeavePolicy>('/leave-policy/holidays', body),
  removeHoliday: (date: string) => api.del<LeavePolicy>(`/leave-policy/holidays/${encodeURIComponent(date)}`),
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
  city?: string;
  status: InsuranceLeadStatus;
  source: InsuranceLeadSource;
  remarks?: string;
  followUpDate?: string;
  assignedTo?: { _id: string; firstName: string; lastName: string; role: string } | null;
  assignedToName?: string;
  convertedMisId?: string;
  convertedAt?: string;
  createdByName: string;
  createdAt: string;
  isActive: boolean;
}

export interface InsuranceLeadStats {
  total: number; new: number; contacted: number;
  interested: number; converted: number; lost: number;
}

export interface ConvertLeadBody {
  premiumAmount: number;
  insurer: string;
  startDate: string;
  endDate: string;
  policyId?: string;
  policyName?: string;
  coverageType?: string;
  insuredName?: string;
  agentName?: string;
  caseId?: string;
  ownerType?: 'Bank' | 'Sai Credit' | 'Dealer';
  holdAmount?: number;
  reminderDate?: string;
}

export const insuranceLeadsApi = {
  list:    (q?: Record<string, any>) =>
    api.get<{ leads: InsuranceLead[]; total: number; page: number; limit: number }>('/insurance-leads', q),
  stats:   () => api.get<InsuranceLeadStats>('/insurance-leads/stats'),
  get:     (id: string) => api.get<InsuranceLead>(`/insurance-leads/${id}`),
  create:  (body: Partial<InsuranceLead>) => api.post<InsuranceLead>('/insurance-leads', body),
  update:  (id: string, body: Partial<InsuranceLead>) => api.put<InsuranceLead>(`/insurance-leads/${id}`, body),
  convert: (id: string, body: ConvertLeadBody) => api.post<{ lead: InsuranceLead; mis: any }>(`/insurance-leads/${id}/convert`, body),
  delete:  (id: string) => api.del<{ id: string }>(`/insurance-leads/${id}`),
};
