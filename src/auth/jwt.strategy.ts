import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.jwt ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly supabase: SupabaseService) {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error('Missing SUPABASE_JWT_SECRET env var.');
    }

    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const userId = payload?.sub;
    if (!userId) throw new UnauthorizedException('Invalid token payload (missing sub).');

    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('id,email,role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new UnauthorizedException('User profile not found.');
    }

    return {
      id: data.id,
      email: data.email,
      roles: [data.role],
    };
  }
}
