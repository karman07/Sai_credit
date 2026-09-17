import { UserRole, Portal } from './enums';

/** Shape attached to req.user after JWT verification. */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  portal: Portal;
  firstName: string;
  lastName: string;
  /** Per-user override granting RTO access to an individual coordinator (see rbac/permissions.ts). */
  rtoAccess?: boolean;
}

export interface RequestContext {
  user: AuthUser;
  ip?: string;
  userAgent?: string;
}
