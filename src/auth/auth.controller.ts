// src/auth/auth.controller.ts
import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { Response, Request } from 'express'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './jwt-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: { username: string; password: string },
    @Res() res: Response
  ) {
    const user = await this.authService.validateUser(body.username, body.password)
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' })
    }
    const token = await this.authService.login(user)
    res.cookie('jwt', token, {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production', // secure=true em produção (HTTPS)
      path: '/',
      maxAge: 1000 * 60 * 60,
    })
    return res.json({ message: 'Logado', user })
  }

  @Post('logout')
  async logout(@Res() res: Response) {
    // limpar cookie (path consistente)
    res.clearCookie('jwt', { path: '/' })
    return res.json({ message: 'Deslogado' })
  }

@UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@Req() req: Request) {
    return { user: req.user }; // agora tipado corretamente
  }}