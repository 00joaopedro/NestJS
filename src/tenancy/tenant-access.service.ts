import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toTenantSummary } from './tenant.utils';

type AuthUser = Express.AuthenticatedUser;

@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  requireUser(user?: AuthUser): AuthUser {
    if (!user) {
      throw new UnauthorizedException('Authenticated user not found.');
    }

    return user;
  }

  requireTenantId(user: AuthUser): string {
    if (!user.tenantId) {
      throw new UnauthorizedException(
        'Authenticated user is not linked to a tenant.',
      );
    }

    return user.tenantId;
  }

  async findTenantOrThrow(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return tenant;
  }

  async getCurrentTenant(userInput?: AuthUser) {
    const user = this.requireUser(userInput);

    if (!user.tenantId) {
      if (user.role === Role.SuperAdmin) {
        return null;
      }

      throw new UnauthorizedException(
        'Authenticated user is not linked to a tenant.',
      );
    }

    return this.findTenantOrThrow(user.tenantId);
  }

  async resolveTenantForOperation(
    userInput?: AuthUser,
    requestedTenantId?: string | null,
  ) {
    const user = this.requireUser(userInput);

    if (user.role === Role.SuperAdmin) {
      const tenantId = requestedTenantId ?? user.tenantId;

      if (!tenantId) {
        throw new BadRequestException(
          'tenantId is required for this operation.',
        );
      }

      return this.findTenantOrThrow(tenantId);
    }

    const tenantId = this.requireTenantId(user);

    if (requestedTenantId && requestedTenantId !== tenantId) {
      throw new ForbiddenException(
        'You can only access data from your own tenant.',
      );
    }

    return this.findTenantOrThrow(tenantId);
  }

  async findAccessibleProfile(
    userInput: AuthUser | undefined,
    profileId: string,
  ) {
    const user = this.requireUser(userInput);
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
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

    if (!profile) {
      throw new NotFoundException('User profile not found.');
    }

    if (user.role !== Role.SuperAdmin) {
      const tenantId = this.requireTenantId(user);

      if (profile.tenantId !== tenantId) {
        throw new ForbiddenException(
          'You can only access users from your own tenant.',
        );
      }
    }

    return {
      ...profile,
      tenant: toTenantSummary(profile.tenant),
    };
  }
}
