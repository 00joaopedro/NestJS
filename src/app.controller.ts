// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('public')
  getPublic() {
    return { message: 'Rota pública: qualquer um pode acessar' };
  }
}