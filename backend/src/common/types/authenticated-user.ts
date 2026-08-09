export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  teacherId: string | null;
}

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
}
