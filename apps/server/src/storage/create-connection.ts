import { resolve } from 'node:path';
import { DatabaseConnection } from './database';
import { NodePgConnection } from './node-pg-connection';
import { PgliteConnection } from './pglite-connection';

const PGLITE_PREFIX = 'pglite:';

export function createConnection(url: string): DatabaseConnection {
  if (!url.startsWith(PGLITE_PREFIX)) return new NodePgConnection(url);
  const location = url.slice(PGLITE_PREFIX.length).replace(/^\/\//, '');
  return new PgliteConnection(location === 'memory' ? undefined : resolve(process.cwd(), location));
}
