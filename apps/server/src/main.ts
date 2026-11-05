import 'reflect-metadata';
import { SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { buildOpenApiDocument, createApp } from './create-app';
import { serveWebApp } from './serve-web-app';

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}

async function bootstrap() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const app = await createApp();
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  const servesWeb = process.argv.includes('--serve-web') && serveWebApp(app);
  const port = Number(process.env.PORT ?? 3100);
  // In dev only Vite (same machine) talks to the API; when serving the built app it must be reachable on the LAN.
  await app.listen(port, servesWeb ? '0.0.0.0' : '127.0.0.1');
  console.log(`Weave API: http://localhost:${port}/api  (docs: /api/docs)`);
  if (servesWeb) for (const ip of lanAddresses()) console.log(`Weave: http://${ip}:${port}`);
}

void bootstrap();
