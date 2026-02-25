import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string }) {
    const { email, password } = body;

    const { data, error } = await this.supabase.anon.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };

    // Se você criou trigger, o profile será criado sozinho.
    // Se não criou trigger, você pode criar aqui com admin:
    if (data.user) {
      await this.supabase.admin
        .from('profiles')
        .upsert({ id: data.user.id, email: data.user.email, role: 'Comprador' });
    }

    return { ok: true, user: data.user };
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, password } = body;

    const { data, error } = await this.supabase.anon.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    const accessToken = data.session?.access_token;
    if (!accessToken) return { ok: false, error: 'No access token returned by Supabase.' };

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('jwt', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'lax' : 'lax',
      path: '/',
      // você pode ajustar maxAge; o JWT expira pelo Supabase
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
    return req.user;
  }
}
