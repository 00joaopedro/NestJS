import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN || true;

  app.enableCors({
    origin: corsOrigin === 'true' ? true : corsOrigin,
    credentials: true,
  });

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Listening on ${port}`);
  console.log(`Health: /health`);
  console.log(`Public: /public/`);
}
bootstrap();
