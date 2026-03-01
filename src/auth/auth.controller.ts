import {
  BadRequestException, Body, Controller, Get, Post, Req, Res, UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }) {
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }
    if (password.length < 6) {
      throw new BadRequestException('password must be at least 6 characters');
    }

    const { data, error } = await this.supabase.anon.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };

    // Garante profile no DB via Prisma (mesmo sem trigger)
    if (data.user) {
      await this.prisma.profile.upsert({
        where: { id: data.user.id },
        update: {
          email: data.user.email ?? undefined,
        },
        create: {
          id: data.user.id,
          email: data.user.email,
          role: 'Comprador',
        },
      });
    }

    return { ok: true, user: data.user };
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, error: error.message };

    const accessToken = data.session?.access_token;
    if (!accessToken) return { ok: false, error: 'No access token returned by Supabase.' };

    const isProd = process.env.NODE_ENV === 'production';

    // Se seu frontend é servido pelo MESMO domínio do backend (Railway), sameSite=lax funciona bem.
    res.cookie('jwt', accessToken, {
      httpOnly: true,
      secure: isProd, // no Railway (https) deve ser true
      sameSite: 'lax',
      path: '/',
      // opcional:
      // maxAge: (data.session?.expires_in ?? 3600) * 1000,
    });

    return { ok: true };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('jwt', { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: Request) {
    return { ok: true, user: req.user };
  }
}
