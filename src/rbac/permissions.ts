import { UserRole } from '../common/enums';

// ════════════════════════════════════════════════════════════════════
// Permission catalogue. Format: `<module>.<action>`.
// `*.read` for sales roles is row-scoped to assigned records at the
// service layer (see ScopeGuard / service-level scope injection).
// ════════════════════════════════════════════════════════════════════

export type Permission =
  | 'customers.create' | 'customers.read' | 'customers.update' | 'customers.delete' | 'customers.export' | 'customers.assign'
  | 'vehicles.create' | 'vehicles.read' | 'vehicles.update'
  | 'policies.create' | 'policies.read' | 'policies.update' | 'policies.delete'
  | 'renewals.create' | 'renewals.read' | 'renewals.update'
  | 'followups.create' | 'followups.read' | 'followups.update' | 'followups.delete'
  | 'documents.upload' | 'documents.read' | 'documents.delete' | 'documents.verify'
  | 'cases.create' | 'cases.read' | 'cases.update' | 'cases.delete' | 'cases.assign' | 'cases.export'
  | 'banks.create' | 'banks.read' | 'banks.update' | 'banks.delete'
  | 'dealers.create' | 'dealers.read' | 'dealers.update' | 'dealers.delete'
  | 'payout.read' | 'payout.create' | 'payout.update'
  | 'insurance.read' | 'insurance.create' | 'insurance.update'
  | 'rto.read' | 'rto.update'
  | 'users.manage'
  | 'master.manage'
  | 'document_types.manage'
  | 'mail_templates.manage'
  | 'reports.view'
  | 'audit.view'
  | 'dashboard.admin' | 'dashboard.sales'
  | 'attendance.read' | 'attendance.clock' | 'attendance.manage'
  | 'claims.create' | 'claims.read' | 'claims.manage'
  | 'payroll.read' | 'payroll.manage'
  | 'leaves.create' | 'leaves.read' | 'leaves.manage'
  | 'leave_policy.read' | 'leave_policy.manage';

const ALL: Permission[] = [
  'customers.create','customers.read','customers.update','customers.delete','customers.export','customers.assign',
  'vehicles.create','vehicles.read','vehicles.update',
  'policies.create','policies.read','policies.update','policies.delete',
  'renewals.create','renewals.read','renewals.update',
  'followups.create','followups.read','followups.update','followups.delete',
  'documents.upload','documents.read','documents.delete','documents.verify',
  'cases.create','cases.read','cases.update','cases.delete','cases.assign','cases.export',
  'banks.create','banks.read','banks.update','banks.delete',
  'dealers.create','dealers.read','dealers.update','dealers.delete',
  'payout.read','payout.create','payout.update',
  'insurance.read','insurance.create','insurance.update',
  'rto.read','rto.update',
  'users.manage','master.manage','document_types.manage','mail_templates.manage','reports.view','audit.view',
  'dashboard.admin','dashboard.sales',
  'attendance.read','attendance.clock','attendance.manage',
  'claims.create','claims.read','claims.manage',
  'payroll.read','payroll.manage',
  'leaves.create','leaves.read','leaves.manage',
  'leave_policy.read','leave_policy.manage',
];

// Operations: everything except user management, audit, and hard deletes.
const OPERATIONS: Permission[] = [
  'customers.create','customers.read','customers.update','customers.export','customers.assign',
  'vehicles.create','vehicles.read','vehicles.update',
  'policies.create','policies.read','policies.update',
  'renewals.create','renewals.read','renewals.update',
  'followups.create','followups.read','followups.update','followups.delete',
  'documents.upload','documents.read','documents.delete','documents.verify',
  'cases.create','cases.read','cases.update','cases.assign','cases.export',
  'banks.read','banks.create','banks.update',
  'dealers.read','dealers.create','dealers.update',
  'payout.read','payout.create','payout.update',
  'insurance.read','insurance.create','insurance.update',
  'rto.read','rto.update',
  'master.manage','reports.view','dashboard.admin',
  'attendance.read','attendance.manage',
  'claims.read','claims.manage',
  'payroll.read','payroll.manage',
  'leaves.read','leaves.manage',
  'leave_policy.read','leave_policy.manage',
];

