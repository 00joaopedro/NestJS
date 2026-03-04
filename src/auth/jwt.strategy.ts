import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.jwt ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) throw new Error('Missing SUPABASE_JWT_SECRET env var.');

    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

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

return { id: profile.id, email: profile.email, roles: [profile.role] };
  }
}
