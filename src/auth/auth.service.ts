import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  buildTenantNameFromEmail,
  generateUniqueTenantSlug,
  toTenantSummary,
} from '../tenancy/tenant.utils';

type RegisterInput = {
  email?: string;
  password?: string;
  tenantName?: string;
  tenantSlug?: string;
};

type LoginInput = {
  email?: string;
  password?: string;
};

function isConflictError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already exists') ||
    normalizedMessage.includes('duplicate')
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async register(input: RegisterInput) {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);
    const tenantName =
      input.tenantName?.trim() || buildTenantNameFromEmail(email);
    const tenantSlug = await this.buildUniqueTenantSlug(
      input.tenantSlug?.trim() || tenantName,
    );

    const { data, error } = await this.supabase.anon.auth.signUp({
      email,
      password,
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
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: tenantName,
            slug: tenantSlug,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
          },
        });

        const profile = await tx.profile.upsert({
          where: { id: authUser.id },
          update: {
            email: authUser.email ?? email,
            tenantId: tenant.id,
          },
          create: {
            id: authUser.id,
            email: authUser.email ?? email,
            role: Role.Admin,
            tenantId: tenant.id,
          },
          select: {
            id: true,
            email: true,
            role: true,
            tenantId: true,
            createdAt: true,
          },
        });

        return { tenant, profile };
      });

      return {
        ok: true,
        user: {
          ...result.profile,
          roles: [result.profile.role],
          tenant: toTenantSummary(result.tenant),
        },
      };
    } catch {
      const { error: rollbackError } =
        await this.supabase.admin.auth.admin.deleteUser(authUser.id);

      if (rollbackError) {
        throw new InternalServerErrorException(
          'User was created in authentication, but tenant/profile creation failed. Manual cleanup is required.',
        );
      }

      throw new InternalServerErrorException(
        'User registration failed while creating the tenant/profile. The authentication user was rolled back.',
      );
    }
  }

  async login(input: LoginInput) {
    const email = this.normalizeEmail(input.email);
    const password = this.normalizePassword(input.password);

    const { data, error } =
      await this.supabase.anon.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      throw new InternalServerErrorException(
        'Supabase did not return an access token.',
      );
    }

    const user = data.user ? await this.findProfileOrThrow(data.user.id) : null;

    return {
      accessToken,
      payload: {
        ok: true,
        user,
      },
    };
  }

  async getProfile(user: Express.AuthenticatedUser | undefined) {
    if (!user) {
      throw new UnauthorizedException('Authenticated user not found.');
    }

    return {
      ok: true,
      user: await this.findProfileOrThrow(user.id),
    };
  }

  private async findProfileOrThrow(profileId: string) {
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
      throw new UnauthorizedException('User profile not found.');
    }

    return {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      roles: [profile.role],
      tenantId: profile.tenantId,
      createdAt: profile.createdAt,
      tenant: toTenantSummary(profile.tenant),
    };
  }

  private async buildUniqueTenantSlug(rawValue: string) {
    return generateUniqueTenantSlug(rawValue, async (slug) => {
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });

      return Boolean(existingTenant);
    });
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
}
