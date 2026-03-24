import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantAccessService } from '../tenancy/tenant-access.service';
import { generateUniqueTenantSlug } from '../tenancy/tenant.utils';

type CreateTenantInput = {
  name?: string;
  slug?: string;
};

type UpdateCurrentTenantInput = {
  name?: string;
  slug?: string;
};

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async list(currentUser?: Express.AuthenticatedUser) {
    const user = this.tenantAccess.requireUser(currentUser);

    if (user.role === Role.SuperAdmin) {
      const tenants = await this.prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: {
            select: {
              profiles: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        ok: true,
        tenants: tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          createdAt: tenant.createdAt,
          membersCount: tenant._count.profiles,
        })),
      };
    }

    const tenant = await this.tenantAccess.getCurrentTenant(user);

    if (!tenant) {
      throw new UnauthorizedException(
        'Authenticated user is not linked to a tenant.',
      );
    }

    return {
      ok: true,
      tenants: [await this.formatTenantWithMemberCount(tenant.id)],
    };
  }

  async getCurrent(currentUser?: Express.AuthenticatedUser) {
    const user = this.tenantAccess.requireUser(currentUser);
    const tenant = await this.tenantAccess.getCurrentTenant(user);

    if (!tenant) {
      return { ok: true, tenant: null };
    }

    return {
      ok: true,
      tenant: await this.formatTenantWithMemberCount(tenant.id),
    };
  }

  async create(
    currentUser: Express.AuthenticatedUser | undefined,
    input: CreateTenantInput,
  ) {
    this.tenantAccess.requireUser(currentUser);

    const name = input.name?.trim();

    if (!name) {
      throw new BadRequestException('name is required');
    }

    const slug = await this.buildUniqueTenantSlug(input.slug?.trim() || name);
    const tenant = await this.prisma.tenant.create({
      data: {
        name,
        slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
      },
    });

    return {
      ok: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        createdAt: tenant.createdAt,
        membersCount: 0,
      },
    };
  }

  async updateCurrent(
    currentUser: Express.AuthenticatedUser | undefined,
    input: UpdateCurrentTenantInput,
  ) {
    const user = this.tenantAccess.requireUser(currentUser);
    const currentTenant = await this.tenantAccess.getCurrentTenant(user);

    if (!currentTenant) {
      throw new UnauthorizedException(
        'Authenticated user is not linked to a tenant.',
      );
    }

    const data: { name?: string; slug?: string } = {};

    if (typeof input.name === 'string') {
      const name = input.name.trim();

      if (!name) {
        throw new BadRequestException('name cannot be empty');
      }

      data.name = name;
    }

    if (typeof input.slug === 'string') {
      const slugInput = input.slug.trim();

      if (!slugInput) {
        throw new BadRequestException('slug cannot be empty');
      }

      data.slug = await this.buildUniqueTenantSlug(
        slugInput,
        currentTenant.id,
      );
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException(
        'Provide at least one field to update.',
      );
    }

    await this.prisma.tenant.update({
      where: { id: currentTenant.id },
      data,
    });

    return {
      ok: true,
      tenant: await this.formatTenantWithMemberCount(currentTenant.id),
    };
  }

  private async formatTenantWithMemberCount(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: {
          select: {
            profiles: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new UnauthorizedException('Tenant not found.');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      createdAt: tenant.createdAt,
      membersCount: tenant._count.profiles,
    };
  }

  private async buildUniqueTenantSlug(rawValue: string, ignoreId?: string) {
    return generateUniqueTenantSlug(rawValue, async (slug) => {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existing) {
        return false;
      }

      return existing.id !== ignoreId;
    });
  }
}
