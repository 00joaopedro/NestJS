import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get()
  @Roles('Admin')
  async listAll() {
    // Lista usuários a partir da tabela profiles (mais simples e seguro do que listar auth.users)
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, users: data };
  }
}
