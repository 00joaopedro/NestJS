import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.jwt ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('Missing SUPABASE_URL env var.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      algorithms: ['ES256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }) as any,
    });
  }

  async validate(payload: any) {
    const userId = payload?.sub;

    if (!userId) {
      throw new UnauthorizedException('Invalid token payload (missing sub).');
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!profile) {
      throw new UnauthorizedException('User profile not found.');
    }

    return {
      id: profile.id,
      email: profile.email,
      roles: [profile.role],
    };
  }
}