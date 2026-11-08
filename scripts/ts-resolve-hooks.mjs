/**
 * 进程内 TS 解析钩子：
 *   1. 把 "@/xxx" 映射到 <root>/src/xxx（与 tsconfig paths 一致）
 *   2. 无扩展名的相对/别名导入补 .ts / .tsx / /index.ts
 *
 * 为什么需要：本机沙箱禁止 spawn，tsx（esbuild）与 vitest（rolldown）都会 EPERM。
 * Node 24 自带 TS 类型剥离，配合这个钩子就能直接跑 .ts，全程不 fork。
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

const CANDIDATE_EXT = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", ".json"];

function firstExisting(basePath) {
  for (const ext of CANDIDATE_EXT) {
    const p = basePath + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  for (const ext of [".ts", ".tsx", ".js", ".mjs"]) {
    const p = path.join(basePath, "index" + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 1) 别名 @/xxx → src/xxx
  if (specifier.startsWith("@/")) {
    const base = path.join(SRC, specifier.slice(2));
    const hit = firstExisting(base);
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  // 2) 相对导入缺扩展名时补齐
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    // 注意：不能用 new URL(...).pathname —— 中文路径会被百分号编码，必须 fileURLToPath
    const parentDir = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : ROOT;
    const base = path.resolve(parentDir, specifier);
    const hit = firstExisting(base);
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