// Senior sales (executive / RM): can create cases, log insurance & RTO. They may
// also manage the Document Types catalog specifically (not the full Data
// Catalog — enforced at the service layer in MastersService, since permissions
// here aren't resource-scoped).
const SALES_SENIOR: Permission[] = [
  'customers.create','customers.read','customers.update',
  'vehicles.create','vehicles.read','vehicles.update',
  'policies.create','policies.read','policies.update',
  'renewals.create','renewals.read','renewals.update',
  'followups.create','followups.read','followups.update',
  'documents.upload','documents.read',
  'cases.create','cases.read','cases.update','cases.assign',
  'banks.read','dealers.read','dealers.create',
  'insurance.read','insurance.create','insurance.update',
  'rto.read','rto.update',
  'payout.read',
  'document_types.manage',
  'dashboard.sales',
  'attendance.read','attendance.clock',
  'claims.create','claims.read',
  'payroll.read',
  'leaves.create','leaves.read',
  'leave_policy.read',
];

// Telecaller: read cases, follow-ups & notes only. Also manages Document Types
// (see note on SALES_SENIOR above).
const TELECALLER: Permission[] = [
  'customers.read','customers.update',
  'vehicles.read',
  'policies.read',
  'renewals.read','renewals.update',
  'followups.create','followups.read','followups.update',
  'documents.upload','documents.read',
  'cases.read','cases.update',
  'banks.read','dealers.read','dealers.create',
  'payout.read',
  'document_types.manage',
  'dashboard.sales',
  'attendance.read','attendance.clock',
  'claims.create','claims.read',
  'payroll.read',
  'leaves.create','leaves.read',
  'leave_policy.read',
];

// Coordinator: manages (reads/edits/status/docs) only the cases created by their
// assigned sales reps (enforced at the service layer, not here), gets full
// admin-parity access to Payout Management, Form Builder, and the Data Catalog
// (masters), and self-services their own leave/reimbursement/attendance/payslip
// records just like a sales user.
const COORDINATOR: Permission[] = [
  'cases.read','cases.update',
  'banks.read','dealers.read','dealers.create',
  'insurance.read','insurance.create','insurance.update','policies.read',
  'payout.read','payout.create','payout.update',
  'master.manage',
  'dashboard.sales',
  'attendance.read','attendance.clock',
  'claims.create','claims.read',
  'payroll.read',
  'leaves.create','leaves.read',
  'leave_policy.read',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.Owner]: ALL,
  [UserRole.Admin]: ALL.filter((p) => p !== 'dashboard.sales'),
  [UserRole.Operations]: OPERATIONS,
  [UserRole.SalesExecutive]: SALES_SENIOR,
  [UserRole.RelationshipManager]: SALES_SENIOR,
  [UserRole.Telecaller]: TELECALLER,
  [UserRole.Coordinator]: COORDINATOR,
};

/** Permissions individually grantable to a specific user, layered on top of their role. */
const PER_USER_GRANTABLE: Permission[] = ['rto.read', 'rto.update'];

/**
 * Resolves whether `user` may perform `perm`. Most permissions are purely
 * role-based, but a few (currently RTO) can additionally be granted to one
 * specific coordinator at a time via `user.rtoAccess` — set through the Users
 * admin screen — rather than opening it up to every coordinator.
 */
export function hasPermission(user: { role: UserRole; rtoAccess?: boolean }, perm: Permission): boolean {
  if (ROLE_PERMISSIONS[user.role]?.includes(perm)) return true;
  if (user.role === UserRole.Coordinator && user.rtoAccess && PER_USER_GRANTABLE.includes(perm)) {
    return true;
  }
  return false;
}
