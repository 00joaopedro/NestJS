import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { SupabaseModule } from '../supabase/supabase.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [SupabaseModule, PrismaModule, PassportModule],
  providers: [JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
