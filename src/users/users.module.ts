import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [UsersController],
})
export class UsersModule {}
