import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface TenantSummary {
      id: string;
      name: string;
      slug: string;
    }

    interface AuthenticatedUser {
      id: string;
      email: string | null;
      role: Role;
      roles: Role[];
      tenantId: string | null;
      tenant: TenantSummary | null;
    }

    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
