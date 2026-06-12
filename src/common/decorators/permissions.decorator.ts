import { SetMetadata } from '@nestjs/common';
import { Permission } from '../../rbac/permissions';

export const PERMISSIONS_KEY = 'requiredPermissions';
/** Declares the permission(s) a route requires: `@RequirePermissions('customers.read')`. */
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
