import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const WEB_DIST = resolve(__dirname, '..', '..', 'web', 'dist');

export function serveWebApp(app: NestExpressApplication): boolean {
  const index = join(WEB_DIST, 'index.html');
  if (!existsSync(index)) return false;
  app.useStaticAssets(WEB_DIST, { index: false });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(index);
  });
  return true;
}
