import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser = require('cookie-parser');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Para seu caso atual, pode manter. Em produção, depois você restringe origins.
  app.enableCors({ origin: true, credentials: true });

  // opcional: app.setGlobalPrefix('api')

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Listening on ${port}`);
}
bootstrap();
