import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.pgdata');
const port = process.env.WEAVE_PG_PORT ?? '5436';
const user = 'weave';
const password = 'weave';

function findBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(join(process.env.PG_BIN, exe));
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL';
    if (existsSync(base)) {
      for (const version of readdirSync(base).sort((a, b) => Number(b) - Number(a))) candidates.push(join(base, version, 'bin', exe));
    }
  }
  const found = candidates.find((path) => existsSync(path));
  if (found) return found;
  const which = spawnSync(process.platform === 'win32' ? 'where' : 'which', [exe], { encoding: 'utf8' });
  if (which.status === 0) return which.stdout.split(/\r?\n/)[0].trim();
  throw new Error(`找不到 ${exe}，请安装 PostgreSQL 或设置 PG_BIN 指向它的 bin 目录`);
}

function isRunning() {
  return spawnSync(findBin('pg_ctl'), ['status', '-D', dataDir], { stdio: 'ignore' }).status === 0;
}

function init() {
  if (existsSync(join(dataDir, 'PG_VERSION'))) return;
  const tmp = mkdtempSync(join(tmpdir(), 'weave-pg-'));
  const pwfile = join(tmp, 'pw');
  writeFileSync(pwfile, password);
  try {
    execFileSync(
      findBin('initdb'),
      ['-D', dataDir, '-U', user, `--pwfile=${pwfile}`, '--auth=scram-sha-256', '-E', 'UTF8', '--no-locale'],
      { stdio: 'inherit' },
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`项目数据库已初始化：${dataDir}`);
}

async function start() {
  init();
  if (isRunning()) {
    console.log(`项目数据库已在运行（端口 ${port}）`);
    return;
  }
  // Detached with its own hidden console: if the postmaster shared ours, closing this terminal (or Ctrl+C on
  // `npm run dev`) would leave it unable to spawn backends (Windows error 0xC0000142).
  const child = spawn(
    findBin('pg_ctl'),
    ['start', '-D', dataDir, '-l', join(dataDir, 'server.log'), '-w', '-o', `-p ${port} -c listen_addresses=localhost`],
    { stdio: 'ignore', detached: true, windowsHide: true },
  );
  const status = await new Promise((done) => child.on('exit', done));
  if (status !== 0) throw new Error(`项目数据库启动失败，详见 ${join(dataDir, 'server.log')}`);
  console.log(`项目数据库已启动：postgres://${user}:${password}@localhost:${port}/weave`);
}

function stop() {
  if (!isRunning()) {
    console.log('项目数据库没有在运行');
    return;
  }
  execFileSync(findBin('pg_ctl'), ['stop', '-D', dataDir, '-m', 'fast', '-w'], { stdio: 'inherit' });
}

function status() {
  console.log(isRunning() ? `运行中（端口 ${port}，数据目录 ${dataDir}）` : '未运行');
}

const commands = { init, start, stop, status };
const command = commands[process.argv[2]];
if (!command) {
  console.error('用法：node scripts/db.mjs <init|start|stop|status>');
  process.exit(1);
}
await command();
