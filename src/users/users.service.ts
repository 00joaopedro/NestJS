import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { toTenantSummary } from '../tenancy/tenant.utils';

type CreateTenantUserInput = {
  email?: string;
  password?: string;
  role?: Role;
  tenantId?: string;
};

const TENANT_MANAGED_ROLES: Role[] = [
  Role.Admin,
  Role.Vendedor,
  Role.Comprador,
];

function isConflictError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('duplicate')
  );
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async list(currentUser?: Express.AuthenticatedUser) {
    const user = this.tenantAccess.requireUser(currentUser);

    const users = await this.prisma.profile.findMany({
      where:
        user.role === Role.SuperAdmin
          ? undefined
          : { tenantId: this.tenantAccess.requireTenantId(user) },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ok: true,
      users: users.map((profile) => ({
        ...profile,
        tenant: toTenantSummary(profile.tenant),
      })),
    };
  }

  async create(
    currentUser: Express.AuthenticatedUser | undefined,
    input: CreateTenantUserInput,
  ) {
    const user = this.tenantAccess.requireUser(currentUser);
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const role = this.parseManagedRole(input.role);
    const tenant = await this.tenantAccess.resolveTenantForOperation(
      user,
      input.tenantId,
    );

    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (isConflictError(error.message)) {
        throw new ConflictException(error.message);
      }

      throw new BadRequestException(error.message);
    }

    const authUser = data.user;

    if (!authUser) {
      throw new InternalServerErrorException(
        'Supabase did not return the created user.',
      );
    }

    try {
      const profile = await this.prisma.profile.create({
        data: {
          id: authUser.id,
          email: authUser.email ?? email,
          role,
          tenantId: tenant.id,
        },
        select: {
          id: true,
          email: true,
          role: true,
          tenantId: true,
          createdAt: true,
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      return {
        ok: true,
        user: {
          ...profile,
          tenant: toTenantSummary(profile.tenant),
        },
      };
    } catch {
      await this.supabase.admin.auth.admin
        .deleteUser(authUser.id)
        .catch(() => undefined);

      throw new InternalServerErrorException(
        'User creation failed while creating the profile. The authentication user was rolled back.',
      );
    }
  }

  async updateRole(
    currentUser: Express.AuthenticatedUser | undefined,
    profileId: string,
    nextRole?: Role,
  ) {
    const user = this.tenantAccess.requireUser(currentUser);
    const role = this.parseManagedRole(nextRole, true);
    const profile = await this.tenantAccess.findAccessibleProfile(
      user,
      profileId,
    );

    if (user.role !== Role.SuperAdmin && profile.id === user.id) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    const updatedProfile = await this.prisma.profile.update({
      where: { id: profileId },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return {
      ok: true,
      user: {
        ...updatedProfile,
        tenant: toTenantSummary(updatedProfile.tenant),
      },
    };
  }

  private normalizeEmail(email?: string) {
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('email and password are required');
    }

    return normalizedEmail;
  }

  private normalizePassword(password?: string) {
    if (!password) {
      throw new BadRequestException('email and password are required');
    }

    if (password.length < 6) {
      throw new BadRequestException(
        'password must be at least 6 characters',
      );
    }

    return password;
  }

  private parseManagedRole(
    role?: Role,
    required = false,
  ): Role {
    if (!role) {
      if (required) {
        throw new BadRequestException('role is required');
      }

      return Role.Comprador;
    }

    if (!TENANT_MANAGED_ROLES.includes(role)) {
      throw new BadRequestException(
        `role must be one of: ${TENANT_MANAGED_ROLES.join(', ')}`,
      );
    }

    return role;
  }
}
