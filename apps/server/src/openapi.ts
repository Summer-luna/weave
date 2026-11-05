import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument, createApp } from './create-app';

async function generate() {
  process.env.DATABASE_URL = 'pglite:memory';
  const app = await createApp();
  await app.init();
  const target = resolve(__dirname, '..', 'openapi.json');
  writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(app), null, 2)}\n`);
  await app.close();
  console.log(`OpenAPI written to ${target}`);
}

void generate();
