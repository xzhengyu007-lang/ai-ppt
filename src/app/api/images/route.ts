/**
 * 图库代理（服务端）。
 *
 * 存在的理由：把「搜索 + 许可证过滤 + 署名生成」放在服务端，
 * 前端只拿到已过滤好的结果，避免把不合规的图传进幻灯片。
 * 静态构建下这个路由会被 build-static.mjs 临时移出，前端改为直连 Commons。
 */
import type { NextRequest } from "next/server";
import { searchCommons, creditLine } from "@/lib/images/commons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 12);

  if (!q) {
    return Response.json({ error: "缺少查询词 q" }, { status: 400 });
  }

  try {
    const hits = await searchCommons(q, Number.isFinite(limit) ? limit : 12);
    return Response.json({
      query: q,
      count: hits.length,
      images: hits.map((h) => ({ ...h, credit: creditLine(h) })),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
