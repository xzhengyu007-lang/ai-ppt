/**
 * 导出 Slide IR 的 JSON Schema（供外部工具/审计使用）。
 * zod 4 自带 z.toJSONSchema，不额外引依赖。
 *
 * 运行：npm run schema
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { deckSchema } from "@/lib/ir/schema";

function main() {
  const fn = (z as unknown as { toJSONSchema?: (s: unknown) => unknown }).toJSONSchema;
  if (!typeof fn || typeof fn !== "function") {
    throw new Error(
      "当前 zod 版本没有 z.toJSONSchema；请升级 zod 到 4.x，或改用手写 schema 导出"
    );
  }

  const schema = fn(deckSchema);
  const outDir = path.resolve("docs");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "slide-ir.schema.json");
  fs.writeFileSync(outFile, JSON.stringify(schema, null, 2), "utf8");

  const stat = fs.statSync(outFile);
  console.log(`已导出 ${outFile}（${stat.size} 字节）`);
}

main();
