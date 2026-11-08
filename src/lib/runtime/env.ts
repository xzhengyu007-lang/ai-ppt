/**
 * 环境变量安全读取。
 *
 * 浏览器里没有 `process`，直接 `process.env.X` 会在纯静态构建里炸。
 * 所有需要读环境变量的地方都走这里。
 */
type EnvLike = Record<string, string | undefined>;

export function readEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: EnvLike } }).process;
  return proc?.env?.[key];
}

export function readEnvNum(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
