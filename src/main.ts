// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser = require('cookie-parser');
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.use(json());
  app.use(cookieParser());
  // opcional: app.setGlobalPrefix('api') se quiser prefixar rotas
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`Listening on ${port}`);
}
bootstrap();
