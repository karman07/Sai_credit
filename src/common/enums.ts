// ════════════════════════════════════════════════════════════════════
// Fixed enums — values that drive business logic and never change without
// a code deploy. Everything else (insurers, banks, policy types, renewal
// statuses, ...) lives in the `masters` collection and is admin-configurable.
// ════════════════════════════════════════════════════════════════════

export enum UserRole {
  Owner = 'owner',
  Admin = 'admin',
  Operations = 'operations',
  SalesExecutive = 'sales_executive',
  Telecaller = 'telecaller',
  RelationshipManager = 'relationship_manager',
  Coordinator = 'coordinator',
}

/** Roles whose data access is scoped to records assigned to them. */
export const SALES_ROLES: UserRole[] = [
  UserRole.SalesExecutive,
  UserRole.Telecaller,
  UserRole.RelationshipManager,
];

export const ADMIN_PORTAL_ROLES: UserRole[] = [
  UserRole.Owner,
  UserRole.Admin,
  UserRole.Operations,
];

export const isSalesRole = (role: UserRole) => SALES_ROLES.includes(role);

/**
 * Roles that manage only their own HR records (leave/claims/attendance/payroll) —
 * sales reps plus coordinators, who self-service exactly like sales but are not
 * eligible for the sales portal (see isSalesRole) or its per-case scoping rules.
 */
export const SELF_SERVICE_ROLES: UserRole[] = [...SALES_ROLES, UserRole.Coordinator];

export const isSelfServiceRole = (role: UserRole) => SELF_SERVICE_ROLES.includes(role);

export enum Portal {
  Admin = 'admin',
  Sales = 'sales',
  Coordinator = 'coordinator',
}

export enum CustomerType {
  Individual = 'individual',
  Corporate = 'corporate',
}

export enum PolicyStatus {
  Active = 'active',
  ExpiringSoon = 'expiring_soon',
  Expired = 'expired',
  Cancelled = 'cancelled',
  Lapsed = 'lapsed',
  Endorsed = 'endorsed',
}

export enum FollowUpType {
  Call = 'call',
  WhatsApp = 'whatsapp',
  Email = 'email',
  Meeting = 'meeting',
  Note = 'note',
}

export enum FollowUpStatus {
  Pending = 'pending',
  Completed = 'completed',
  Cancelled = 'cancelled',
  Rescheduled = 'rescheduled',
}

export enum DocumentType {
  PolicyDoc = 'policy_doc',
  RC = 'rc',
  Aadhaar = 'aadhaar',
  PAN = 'pan',
  LoanDoc = 'loan_doc',
  Photo = 'photo',
  Other = 'other',
}

export enum Priority {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum AuditAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
  View = 'view',
  Export = 'export',
  Login = 'login',
  Logout = 'logout',
}

/** Discriminator for the unified master-data collection. */
export enum MasterType {
  InsuranceCompany = 'insurance_company',
  Bank = 'bank',
  VehicleType = 'vehicle_type',
  FuelType = 'fuel_type',
  State = 'state',
  City = 'city',
  RtoOffice = 'rto_office',
  PolicyType = 'policy_type',
  AddonType = 'addon_type',
  RenewalStatus = 'renewal_status',
  DocumentType = 'document_type',
  EnumSet = 'enum_set',
  CaseStatus = 'case_status',
}

export enum EntityType {
  Customer = 'customer',
  Vehicle = 'vehicle',
  Policy = 'policy',
  Renewal = 'renewal',
}

// ════════════════════════════════════════════════════════════════════
// Loan origination domain
// ════════════════════════════════════════════════════════════════════

export enum CaseStatus {
  Draft = 'Draft',
  Sales = 'Sales',
  Pending = 'Pending',
  InCredit = 'In Credit',
  Incomplete = 'Incomplete',
  Approved = 'Approved',
  Disbursed = 'Disbursed',
  Hold = 'Hold',
  Rejected = 'Rejected',
  Cancelled = 'Cancelled',
}

export enum ProductType {
  CarLoan = 'Car Loan',
  Truck = 'Truck',
  PersonalLoan = 'Personal Loan',
  BTTopup = 'BT Topup',
  TwoWheeler = 'Two Wheeler',
}

export enum LoanType {
  New = 'New',
  Used = 'Used',
  Refinance = 'Refinance',
}

export enum ChecklistItemStatus {
  Received = 'Received',
  Pending = 'Pending',
  NotRequired = 'Not Required',
}

export enum PayoutStatus {
  Received = 'Received',
  Pending = 'Pending',
  NotApplicable = 'Not Applicable',
}

export enum InvoiceStatus {
  Submitted = 'Submitted',
  Draft = 'Draft',
  NotSubmitted = 'Not Submitted',
}

export enum ActivityType {
  StatusChange = 'status_change',
  Remark = 'remark',
  Document = 'document',
  Created = 'created',
  BankAssigned = 'bank_assigned',
  DealerAssigned = 'dealer_assigned',
  Assigned = 'assigned',
  DocumentRequested = 'document_requested',
  DocumentUploaded = 'document_uploaded',
  Resubmitted = 'resubmitted',
}

export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  HalfDay = 'half_day',
  OnLeave = 'on_leave',
  Holiday = 'holiday',
}

export enum LeaveType {
  Casual = 'casual',
  Sick = 'sick',
  Earned = 'earned',
  Unpaid = 'unpaid',
}

export enum ClaimType {
  Travel = 'travel',
  Food = 'food',
  Accommodation = 'accommodation',
  Other = 'other',
}

export enum ClaimStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum LeaveStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

export enum PayrollStatus {
  Draft = 'draft',
  Processed = 'processed',
  Paid = 'paid',
}

/** Maps ProductType to the caseCode prefix. */
export const PRODUCT_CODE_PREFIX: Record<ProductType, string> = {
  [ProductType.CarLoan]: 'CAR',
  [ProductType.Truck]: 'TRK',
  [ProductType.PersonalLoan]: 'PL',
  [ProductType.BTTopup]: 'BT',
  [ProductType.TwoWheeler]: 'TW',
};
