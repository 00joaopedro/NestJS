import { Body, Controller, Get, Post, Req, Res, UseGuards, BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }) {
    const email = body?.email?.trim();
    const password = body?.password;

    if (!email || !password) throw new BadRequestException('email and password are required');

    const { data, error } = await this.supabase.anon.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };

    // Se você não tiver trigger no Supabase para criar profile, isso garante o profile:
    if (data.user) {
      const { error: upsertError } = await this.supabase.admin
        .from('profiles')
        .upsert({ id: data.user.id, email: data.user.email, role: 'Comprador' });

      if (upsertError) {
        return { ok: false, error: `Profile upsert failed: ${upsertError.message}` };
      }
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

    if (!email || !password) throw new BadRequestException('email and password are required');

    const { data, error } = await this.supabase.anon.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    const accessToken = data.session?.access_token;
    if (!accessToken) return { ok: false, error: 'No access token returned by Supabase.' };

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('jwt', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      // Opcional: alinhar com expiração do token (em segundos)
      // maxAge: (data.session?.expires_in ?? 3600) * 1000,
    });

    return { ok: true };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Para o seu app, basta apagar o cookie (o token fica inválido localmente).
    res.clearCookie('jwt', { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: Request) {
    return { ok: true, user: req.user };
  }
}
