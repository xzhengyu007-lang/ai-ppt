/**
 * 测试入口：进程内加载所有 *.test.ts 并执行，不 fork 任何子进程。
 *
 * 用法：node --import tsx scripts/test.ts
 * （沙箱禁止 spawn，所以不能用 vitest / node --test）
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runAll } from "../tests/harness";

async function main() {
  const dir = path.resolve("tests");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".test.ts"))
    .sort();

  if (!files.length) {
    console.error("没有找到任何 tests/*.test.ts");
    process.exit(1);
  }

  console.log(`加载 ${files.length} 个测试文件…\n`);
  for (const f of files) {
    await import(pathToFileURL(path.join(dir, f)).href);
  }

  console.log("运行：\n");
  const started = Date.now();
  const r = await runAll();
  const ms = Date.now() - started;

  console.log(
    `\n合计：通过 ${r.passed} / 失败 ${r.failed}  （${ms} ms）`
  );

  if (r.failed) {
    console.log("\n失败明细：");
    for (const f of r.failures) console.log(`  - ${f.name}\n    ${f.error}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("测试运行器异常：", e);
  process.exit(1);
});
