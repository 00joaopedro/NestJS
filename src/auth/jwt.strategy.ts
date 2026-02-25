import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { SupabaseService } from '../supabase/supabase.service';

function cookieExtractor(req: Request): string | null {
  return req?.cookies?.jwt ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly supabase: SupabaseService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: process.env.SUPABASE_JWT_SECRET,
    });

    if (!process.env.SUPABASE_JWT_SECRET) {
      throw new Error('Missing SUPABASE_JWT_SECRET env var.');
    }
  }

  async validate(payload: any) {
    // payload.sub = userId no Supabase
    const userId = payload?.sub;
    if (!userId) throw new UnauthorizedException('Invalid token payload.');

    // busca role no profiles usando service role (backend)
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('id,email,role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      // se não tiver profile, considera sem role (ou bloqueia)
      throw new UnauthorizedException('User profile not found.');
    }

    return {
      id: data.id,
      email: data.email,
      roles: [data.role], // mantém compatível com seu RolesGuard
    };
  }
}
