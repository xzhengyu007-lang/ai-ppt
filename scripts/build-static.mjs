/**
 * 静态演示版构建（用于 GitHub Pages）。
 *
 * 关键点：Next 的 `output: "export"` 一旦发现 route handler 就直接报错，
 * 而 App Router 里以 `_` 开头的目录**不参与路由**，所以构建期间把
 * `src/app/api` 临时改名成 `src/app/_api`，构建完再改回来。
 * 这样服务端版本的 API 完全不受影响，也不需要维护两套代码。
 *
 * 用法：
 *   node scripts/build-static.mjs            # 本地构建到 out/
 *   NEXT_PUBLIC_BASE_PATH=/ai-ppt node ...   # 指定子路径（GitHub Pages 项目站）
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const apiDir = path.join(root, "src", "app", "api");
const parkedDir = path.join(root, "src", "app", "_api");

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
if (!basePath) {
  console.warn(
    "⚠️  未设置 NEXT_PUBLIC_BASE_PATH。GitHub Pages 项目站需设为 '/<repo>'，否则资源 404。"
  );
}

function move(from, to) {
  if (!fs.existsSync(from)) return false;
  fs.renameSync(from, to);
  return true;
}

let parked = false;
try {
  parked = move(apiDir, parkedDir);
  console.log(parked ? "已临时移出 API 路由（src/app/api → src/app/_api）" : "未找到 API 目录，跳过");

  console.log("开始静态构建…");
  execFileSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_STATIC: "1",
      NEXT_PUBLIC_BASE_PATH: basePath,
    },
    shell: process.platform === "win32",
  });

  // GitHub Pages 默认跑 Jekyll，会忽略 _next/ 这类下划线目录
  const nojekyll = path.join(root, "out", ".nojekyll");
  if (fs.existsSync(path.join(root, "out"))) {
    fs.writeFileSync(nojekyll, "");
    console.log("已写入 out/.nojekyll（禁用 Jekyll，保证 _next/ 可访问）");
  }

  const outFiles = countFiles(path.join(root, "out"));
  console.log(`\n✅ 静态构建完成：out/ 共 ${outFiles} 个文件`);
  console.log(`   访问路径前缀：${basePath || "(根路径)"}`);
} finally {
  if (parked) {
    move(parkedDir, apiDir);
    console.log("已恢复 API 路由（src/app/_api → src/app/api）");
  }
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else n++;
  }
  return n;
}
