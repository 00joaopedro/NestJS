import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function isConflictError(message: string): boolean {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes('already registered')
    || normalizedMessage.includes('already exists')
    || normalizedMessage.includes('duplicate');
}

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

    if (error) {
      if (isConflictError(error.message)) {
        throw new ConflictException(error.message);
      }

      throw new BadRequestException(error.message);
    }

    if (data.user) {
      try {
        await this.prisma.profile.upsert({
          where: { id: data.user.id },
          update: {
            email: data.user.email ?? undefined,
          },
          create: {
            id: data.user.id,
            email: data.user.email ?? email,
            role: Role.Comprador,
          },
        });
      } catch {
        const { error: rollbackError } = await this.supabase.admin.auth.admin.deleteUser(data.user.id);

        if (rollbackError) {
          throw new InternalServerErrorException(
            'User was created in authentication, but profile creation failed. Manual cleanup is required.',
          );
        }

        throw new InternalServerErrorException(
          'User registration failed while creating the profile. The authentication user was rolled back.',
        );
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

    if (!email || !password) {
      throw new BadRequestException('email and password are required');
    }

    const { data, error } = await this.supabase.anon.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw new InternalServerErrorException('Supabase did not return an access token.');
    }

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('jwt', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
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