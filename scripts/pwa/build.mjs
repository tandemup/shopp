// Genera el identificador de compilación y el manifiesto público de versión.
// Uso: npm run build (también desde Netlify).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const root = process.cwd();
const builtAt = new Date().toISOString();
const commit = String(process.env.COMMIT_REF || process.env.GITHUB_SHA || '').trim();
const deployId = String(process.env.DEPLOY_ID || '').trim();
// UUID por compilación: funciona también al republicar un mismo commit.
const buildId = `${builtAt.replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;

const env = { ...process.env, EXPO_PUBLIC_SHOPP_BUILD_ID: buildId };
const isWindows = process.platform === 'win32';
const expoBin = isWindows ? 'npx.cmd' : 'npx';
const build = spawnSync(expoBin, ['expo', 'export', '--platform', 'web'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
if (build.error) {
  console.error('[Shopp] No se pudo ejecutar Expo:', build.error);
  process.exit(1);
}
if (build.status !== 0) process.exit(build.status || 1);

const dist = resolve(root, 'dist');
mkdirSync(dist, { recursive: true });
const version = {
  schema: 1,
  buildId,
  builtAt,
  commit: commit || null,
  deployId: deployId || null,
};
writeFileSync(resolve(dist, 'version.json'), JSON.stringify(version, null, 2) + '\n');
console.log('[Shopp] Version web publicada:', version.buildId);
