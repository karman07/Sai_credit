import { z } from 'zod';
import { LoanType, Firm } from '../common/enums';
import { optionalPhone } from '../common/validators/phone';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

const CustomerSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fatherName: z.string().optional(),
  contact: optionalPhone(),
  altContact: optionalPhone(),
  location: z.string().optional(),
  state: z.string().optional(),
  district: z.string().optional(),
  pinCode: z.string().optional(),
  residentialStatus: z.string().optional(),
  ebillOwner: z.boolean().optional(),
});

export const CreateCaseSchema = z.object({
  customer: CustomerSchema,
  product: z.string().min(1).optional(),
  loanType: z.enum(Object.values(LoanType) as [string, ...string[]]).optional(),
  firm: z.enum(Object.values(Firm) as [string, ...string[]]).optional(),
  vehicleModel: z.string().optional(),
  regNumber: z.string().optional(),
  ownerSerial: z.string().optional(),
  existingInsurer: z.string().optional(),
  hypothecation: z.boolean().optional(),
  nocRequired: z.boolean().optional(),
  challanCount: z.number().int().min(0).optional(),
  loanAmount: z.number().min(0).optional(),
  bankId: objectId.optional(),
  bankBranch: z.string().optional(),
  bmName: z.string().optional(),
  bmContact: optionalPhone(),
  bankExecutive: z.string().optional(),
  dealerId: objectId.optional(),
  payoutPct: z.number().min(0).max(100).optional(),
  assignedTo: objectId.optional(),
  remarks: z.string().optional(),
  status: z.string().min(1).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});
export type CreateCaseDto = z.infer<typeof CreateCaseSchema>;

export const UpdateCaseSchema = CreateCaseSchema.partial();
export type UpdateCaseDto = z.infer<typeof UpdateCaseSchema>;

export const UpdateCaseStatusSchema = z.object({
  status: z.string().min(1),
  disbursementDate: z.string().optional(),
  note: z.string().optional(),
});
export type UpdateCaseStatusDto = z.infer<typeof UpdateCaseStatusSchema>;

export const AssignCaseSchema = z.object({
  userId: objectId,
  userName: z.string().min(1),
});
export type AssignCaseDto = z.infer<typeof AssignCaseSchema>;

export const AssignCoordinatorSchema = z.object({
  // Omit/null to unassign the coordinator entirely.
  userId: objectId.nullable().optional(),
});
export type AssignCoordinatorDto = z.infer<typeof AssignCoordinatorSchema>;

export const RequestDocsSchema = z.object({
  docTypes: z.array(z.string().min(1)).min(1, 'At least one document type required'),
  remarks: z.string().min(1, 'Remarks are required'),
});
export type RequestDocsDto = z.infer<typeof RequestDocsSchema>;

export const UploadDocSchema = z.object({
  docType: z.string().min(1),
  fileName: z.string().min(1),
  url: z.string().optional(),
  remarks: z.string().optional(),
});
export type UploadDocDto = z.infer<typeof UploadDocSchema>;

export const EditDocSchema = z.object({
  fileName: z.string().min(1).optional(),
  remarks: z.string().optional(),
});
export type EditDocDto = z.infer<typeof EditDocSchema>;

export const UpdatePipelineStageSchema = z.object({
  status: z.enum(['Pending', 'Done', 'NA']),
  remarks: z.string().optional(),
});
export type UpdatePipelineStageDto = z.infer<typeof UpdatePipelineStageSchema>;

// ════════════════════════════════════════════════════════════════════
// Case list / analytics filters. Parsed leniently from the query string (never throws):
// unknown or malformed values are dropped so a bad URL can't break a list page.
// Multi-value filters accept comma-separated values (`status=Approved,Disbursed`).
// ════════════════════════════════════════════════════════════════════

export const CASE_SORT_FIELDS = ['createdAt', 'loanAmount', 'disbursementDate', 'caseCode', 'status', 'bankName', 'dealerName', 'assignedToName'] as const;

export interface CaseFilter {
  page: number;
  limit: number;
  search?: string;
  status?: string[];
  bankId?: string[];
  dealerId?: string[];
  product?: string[];
  firm?: string[];
  loanType?: string[];
  assignedTo?: string[];
  coordinatorId?: string[];
  state?: string[];
  city?: string[];
  createdFrom?: Date;
  createdTo?: Date;
  disbursedFrom?: Date;
  disbursedTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  hypothecation?: boolean;
  nocRequired?: boolean;
  openDocRequests?: boolean;
  hasDocuments?: boolean;
  sortBy: (typeof CASE_SORT_FIELDS)[number];
  order: 1 | -1;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

function list(v: unknown): string[] | undefined {
  if (typeof v !== 'string') return undefined;
  const items = v.split(',').map((s) => s.trim()).filter(Boolean);
  return items.length ? items : undefined;
}
function ids(v: unknown): string[] | undefined {
  return list(v)?.filter((x) => OBJECT_ID.test(x));
}
function day(v: unknown, endOfDay = false): Date | undefined {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return isNaN(d.getTime()) ? undefined : d;
}
function num(v: unknown): number | undefined {
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function bool(v: unknown): boolean | undefined {
  return v === 'true' ? true : v === 'false' ? false : undefined;
}

export function parseCaseFilter(raw: Record<string, unknown> = {}): CaseFilter {
  const status = list(raw.status)?.filter((s) => s !== 'All');
  const sortBy = (CASE_SORT_FIELDS as readonly string[]).includes(raw.sortBy as string)
    ? (raw.sortBy as CaseFilter['sortBy'])
    : 'createdAt';
  const search = typeof raw.search === 'string' && raw.search.trim() ? raw.search.trim() : undefined;
  return {
    page: Math.max(1, Math.floor(num(raw.page) ?? 1)),
    limit: Math.min(10000, Math.max(1, Math.floor(num(raw.limit) ?? 25))),
    search,
    status: status?.length ? status : undefined,
    bankId: ids(raw.bankId),
    dealerId: ids(raw.dealerId),
    product: list(raw.product),
    firm: list(raw.firm),
    loanType: list(raw.loanType),
    assignedTo: ids(raw.assignedTo),
    coordinatorId: ids(raw.coordinatorId),
    state: list(raw.state),
    city: list(raw.city),
    createdFrom: day(raw.createdFrom),
    createdTo: day(raw.createdTo, true),
    disbursedFrom: day(raw.disbursedFrom ?? raw.from),
    disbursedTo: day(raw.disbursedTo ?? raw.to, true),
    minAmount: num(raw.minAmount),
    maxAmount: num(raw.maxAmount),
    hypothecation: bool(raw.hypothecation),
    nocRequired: bool(raw.nocRequired),
    openDocRequests: bool(raw.openDocRequests),
    hasDocuments: bool(raw.hasDocuments),
    sortBy,
    order: raw.order === 'asc' ? 1 : -1,
  };
}
