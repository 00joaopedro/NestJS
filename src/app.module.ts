import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // ✅ em produção, melhor definir explicitamente o origin (ou uma lista)
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
