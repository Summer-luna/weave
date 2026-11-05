import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();
  return app;
}

export function buildOpenApiDocument(app: NestExpressApplication): OpenAPIObject {
  const config = new DocumentBuilder().setTitle('Weave API').setVersion('0.1.0').build();
  return SwaggerModule.createDocument(app, config, { operationIdFactory: (_controller, method) => method });
}
