import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Use the WebSocket platform-ws adapter
  app.useWebSocketAdapter(new WsAdapter(app));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : true,
    credentials: true,
  });

  const port = parseInt(process.env.API_PORT ?? '3000', 10);
  const host = process.env.API_HOST ?? '0.0.0.0';

  await app.listen(port, host);
  logger.log(`NestJS API server listening on ${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start NestJS server', err);
  process.exit(1);
});
